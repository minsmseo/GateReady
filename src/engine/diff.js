/**
 * Compares a new readiness result with the previous one for the same gate,
 * so a re-check can show what moved ("Control Plan ... is now met").
 *
 * @returns {null | { checkedAt, readiness, changes: Array<{requirementId, title, from, to}> }}
 *   null when there is no previous result to compare with.
 */
export const diffResults = (previous, current) => {
  if (!previous?.items || !previous.summary) return null;
  const before = new Map(previous.items.map((item) => [item.requirementId, item.verdict]));
  const changes = current.items
    .filter((item) => before.has(item.requirementId) && before.get(item.requirementId) !== item.verdict)
    .map((item) => ({ requirementId: item.requirementId, title: item.title, from: before.get(item.requirementId), to: item.verdict }));
  return { checkedAt: previous.checkedAt, readiness: previous.summary.readiness, changes };
};

/** One line of the check history: when, who (account id only) and the outcome. */
export const toHistoryEntry = (result) => ({
  checkedAt: result.checkedAt,
  checkedBy: result.checkedBy?.accountId || null,
  readiness: result.summary.readiness,
  met: result.summary.met,
  notMet: result.summary.notMet,
  needsReview: result.summary.needsReview,
  total: result.summary.total,
});

export const HISTORY_LIMIT = 10;

/** Adds an entry to a history list, newest first, keeping the last few. */
export const addToHistory = (history, entry) => [entry, ...(Array.isArray(history) ? history : [])].slice(0, HISTORY_LIMIT);
