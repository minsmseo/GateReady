import { get, set, remove, listByPrefix } from './store.js';
import { APQP_TEMPLATE_NAME, buildApqpGates } from '../domain/apqpTemplate.js';
import { RULE_TYPES, newId, validateRequirement } from '../domain/ruleTypes.js';

/**
 * A "plan" is a gate template applied to one Jira project: the ordered
 * gates, each gate's evidence requirements, and the project settings the
 * rules need (linked Confluence space, last design change date).
 */

const planKey = (projectId) => `plan:${projectId}`;

export const getPlan = (projectId) => get(planKey(projectId));

export const deletePlan = (projectId) => remove(planKey(projectId));

/** Every project that has a plan, for "copy from another project". */
export const listPlans = async () => (await listByPrefix('plan:')).map((entry) => entry.value);

/** Creates a new plan from the built-in APQP template. */
export const buildApqpPlan = ({ projectId, projectKey, spaceKey = null }) => {
  const gates = buildApqpGates();
  return {
    projectId: String(projectId),
    projectKey,
    templateName: APQP_TEMPLATE_NAME,
    spaceKey,
    baselineDate: null,
    currentGateId: gates[0].id,
    gates,
  };
};

/** Copies another project's gates into a new plan with fresh ids and no dates. */
export const copyPlan = (source, { projectId, projectKey }) => {
  const gates = source.gates.map((gate) => ({
    ...gate,
    id: newId('gate'),
    passedOn: null,
    requirements: gate.requirements.map((requirement) => ({
      ...requirement,
      id: newId('req'),
      params: { ...requirement.params },
    })),
  }));
  return {
    projectId: String(projectId),
    projectKey,
    templateName: `Copied from ${source.projectKey}`,
    spaceKey: null,
    baselineDate: null,
    currentGateId: gates[0]?.id || null,
    gates,
  };
};

const text = (value, max) => String(value ?? '').trim().slice(0, max);
const isoOrNull = (value) => (value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : null);

/**
 * Rebuilds a plan from untrusted input (the settings screen), keeping only
 * known fields. Returns { plan, problems }.
 */
export const sanitizePlan = (input, { projectId, projectKey }) => {
  const problems = [];
  const gates = (Array.isArray(input?.gates) ? input.gates : []).map((gate, gateIndex) => {
    const name = text(gate.name, 80);
    if (!name) problems.push(`Gate ${gateIndex + 1} needs a name.`);
    const requirements = (Array.isArray(gate.requirements) ? gate.requirements : []).map((requirement) => {
      const params = requirement.params || {};
      const clean = {
        id: text(requirement.id, 40) || newId('req'),
        title: text(requirement.title, 160),
        ruleType: RULE_TYPES[requirement.ruleType] ? requirement.ruleType : '',
        params: {
          label: text(params.label, 80) || undefined,
          title: text(params.title, 160) || undefined,
          spaceKey: text(params.spaceKey, 40) || undefined,
          jql: text(params.jql, 1000) || undefined,
          since: text(params.since, 30) || undefined,
          date: isoOrNull(params.date) || undefined,
          sections: Array.isArray(params.sections) ? params.sections.map((s) => text(s, 80)).filter(Boolean).slice(0, 30) : undefined,
          approvedStates: Array.isArray(params.approvedStates)
            ? params.approvedStates.map((s) => text(s, 40)).filter(Boolean).slice(0, 10)
            : undefined,
        },
        owner: requirement.owner?.accountId
          ? { accountId: text(requirement.owner.accountId, 128), displayName: text(requirement.owner.displayName, 120) }
          : null,
      };
      // JSON storage drops undefined, but strip here so tests and callers see a clean object.
      Object.keys(clean.params).forEach((key) => clean.params[key] === undefined && delete clean.params[key]);
      for (const problem of validateRequirement(clean)) {
        problems.push(`${name || `Gate ${gateIndex + 1}`} / ${clean.title || 'untitled requirement'}: ${problem}`);
      }
      return clean;
    });
    return {
      id: text(gate.id, 40) || newId('gate'),
      name,
      description: text(gate.description, 300),
      passedOn: isoOrNull(gate.passedOn),
      requirements,
    };
  });

  if (!gates.length) problems.push('Add at least one gate.');
  if (gates.length > 20) problems.push('A plan can have at most 20 gates.');

  const currentGateId = gates.some((gate) => gate.id === input?.currentGateId) ? input.currentGateId : gates[0]?.id || null;
  const plan = {
    projectId: String(projectId),
    projectKey,
    templateName: text(input?.templateName, 80) || 'Custom',
    spaceKey: text(input?.spaceKey, 40) || null,
    baselineDate: isoOrNull(input?.baselineDate),
    currentGateId,
    gates,
  };
  return { plan, problems };
};

export const savePlan = async (plan, accountId) => {
  const stored = { ...plan, updatedAt: new Date().toISOString(), updatedBy: accountId || null };
  await set(planKey(plan.projectId), stored);
  return stored;
};
