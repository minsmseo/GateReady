import * as jira from '../clients/jira';
import * as confluence from '../clients/confluence';
import { runGateCheck } from '../engine/evaluate.js';
import { diffResults } from '../engine/diff.js';
import { getPlan, savePlan } from '../data/templates.js';
import { appendHistory, getGapLinks, getHistoriesByGate, getResult, getResultsByGate, saveResult } from '../data/results.js';
import { nameResult, withNames } from './people.js';

/** Thrown for problems the user can fix; the message is shown as-is. */
export class UserError extends Error {
  constructor(message, code = 'invalid') {
    super(message);
    this.name = 'UserError';
    this.code = code;
  }
}

export const requirePlan = async (projectId) => {
  const plan = await getPlan(projectId);
  if (!plan) {
    throw new UserError('This project has no gate plan yet. Open GateReady settings in the project and load a template.', 'no_plan');
  }
  return plan;
};

/**
 * Finds a gate by id or by name (the agent passes names). Without a
 * reference, returns the project's current gate.
 */
export const resolveGate = (plan, gateRef) => {
  const wanted = String(gateRef || '').trim().toLowerCase();
  if (!wanted) {
    return plan.gates.find((gate) => gate.id === plan.currentGateId) || plan.gates[0];
  }
  const byNumber = /^(gate\s*)?(\d+)$/.exec(wanted);
  const gate =
    plan.gates.find((g) => g.id.toLowerCase() === wanted) ||
    plan.gates.find((g) => g.name.toLowerCase() === wanted) ||
    (byNumber && plan.gates[Number(byNumber[2]) - 1]) ||
    plan.gates.find((g) => g.name.toLowerCase().includes(wanted));
  if (!gate) {
    throw new UserError(`No gate matches "${gateRef}". Gates in this project: ${plan.gates.map((g) => g.name).join(', ')}.`, 'no_gate');
  }
  return gate;
};

/** Runs the check for one gate as the current user and stores the result. */
export const checkGate = async ({ projectId, gateRef, accountId, siteUrl }) => {
  const plan = await requirePlan(projectId);
  const gate = resolveGate(plan, gateRef);
  // One listing per space for this check only; never shared between users.
  const spaceCache = new Map();
  const result = await runGateCheck({
    plan,
    gateId: gate.id,
    clients: {
      jira,
      confluence: { ...confluence, findPages: (query) => confluence.findPages(query, { spaceCache }) },
    },
    siteUrl,
    checkedBy: accountId ? { accountId } : null,
  });
  // What moved since the previous check of this gate.
  result.previous = diffResults(await getResult(projectId, gate.id), result);

  // The stored result holds account ids only; names are added for display.
  await saveResult(result);
  const history = await appendHistory(result);
  return { ...(await nameResult(result)), history: await nameHistory(history) };
};

/** Adds the checker's display name to history entries (never stored). */
const nameHistory = async (history) => {
  const names = await jira.getDisplayNames(history.map((entry) => entry.checkedBy));
  return history.map((entry) => ({ ...entry, checkedByName: entry.checkedBy ? names[entry.checkedBy] || 'Unknown user' : null }));
};

/**
 * Records a gate as passed today and moves the project on to the next gate
 * that has not been passed. The decision belongs to the review meeting, so
 * this is allowed whatever the readiness; the readiness at that moment is
 * kept with the gate for the record.
 */
export const passGate = async ({ projectId, gateRef, accountId }) => {
  const plan = await requirePlan(projectId);
  const gate = resolveGate(plan, gateRef);
  if (gate.passedOn) throw new UserError(`The ${gate.name} gate is already recorded as passed.`);

  const result = await getResult(projectId, gate.id);
  gate.passedOn = new Date().toISOString();
  gate.passedReadiness = result?.summary?.readiness ?? null;

  const index = plan.gates.findIndex((candidate) => candidate.id === gate.id);
  const next = plan.gates.slice(index + 1).find((candidate) => !candidate.passedOn);
  if (next) plan.currentGateId = next.id;

  await savePlan(plan, accountId);
  return { gate: gate.name, passedOn: gate.passedOn, nextGate: next?.name || null };
};

/** Everything the dashboard needs: the plan, latest results and raised gaps. */
export const getProjectStatus = async (projectId) => {
  const [plan, results, gaps, histories] = await Promise.all([
    getPlan(projectId),
    getResultsByGate(projectId),
    getGapLinks(projectId),
    getHistoriesByGate(projectId),
  ]);
  if (!plan) return { plan: null, results: {}, gaps: {}, histories: {} };

  // Drop results for gates or requirements that no longer exist in the plan.
  const current = {};
  for (const gate of plan.gates) {
    const result = results[gate.id];
    if (!result) continue;
    const ids = new Set(gate.requirements.map((requirement) => requirement.id));
    const stale = result.items.length !== ids.size || result.items.some((item) => !ids.has(item.requirementId));
    current[gate.id] = { ...result, stale };
  }

  const gateIds = Object.keys(current);
  const named = await withNames({ plan, results: gateIds.map((gateId) => current[gateId]) });
  return {
    plan: named.plan,
    results: Object.fromEntries(gateIds.map((gateId, index) => [gateId, named.results[index]])),
    gaps,
    histories: Object.fromEntries(
      await Promise.all(plan.gates.filter((gate) => histories[gate.id]).map(async (gate) => [gate.id, await nameHistory(histories[gate.id])]))
    ),
  };
};
