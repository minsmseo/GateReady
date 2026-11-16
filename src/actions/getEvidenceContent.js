import * as jira from '../clients/jira';
import * as confluence from '../clients/confluence';
import { isConfluenceRule, RULE_TYPES } from '../domain/ruleTypes.js';
import { excerpt, extractSections, findSection, toPlainText } from '../engine/sections.js';
import { scopeJql } from '../engine/rules/shared.js';
import { requirePlan, resolveGate, UserError } from '../services/checks.js';
import { action, resolveProject } from './shared.js';

const SECTION_EXCERPT = 900;
const PAGE_EXCERPT = 3000;

/** Finds a requirement of the gate by (part of) its title. */
const resolveRequirement = (gate, reference) => {
  const wanted = String(reference || '').trim().toLowerCase();
  if (!wanted) {
    throw new UserError(`Which requirement of the ${gate.name} gate? Options: ${gate.requirements.map((r) => r.title).join('; ')}.`);
  }
  const matches = gate.requirements.filter((requirement) => requirement.title.toLowerCase().includes(wanted));
  const exact = gate.requirements.find((requirement) => requirement.title.toLowerCase() === wanted);
  if (exact) return exact;
  if (matches.length === 1) return matches[0];
  if (!matches.length) {
    throw new UserError(`No requirement of the ${gate.name} gate matches "${reference}". Options: ${gate.requirements.map((r) => r.title).join('; ')}.`);
  }
  throw new UserError(`"${reference}" matches several requirements: ${matches.map((r) => r.title).join('; ')}. Use the full title.`);
};

/**
 * get-evidence-content: returns the actual content behind one requirement,
 * so the agent can comment on whether it is sufficient. For document rules
 * this is an excerpt of the Confluence page; for Jira rules, the matching
 * work items.
 */
export const getEvidenceContent = action('get-evidence-content', async (payload) => {
  const project = await resolveProject(payload);
  const plan = await requirePlan(project.projectId);
  const gate = resolveGate(plan, payload.gate);
  const requirement = resolveRequirement(gate, payload.requirement);
  const base = { gate: gate.name, requirement: requirement.title, rule: RULE_TYPES[requirement.ruleType]?.label };

  if (!isConfluenceRule(requirement.ruleType)) {
    const { issues } = await jira.searchIssues(scopeJql(plan.projectId, requirement.params.jql));
    return {
      ...base,
      filter: requirement.params.jql,
      workItems: issues.slice(0, 30).map((issue) => ({
        key: issue.key,
        url: `${project.siteUrl}/browse/${issue.key}`,
        summary: issue.summary,
        status: issue.status,
        done: issue.done,
        assignee: issue.assignee || 'Unassigned',
      })),
      total: issues.length,
    };
  }

  const spaceKey = requirement.params.spaceKey || plan.spaceKey;
  if (!spaceKey) throw new UserError('No Confluence space is linked to this project, so there is no document to read.');
  const pages = await confluence.findPages({ spaceKey, label: requirement.params.label, title: requirement.params.title });
  if (!pages.length) {
    return { ...base, document: null, note: `No matching page exists in space ${spaceKey}. There is no content to review.` };
  }

  const page = pages[0];
  const [body, state] = await Promise.all([confluence.getPageBody(page.id), confluence.getContentState(page.id)]);
  const sections = extractSections(body.storage);
  const required = requirement.params.sections || [];

  return {
    ...base,
    document: {
      title: page.title,
      url: page.url,
      status: state?.name || 'No status',
      lastEdited: page.lastModified,
      version: page.version,
      headings: sections.map((section) => section.heading),
    },
    // For "required sections" rules, return those sections; otherwise the start of the page.
    sections: required.length
      ? required.map((name) => {
          const section = findSection(sections, name);
          return { required: name, found: Boolean(section), heading: section?.heading || null, text: section ? excerpt(section.text, SECTION_EXCERPT) : null };
        })
      : undefined,
    excerpt: required.length ? undefined : excerpt(toPlainText(body.storage), PAGE_EXCERPT),
    note:
      'This is an excerpt for judging whether the content is sufficient. Any opinion about sufficiency is advisory: present it as "worth a reviewer\'s look", separate from the rule verdict, and never as a change to the verdict.',
  };
});
