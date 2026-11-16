import { issueEvidence, met, needsReview, notMet, scopeJql } from './shared.js';

const MAX_EVIDENCE = 10;

/**
 * Met when every work item matched by the JQL is done.
 * An empty result is not counted as success: nothing matching usually means
 * the work was never planned or the filter is wrong, so a person should look.
 */
export const jiraQueryAllDone = async (requirement, ctx) => {
  const jql = scopeJql(ctx.projectRef, requirement.params.jql);
  const { issues, truncated } = await ctx.clients.jira.searchIssues(jql);

  if (!issues.length) {
    return needsReview(`No work items match "${requirement.params.jql}" in ${ctx.projectKey}. Confirm the work was planned.`);
  }

  const open = issues.filter((issue) => !issue.done);
  const suffix = truncated ? ' (only the first results were checked)' : '';
  if (!open.length) {
    return met(`All ${issues.length} matching work items are done${suffix}.`);
  }
  return notMet(
    `${open.length} of ${issues.length} matching work items are not done${suffix}.`,
    open.slice(0, MAX_EVIDENCE).map((issue) => issueEvidence(issue, ctx.siteUrl))
  );
};
