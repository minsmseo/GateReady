import { getProjectStatus, UserError } from '../services/checks.js';
import { action, presentSummary, resolveProject, VERDICT_NOTE } from './shared.js';

/** get-gate-status: readiness of every gate from the latest stored checks. */
export const getGateStatus = action('get-gate-status', async (payload) => {
  const project = await resolveProject(payload);
  const { plan, results } = await getProjectStatus(project.projectId);
  if (!plan) {
    throw new UserError(`Project ${project.projectKey} has no gate plan yet. A project administrator can set one up in Project settings > GateReady settings.`);
  }

  return {
    project: { key: project.projectKey, name: project.projectName },
    template: plan.templateName,
    currentGate: plan.gates.find((gate) => gate.id === plan.currentGateId)?.name || null,
    lastDesignChange: plan.baselineDate,
    gates: plan.gates.map((gate, index) => {
      const result = results[gate.id];
      return {
        number: index + 1,
        name: gate.name,
        passedOn: gate.passedOn,
        isCurrent: gate.id === plan.currentGateId,
        requirements: gate.requirements.length,
        lastCheckedAt: result?.checkedAt || null,
        summary: result ? presentSummary(result.summary) : null,
        note: result ? (result.stale ? 'The gate plan changed after this check; run the check again.' : null) : 'Not checked yet; run a gate check.',
      };
    }),
    note: `These are stored results and may be out of date. Use run-gate-check for fresh results. ${VERDICT_NOTE}`,
  };
});
