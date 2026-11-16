import { checkGate } from '../services/checks.js';
import { getGapLinks } from '../data/results.js';
import { action, presentItem, presentSummary, resolveProject, VERDICT_NOTE } from './shared.js';

/** run-gate-check: evaluates one gate now against live Jira and Confluence data. */
export const runGateCheck = action('run-gate-check', async (payload, context) => {
  const project = await resolveProject(payload);
  const result = await checkGate({
    projectId: project.projectId,
    gateRef: payload.gate,
    accountId: context.accountId || context.principal?.accountId || null,
    siteUrl: project.siteUrl,
  });
  const gaps = await getGapLinks(project.projectId);

  return {
    project: { key: project.projectKey, name: project.projectName },
    gate: result.gateName,
    checkedAt: result.checkedAt,
    summary: presentSummary(result.summary),
    requirements: result.items.map((item) => presentItem(item, gaps[item.requirementId], project.siteUrl)),
    note: VERDICT_NOTE,
  };
});
