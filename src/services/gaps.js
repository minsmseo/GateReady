import * as jira from '../clients/jira';
import { VERDICT, RULE_TYPES } from '../domain/ruleTypes.js';
import { getGapLinks, getResult, saveGapLink } from '../data/results.js';
import { projectClause } from '../engine/rules/shared.js';
import { requirePlan, resolveGate, UserError } from './checks.js';
import { nameResult } from './people.js';

export const GAP_LABEL = 'gateready-gap';

/**
 * Lists the gaps (requirements that are not met) from the latest check of
 * a gate, together with any work item already raised for them.
 */
export const listGaps = async ({ projectId, gateRef, siteUrl }) => {
  const plan = await requirePlan(projectId);
  const gate = resolveGate(plan, gateRef);
  const stored = await getResult(projectId, gate.id);
  if (!stored) {
    throw new UserError(`The ${gate.name} gate has not been checked yet. Run a check first.`, 'no_result');
  }
  const result = await nameResult(stored);
  const links = await getGapLinks(projectId);
  const gaps = result.items
    .filter((item) => item.verdict === VERDICT.NOT_MET)
    .map((item) => ({
      requirementId: item.requirementId,
      title: item.title,
      reason: item.reason,
      owner: item.owner,
      evidence: item.evidence,
      ruleType: item.ruleType,
      issue: links[item.requirementId]
        ? { key: links[item.requirementId].issueKey, url: `${siteUrl}/browse/${links[item.requirementId].issueKey}` }
        : null,
    }));
  const needsReview = result.items.filter((item) => item.verdict === VERDICT.NEEDS_REVIEW);
  return { plan, gate, result, gaps, needsReview };
};

/** Atlassian Document Format helpers for the work item description. */
const paragraph = (...content) => ({ type: 'paragraph', content });
const plain = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) });
const strong = (text) => plain(text, [{ type: 'strong' }]);
const link = (text, href) => plain(text, [{ type: 'link', attrs: { href } }]);

const describeGap = (gap, gate, checkedAt) => {
  const content = [
    paragraph(strong('Gate: '), plain(gate.name)),
    paragraph(strong('Requirement: '), plain(`${gap.title} (${RULE_TYPES[gap.ruleType]?.label || gap.ruleType})`)),
    paragraph(strong('Finding: '), plain(gap.reason)),
  ];
  const linked = gap.evidence.filter((evidence) => evidence.url);
  if (linked.length) {
    content.push(paragraph(strong('Evidence checked:')));
    content.push({
      type: 'bulletList',
      content: linked.map((evidence) => ({
        type: 'listItem',
        content: [paragraph(link(evidence.title, evidence.url), plain(evidence.detail ? ` - ${evidence.detail}` : ''))],
      })),
    });
  }
  content.push(paragraph(plain(`Raised by GateReady from the check on ${checkedAt.slice(0, 10)}. Close this item once the evidence is in place, then run the check again.`)));
  return { type: 'doc', version: 1, content };
};

/** Picks a standard, non-subtask work type, preferring "Task". */
const pickIssueType = (issueTypes) => {
  const standard = issueTypes.filter((type) => !type.subtask && (type.hierarchyLevel ?? 0) === 0);
  return standard.find((type) => (type.untranslatedName || type.name) === 'Task') || standard[0] || null;
};

/** True when the linked work item still exists and is not done. */
const hasOpenIssue = async (projectId, issueKey) => {
  try {
    const { issues } = await jira.searchIssues(`${projectClause(projectId)} AND key = "${issueKey}"`);
    return issues.length > 0 && !issues[0].done;
  } catch (error) {
    // A deleted work item makes the JQL invalid (400); treat it as gone.
    if (error.status === 400 || error.status === 404) return false;
    throw error;
  }
};

/**
 * Creates one Jira work item per gap and assigns it to the requirement owner.
 * A gap that already has an open work item is skipped, so running this twice
 * never creates duplicates. If the earlier item was closed but the gap is
 * still there, a new one is raised.
 *
 * @param {string[]} [requirementIds] Limit to these gaps; all gaps when omitted.
 */
export const createGapIssues = async ({ projectId, gateRef, requirementIds, siteUrl }) => {
  const { plan, gate, result, gaps } = await listGaps({ projectId, gateRef, siteUrl });
  const wanted = requirementIds?.length ? gaps.filter((gap) => requirementIds.includes(gap.requirementId)) : gaps;
  if (!wanted.length) return { gate: gate.name, created: [], skipped: [], failed: [] };

  const issueType = pickIssueType(await jira.getCreateIssueTypes(projectId));
  if (!issueType) throw new UserError('This project has no work type GateReady can use to raise gaps.', 'no_issue_type');

  const created = [];
  const skipped = [];
  const failed = [];

  for (const gap of wanted) {
    try {
      if (gap.issue && (await hasOpenIssue(projectId, gap.issue.key))) {
        skipped.push({ requirementId: gap.requirementId, title: gap.title, key: gap.issue.key, url: gap.issue.url });
        continue;
      }

      const fields = {
        project: { id: String(projectId) },
        issuetype: { id: issueType.id },
        summary: `[${gate.name}] ${gap.title}`.slice(0, 250),
        description: describeGap(gap, gate, result.checkedAt),
        labels: [GAP_LABEL],
      };

      let issue;
      let assigned = Boolean(gap.owner?.accountId);
      try {
        issue = await jira.createIssue(assigned ? { ...fields, assignee: { accountId: gap.owner.accountId } } : fields);
      } catch (error) {
        // The owner may not be assignable in this project. Raise the gap anyway.
        if (!assigned || error.status !== 400) throw error;
        issue = await jira.createIssue(fields);
        assigned = false;
      }

      await saveGapLink(projectId, gap.requirementId, { issueKey: issue.key, issueId: issue.id, gateId: gate.id, createdAt: new Date().toISOString() });
      created.push({
        requirementId: gap.requirementId,
        title: gap.title,
        key: issue.key,
        url: `${siteUrl}/browse/${issue.key}`,
        assignee: assigned ? gap.owner.displayName || 'the requirement owner' : null,
        note: gap.owner?.accountId && !assigned ? 'The owner could not be assigned in this project, so the item is unassigned.' : null,
      });
    } catch (error) {
      console.error(`Could not raise gap for requirement ${gap.requirementId}: ${error.status || ''} ${error.message}`);
      failed.push({
        requirementId: gap.requirementId,
        title: gap.title,
        reason: error.status === 403 || error.status === 401 ? 'You do not have permission to create work items in this project.' : 'Jira rejected the request.',
      });
    }
  }
  return { gate: gate.name, created, skipped, failed };
};
