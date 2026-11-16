import { listGaps as loadGaps } from '../services/gaps.js';
import { action, resolveProject, VERDICT_NOTE } from './shared.js';

/** list-gaps: requirements that are not met in the latest check, with evidence. */
export const listGaps = action('list-gaps', async (payload) => {
  const project = await resolveProject(payload);
  const { gate, result, gaps, needsReview } = await loadGaps({ projectId: project.projectId, gateRef: payload.gate, siteUrl: project.siteUrl });

  return {
    project: { key: project.projectKey, name: project.projectName },
    gate: gate.name,
    checkedAt: result.checkedAt,
    gaps: gaps.map((gap) => ({
      requirement: gap.title,
      finding: gap.reason,
      owner: gap.owner?.displayName || 'No owner (work item would be unassigned)',
      evidence: gap.evidence.map((evidence) => ({ title: evidence.title, url: evidence.url, detail: evidence.detail })),
      existingWorkItem: gap.issue,
    })),
    needsReview: needsReview.map((item) => ({ requirement: item.title, finding: item.reason })),
    note: `Gaps are requirements with verdict "Not met". "Needs review" items are not gaps: they need a person to judge. ${VERDICT_NOTE}`,
  };
});
