import { kvs, WhereConditions } from '@forge/kvs';

/**
 * Thin wrapper around Forge hosted storage (KVS). All GateReady data lives
 * here, inside Atlassian's platform; nothing is sent anywhere else.
 *
 * Key layout:
 *   plan:{projectId}                  the project's gates and requirements
 *   result:{projectId}:{gateId}       latest readiness result for a gate
 *   gap:{projectId}:{requirementId}   the Jira work item raised for a gap
 */

export const get = async (key) => (await kvs.get(key)) ?? null;

export const set = (key, value) => kvs.set(key, value);

export const remove = (key) => kvs.delete(key);

/** Returns every value whose key starts with `prefix`. */
export const listByPrefix = async (prefix) => {
  const values = [];
  let cursor;
  do {
    let query = kvs.query().where('key', WhereConditions.beginsWith(prefix)).limit(50);
    if (cursor) query = query.cursor(cursor);
    const page = await query.getMany();
    values.push(...page.results.map((entry) => ({ key: entry.key, value: entry.value })));
    cursor = page.nextCursor;
  } while (cursor);
  return values;
};
