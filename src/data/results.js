import { get, set, remove, listByPrefix } from './store.js';
import { addToHistory, toHistoryEntry } from '../engine/diff.js';

/** Readiness results: the latest check per gate, plus gap-to-work-item links. */

const resultKey = (projectId, gateId) => `result:${projectId}:${gateId}`;
const gapKey = (projectId, requirementId) => `gap:${projectId}:${requirementId}`;

export const getResult = (projectId, gateId) => get(resultKey(projectId, gateId));

export const saveResult = (result) => set(resultKey(result.projectId, result.gateId), result);

/** Latest results for every gate of a project, keyed by gate id. */
export const getResultsByGate = async (projectId) => {
  const entries = await listByPrefix(`result:${projectId}:`);
  return Object.fromEntries(entries.map((entry) => [entry.value.gateId, entry.value]));
};

export const deleteResults = async (projectId) => {
  const entries = [...(await listByPrefix(`result:${projectId}:`)), ...(await listByPrefix(`history:${projectId}:`))];
  await Promise.all(entries.map((entry) => remove(entry.key)));
};

// Check history: the last few check outcomes per gate (an audit trail of
// when the gate was checked, by whom, and how ready it was).

const historyKey = (projectId, gateId) => `history:${projectId}:${gateId}`;

export const appendHistory = async (result) => {
  const key = historyKey(result.projectId, result.gateId);
  const history = addToHistory(await get(key), toHistoryEntry(result));
  await set(key, history);
  return history;
};

/** Check history for every gate of a project, keyed by gate id, newest first. */
export const getHistoriesByGate = async (projectId) => {
  const prefix = `history:${projectId}:`;
  const entries = await listByPrefix(prefix);
  return Object.fromEntries(entries.map((entry) => [entry.key.slice(prefix.length), entry.value]));
};

export const getGapLink = (projectId, requirementId) => get(gapKey(projectId, requirementId));

export const saveGapLink = (projectId, requirementId, link) => set(gapKey(projectId, requirementId), link);

/** Gap links for a project, keyed by requirement id. */
export const getGapLinks = async (projectId) => {
  const prefix = `gap:${projectId}:`;
  const entries = await listByPrefix(prefix);
  return Object.fromEntries(entries.map((entry) => [entry.key.slice(prefix.length), entry.value]));
};
