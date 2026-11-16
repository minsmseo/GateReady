import { VERDICT, validateRequirement } from '../domain/ruleTypes.js';
import { confluencePageExists } from './rules/confluencePageExists.js';
import { confluencePageApproved } from './rules/confluencePageApproved.js';
import { confluencePageFresh } from './rules/confluencePageFresh.js';
import { confluencePageSections } from './rules/confluencePageSections.js';
import { jiraQueryAllDone } from './rules/jiraQueryAllDone.js';
import { jiraQueryNoneOpen } from './rules/jiraQueryNoneOpen.js';
import { needsReview } from './rules/shared.js';

const EVALUATORS = {
  confluence_page_exists: confluencePageExists,
  confluence_page_approved: confluencePageApproved,
  confluence_page_fresh: confluencePageFresh,
  confluence_page_sections: confluencePageSections,
  jira_query_all_done: jiraQueryAllDone,
  jira_query_none_open: jiraQueryNoneOpen,
};

/**
 * Turns a failed API call into a "needs review" outcome.
 * GateReady never reports "not met" for something it could not read:
 * a missing permission is a different problem from missing evidence.
 */
const outcomeForError = (requirement, error) => {
  const where = requirement.ruleType.startsWith('jira') ? 'Jira' : 'Confluence';
  if (error.status === 401 || error.status === 403) {
    return needsReview(`You do not have permission to read the ${where} content this rule checks.`);
  }
  if (error.status === 400 && where === 'Jira') {
    return needsReview(`Jira rejected the filter "${requirement.params?.jql}". Check the JQL in GateReady settings.`);
  }
  if (error.status === 404) {
    return needsReview(`The ${where} content this rule checks could not be found. It may have been deleted or restricted.`);
  }
  return needsReview(`The check could not be completed because ${where} returned an error. Try again.`);
};

const evaluateRequirement = async (requirement, ctx) => {
  const problems = validateRequirement(requirement);
  if (problems.length) {
    return needsReview(`This requirement is not fully configured: ${problems.join(' ')}`);
  }
  try {
    return await EVALUATORS[requirement.ruleType](requirement, ctx);
  } catch (error) {
    console.error(`Rule ${requirement.ruleType} failed with status ${error.status || 'n/a'}: ${error.message}`);
    return outcomeForError(requirement, error);
  }
};

export const summarize = (items) => {
  const count = (verdict) => items.filter((item) => item.verdict === verdict).length;
  const total = items.length;
  const metCount = count(VERDICT.MET);
  return {
    total,
    met: metCount,
    notMet: count(VERDICT.NOT_MET),
    needsReview: count(VERDICT.NEEDS_REVIEW),
    // An empty gate is 0% ready: no evidence was asked for, so none was shown.
    readiness: total ? Math.round((metCount / total) * 100) : 0,
  };
};

/**
 * Evaluates every requirement of one gate.
 *
 * @param {object} input
 * @param {object} input.plan      The project's gate plan.
 * @param {string} input.gateId    Gate to check.
 * @param {object} input.clients   { jira: { searchIssues }, confluence: { findPages, getContentState, getPageBody } }
 * @param {string} input.siteUrl   Base URL of the site, for links to work items.
 * @param {Date}   input.now       Injected clock, so tests are deterministic.
 * @param {object} input.checkedBy { accountId } of the person who ran the check.
 * @returns {object} Readiness result for the gate.
 */
export const runGateCheck = async ({ plan, gateId, clients, siteUrl, now = new Date(), checkedBy = null }) => {
  const index = plan.gates.findIndex((gate) => gate.id === gateId);
  if (index === -1) throw new Error(`Gate ${gateId} does not exist in this project's plan.`);
  const gate = plan.gates[index];

  const ctx = {
    projectKey: plan.projectKey,
    // Used in JQL; the id is unambiguous, the key is only for messages.
    projectRef: plan.projectId || plan.projectKey,
    spaceKey: plan.spaceKey || null,
    baselineDate: plan.baselineDate || null,
    previousGate: index > 0 ? plan.gates[index - 1] : null,
    siteUrl: siteUrl || '',
    clients,
    // Several rules often look at the same page; search for it once.
    pageCache: new Map(),
  };

  const items = await Promise.all(
    gate.requirements.map(async (requirement) => {
      const outcome = await evaluateRequirement(requirement, ctx);
      return {
        requirementId: requirement.id,
        title: requirement.title,
        ruleType: requirement.ruleType,
        // Account id only: results are stored and must not hold names.
        owner: requirement.owner?.accountId ? { accountId: requirement.owner.accountId } : null,
        verdict: outcome.verdict,
        reason: outcome.reason,
        evidence: outcome.evidence || [],
      };
    })
  );

  return {
    projectId: plan.projectId,
    projectKey: plan.projectKey,
    gateId: gate.id,
    gateName: gate.name,
    checkedAt: now.toISOString(),
    checkedBy,
    summary: summarize(items),
    items,
  };
};
