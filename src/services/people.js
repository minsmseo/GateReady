import * as jira from '../clients/jira';

/**
 * GateReady stores Atlassian account ids only, never names or other
 * personal data. These helpers add display names to plans and results at
 * the moment they are shown, by asking Jira as the current user.
 */

const UNKNOWN = 'Unknown user';

const ownerIds = (plan) => (plan?.gates || []).flatMap((gate) => gate.requirements.map((requirement) => requirement.owner?.accountId));

const resultIds = (result) =>
  (result?.items || []).flatMap((item) => [item.owner?.accountId, ...(item.evidence || []).map((evidence) => evidence.assigneeId)]);

const withName = (owner, names) => (owner?.accountId ? { accountId: owner.accountId, displayName: names[owner.accountId] || UNKNOWN } : null);

const namedPlan = (plan, names) => ({
  ...plan,
  gates: plan.gates.map((gate) => ({
    ...gate,
    requirements: gate.requirements.map((requirement) => ({ ...requirement, owner: withName(requirement.owner, names) })),
  })),
});

const namedResult = (result, names) => ({
  ...result,
  items: result.items.map((item) => ({
    ...item,
    owner: withName(item.owner, names),
    evidence: (item.evidence || []).map((evidence) => {
      if (evidence.type !== 'jira_issue') return evidence;
      const who = evidence.assigneeId ? `assigned to ${names[evidence.assigneeId] || UNKNOWN}` : 'unassigned';
      return { ...evidence, detail: [evidence.detail, who].filter(Boolean).join(', ') };
    }),
  })),
});

/** Adds display names to a plan and any number of results with one lookup. */
export const withNames = async ({ plan = null, results = [] }) => {
  const names = await jira.getDisplayNames([...ownerIds(plan), ...results.flatMap(resultIds)]);
  return {
    plan: plan ? namedPlan(plan, names) : null,
    results: results.map((result) => namedResult(result, names)),
  };
};

export const namePlan = async (plan) => (plan ? (await withNames({ plan })).plan : null);

export const nameResult = async (result) => (result ? (await withNames({ results: [result] })).results[0] : null);
