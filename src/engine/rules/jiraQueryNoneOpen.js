import { issueEvidence, met, notMet, scopeJql } from './shared.js';

const MAX_EVIDENCE = 10;

/**
 * Met when the JQL returns nothing. Used for "there must be no ..." rules,
 * such as no unresolved high-risk items before a gate.
 */
export const jiraQueryNoneOpen = async (requirement, ctx) => {
  const jql = scopeJql(ctx.projectRef, requirement.params.jql);
  const { issues, truncated } = await ctx.clients.jira.searchIssues(jql);

  if (!issues.length) {
    return met(`No work items match "${requirement.params.jql}" in ${ctx.projectKey}.`);
  }
  const count = truncated ? `More than ${issues.length}` : String(issues.length);
  return notMet(
    `${count} work item(s) match "${requirement.params.jql}" in ${ctx.projectKey}.`,
    issues.slice(0, MAX_EVIDENCE).map((issue) => issueEvidence(issue, ctx.siteUrl))
  );
};
