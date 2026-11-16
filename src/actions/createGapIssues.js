import { createGapIssues as raiseGaps } from '../services/gaps.js';
import { action, resolveProject } from './shared.js';

/**
 * create-gap-issues: creates one Jira work item per gap and assigns it to
 * the requirement owner. Gaps that already have an open work item are
 * skipped, so repeating the action never creates duplicates.
 */
export const createGapIssues = action('create-gap-issues', async (payload) => {
  const project = await resolveProject(payload);
  const outcome = await raiseGaps({ projectId: project.projectId, gateRef: payload.gate, siteUrl: project.siteUrl });

  return {
    project: { key: project.projectKey, name: project.projectName },
    gate: outcome.gate,
    created: outcome.created.map((item) => ({ key: item.key, url: item.url, requirement: item.title, assignee: item.assignee || 'Unassigned', note: item.note })),
    alreadyRaised: outcome.skipped.map((item) => ({ key: item.key, url: item.url, requirement: item.title })),
    failed: outcome.failed.map((item) => ({ requirement: item.title, reason: item.reason })),
    note: outcome.created.length || outcome.skipped.length || outcome.failed.length ? null : 'There are no gaps for this gate, so nothing was created.',
  };
});
