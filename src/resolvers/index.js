import Resolver from '@forge/resolver';
import * as jira from '../clients/jira';
import * as confluence from '../clients/confluence';
import { buildApqpPlan, copyPlan, getPlan, listPlans, sanitizePlan, savePlan } from '../data/templates.js';
import { checkGate, getProjectStatus, passGate, UserError } from '../services/checks.js';
import { createGapIssues } from '../services/gaps.js';
import { namePlan } from '../services/people.js';
import { getSeedStatus, runSeedStep, SEED_STEPS } from '../seed/seed.js';

const resolver = new Resolver();

/**
 * Wraps a resolver so the UI always gets { ok, data } or { ok, error }.
 * Expected problems carry a readable message; anything else is logged and
 * reported generically so internals are never shown to the user.
 */
const define = (name, fn) =>
  resolver.define(name, async (request) => {
    try {
      return { ok: true, data: await fn(request) };
    } catch (error) {
      if (error instanceof UserError) {
        return { ok: false, error: { code: error.code, message: error.message } };
      }
      if (error.status === 401 || error.status === 403) {
        return { ok: false, error: { code: 'forbidden', message: 'You do not have permission to do this.' } };
      }
      console.error(`Resolver ${name} failed: ${error.status || ''} ${error.message}`);
      return { ok: false, error: { code: 'unexpected', message: 'Something went wrong. Try again in a moment.' } };
    }
  });

/** The project always comes from the page context, never from the payload. */
const projectOf = (context) => {
  const project = context.extension?.project;
  if (!project?.id) throw new UserError('GateReady must be opened from a Jira project.', 'no_project');
  return { projectId: String(project.id), projectKey: project.key };
};

/**
 * Project administrators can edit the gate plan. Jira administrators can
 * too: they can open every project's settings even when the project's
 * permission scheme does not list them as project administrators.
 */
const canAdministerProject = async (projectId) => {
  const permissions = await jira.getMyPermissions(['ADMINISTER_PROJECTS', 'ADMINISTER'], { projectId });
  return permissions.ADMINISTER_PROJECTS || permissions.ADMINISTER;
};

const requireProjectAdmin = async (projectId) => {
  if (!(await canAdministerProject(projectId))) {
    throw new UserError('Only project administrators can change the gate plan.', 'forbidden');
  }
};

const requireSiteAdmin = async () => {
  if (!(await jira.getMyPermissions(['ADMINISTER'])).ADMINISTER) {
    throw new UserError('Only Jira administrators can load demo data.', 'forbidden');
  }
};

// ----- Dashboard -----

define('getStatus', async ({ context }) => {
  const { projectId, projectKey } = projectOf(context);
  const [status, canEdit] = await Promise.all([getProjectStatus(projectId), canAdministerProject(projectId)]);
  return { ...status, projectKey, canEdit, siteUrl: context.siteUrl };
});

define('runCheck', async ({ payload, context }) => {
  const { projectId } = projectOf(context);
  return checkGate({ projectId, gateRef: payload.gateId, accountId: context.accountId, siteUrl: context.siteUrl });
});

define('passGate', async ({ payload, context }) => {
  const { projectId } = projectOf(context);
  await requireProjectAdmin(projectId);
  return passGate({ projectId, gateRef: payload.gateId, accountId: context.accountId });
});

define('createGapIssues', async ({ payload, context }) => {
  const { projectId } = projectOf(context);
  return createGapIssues({
    projectId,
    gateRef: payload.gateId,
    requirementIds: Array.isArray(payload.requirementIds) ? payload.requirementIds : undefined,
    siteUrl: context.siteUrl,
  });
});

// ----- Settings -----

define('getSettings', async ({ context }) => {
  const { projectId, projectKey } = projectOf(context);
  const [plan, canEdit, plans] = await Promise.all([getPlan(projectId), canAdministerProject(projectId), listPlans()]);
  const otherProjects = plans
    .filter((other) => other.projectId !== projectId)
    .map((other) => ({ projectId: other.projectId, projectKey: other.projectKey, gates: other.gates.length }));
  return { plan: await namePlan(plan), projectKey, canEdit, otherProjects };
});

define('loadTemplate', async ({ payload, context }) => {
  const project = projectOf(context);
  await requireProjectAdmin(project.projectId);
  const existing = await getPlan(project.projectId);

  let plan;
  if (payload.source === 'apqp') {
    plan = buildApqpPlan(project);
  } else {
    const source = await getPlan(String(payload.source));
    if (!source) throw new UserError('The project to copy from no longer has a gate plan.');
    plan = copyPlan(source, project);
  }
  // Keep the project's own settings when replacing the gates.
  if (existing) {
    plan.spaceKey = existing.spaceKey;
    plan.baselineDate = existing.baselineDate;
  }
  return namePlan(await savePlan(plan, context.accountId));
});

define('savePlan', async ({ payload, context }) => {
  const project = projectOf(context);
  await requireProjectAdmin(project.projectId);
  const { plan, problems } = sanitizePlan(payload.plan, project);
  if (problems.length) throw new UserError(problems.slice(0, 5).join(' '), 'invalid_plan');
  return namePlan(await savePlan(plan, context.accountId));
});

define('checkSpace', async ({ payload }) => {
  const key = String(payload.spaceKey || '').trim();
  if (!key) return { found: false };
  const space = await confluence.getSpaceByKey(key);
  return space ? { found: true, name: space.name, key: space.key } : { found: false };
});

// ----- Demo data (Jira admin page) -----

define('getSeedStatus', async () => {
  await requireSiteAdmin();
  return { projects: await getSeedStatus(), steps: SEED_STEPS };
});

define('runSeedStep', async ({ payload, context }) => {
  await requireSiteAdmin();
  const message = await runSeedStep({ projectKey: payload.projectKey, step: payload.step, accountId: context.accountId });
  return { message };
});

export const handler = resolver.getDefinitions();
