/**
 * The evidence rule types GateReady can evaluate.
 * This file has no Forge imports so both the backend and the UI can use it.
 */

export const VERDICT = {
  MET: 'met',
  NOT_MET: 'not_met',
  NEEDS_REVIEW: 'needs_review',
};

export const VERDICT_LABEL = {
  met: 'Met',
  not_met: 'Not met',
  needs_review: 'Needs review',
};

/** Where a "fresh since" rule takes its reference date from. */
export const FRESH_SINCE = {
  DESIGN_CHANGE: 'design_change',
  PREVIOUS_GATE: 'previous_gate',
  FIXED_DATE: 'fixed_date',
};

export const DEFAULT_APPROVED_STATES = ['Approved', 'Verified'];

export const RULE_TYPES = {
  confluence_page_exists: {
    label: 'Document exists',
    source: 'confluence',
    summary: 'A Confluence page with the given label or title exists in the project space.',
  },
  confluence_page_approved: {
    label: 'Document is approved',
    source: 'confluence',
    summary: 'The page status is one of the approved statuses.',
  },
  confluence_page_fresh: {
    label: 'Document is up to date',
    source: 'confluence',
    summary: 'The page was last edited after a reference date, such as the last design change.',
  },
  confluence_page_sections: {
    label: 'Document has required sections',
    source: 'confluence',
    summary: 'The page contains every required section heading, and none of them is empty.',
  },
  jira_query_all_done: {
    label: 'All matching work items are done',
    source: 'jira',
    summary: 'Every work item matched by the JQL is in a done status.',
  },
  jira_query_none_open: {
    label: 'No matching work items',
    source: 'jira',
    summary: 'The JQL returns nothing, for example no unresolved high-risk items.',
  },
};

export const RULE_TYPE_KEYS = Object.keys(RULE_TYPES);

export const isConfluenceRule = (ruleType) => RULE_TYPES[ruleType]?.source === 'confluence';

/** Short random id for gates and requirements. Not security sensitive. */
export const newId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * Validates one requirement. Returns a list of human-readable problems;
 * an empty list means the requirement can be saved and evaluated.
 */
export const validateRequirement = (requirement) => {
  const problems = [];
  const params = requirement.params || {};
  if (!requirement.title || !requirement.title.trim()) problems.push('Give the requirement a title.');
  if (!RULE_TYPES[requirement.ruleType]) {
    problems.push('Choose a rule type.');
    return problems;
  }

  if (isConfluenceRule(requirement.ruleType)) {
    if (!trimmed(params.label) && !trimmed(params.title)) {
      problems.push('Enter a page label or a title to look for.');
    }
  } else if (!trimmed(params.jql)) {
    problems.push('Enter a JQL filter.');
  }

  if (requirement.ruleType === 'confluence_page_sections' && !(params.sections || []).filter(trimmed).length) {
    problems.push('List at least one required section heading.');
  }
  if (requirement.ruleType === 'confluence_page_fresh') {
    if (!Object.values(FRESH_SINCE).includes(params.since)) problems.push('Choose a reference date.');
    if (params.since === FRESH_SINCE.FIXED_DATE && Number.isNaN(Date.parse(params.date))) {
      problems.push('Enter a valid reference date.');
    }
  }
  return problems;
};

const trimmed = (value) => (typeof value === 'string' ? value.trim() : '');
