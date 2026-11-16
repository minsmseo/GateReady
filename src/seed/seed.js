import * as jira from '../clients/jira';
import * as confluence from '../clients/confluence';
import { buildApqpPlan, getPlan, savePlan } from '../data/templates.js';
import { deleteResults } from '../data/results.js';
import { UserError } from '../services/checks.js';
import { DEMO_CURRENT_GATE_INDEX, DEMO_PROJECTS } from './demoData.js';

/**
 * Demo data loader. Creates the two fictional projects described in
 * demoData.js so the whole product can be tried on an empty site.
 *
 * The work is split into small steps because one Forge invocation has a
 * time limit; the admin screen calls the steps one after another. Every
 * step is safe to repeat: it only creates what is missing.
 */

const DAY = 24 * 60 * 60 * 1000;
export const SEED_STEPS = ['jira', 'confluence', 'plan'];

const demoProject = (key) => {
  const project = DEMO_PROJECTS.find((candidate) => candidate.key === key);
  if (!project) throw new UserError(`Unknown demo project ${key}.`);
  return project;
};

const findJiraProject = async (key) => {
  try {
    return await jira.getProject(key);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

/** Runs async work over a list a few items at a time. */
const inBatches = async (items, size, fn) => {
  for (let index = 0; index < items.length; index += size) {
    await Promise.all(items.slice(index, index + size).map(fn));
  }
};

/** What already exists, shown on the admin screen. */
export const getSeedStatus = async () =>
  Promise.all(
    DEMO_PROJECTS.map(async (demo) => {
      const [project, space] = await Promise.all([findJiraProject(demo.key), confluence.getSpaceByKey(demo.key)]);
      const plan = project ? await getPlan(project.id) : null;
      return {
        key: demo.key,
        name: demo.name,
        description: demo.description,
        jira: Boolean(project),
        confluence: Boolean(space),
        plan: Boolean(plan),
      };
    })
  );

const seedJira = async (demo, accountId) => {
  let project = await findJiraProject(demo.key);
  let createdProject = false;
  if (!project) {
    await jira.createProject({
      key: demo.key,
      name: demo.name,
      description: demo.description,
      projectTypeKey: 'software',
      projectTemplateKey: 'com.pyxis.greenhopper.jira:gh-simplified-kanban-classic',
      leadAccountId: accountId,
      assigneeType: 'UNASSIGNED',
    });
    project = await jira.getProject(demo.key);
    createdProject = true;
  }

  const { issues: existing } = await jira.searchIssues(`project = ${project.id}`, { fields: ['summary'] });
  if (existing.length) {
    return `Project ${demo.key} already has work items; none were added.`;
  }

  const issueTypes = await jira.getCreateIssueTypes(project.id);
  const standard = issueTypes.filter((type) => !type.subtask && (type.hierarchyLevel ?? 0) === 0);
  const issueType = standard.find((type) => (type.untranslatedName || type.name) === 'Task') || standard[0];
  if (!issueType) throw new UserError(`Project ${demo.key} has no standard work type.`);

  const created = await jira.createIssuesBulk(
    demo.issues.map((issue) => ({
      project: { id: project.id },
      issuetype: { id: issueType.id },
      summary: issue.summary,
      labels: issue.labels,
      assignee: { accountId },
    }))
  );
  const keys = (created.issues || []).map((issue) => issue.key);
  const doneKeys = keys.filter((_, index) => demo.issues[index].done);
  await inBatches(doneKeys, 5, (key) => jira.transitionToDone(key));

  return `${createdProject ? 'Created' : 'Found'} project ${demo.key} and added ${keys.length} work items.`;
};

const seedConfluence = async (demo) => {
  let space = await confluence.getSpaceByKey(demo.key);
  let createdSpace = false;
  if (!space) {
    await confluence.createSpace({ key: demo.key, name: demo.name, description: demo.description });
    space = await confluence.getSpaceByKey(demo.key);
    createdSpace = true;
  }
  if (!space) throw new UserError(`Confluence space ${demo.key} could not be created.`);

  let createdPages = 0;
  const spaceCache = new Map();
  await inBatches(demo.pages, 3, async (page) => {
    if (!createdSpace) {
      const found = await confluence.findPages({ spaceKey: demo.key, label: page.label }, { limit: 1, spaceCache });
      if (found.length) return;
    }
    const created = await confluence.createPage({ spaceId: space.id, parentId: space.homepageId, title: page.title, storage: page.body });
    await confluence.addLabels(created.id, [page.label]);
    if (page.state) await confluence.setContentState(created.id, page.state);
    createdPages += 1;
  });

  return `${createdSpace ? 'Created' : 'Found'} space ${demo.key} and added ${createdPages} pages.`;
};

const seedPlan = async (demo, accountId) => {
  const project = await findJiraProject(demo.key);
  if (!project) throw new UserError(`Create the Jira project ${demo.key} first.`);

  const owner = { accountId };
  const now = Date.now();

  const plan = buildApqpPlan({ projectId: project.id, projectKey: demo.key, spaceKey: demo.key });
  plan.gates.forEach((gate, index) => {
    // Earlier gates were passed 60 and 30 days ago in this scenario.
    if (index < DEMO_CURRENT_GATE_INDEX) {
      gate.passedOn = new Date(now - (DEMO_CURRENT_GATE_INDEX - index) * 30 * DAY).toISOString();
    }
    gate.requirements.forEach((requirement) => {
      requirement.owner = owner;
    });
  });
  plan.currentGateId = plan.gates[DEMO_CURRENT_GATE_INDEX].id;
  plan.baselineDate = new Date(demo.designChangeDaysAgo === null ? now : now - demo.designChangeDaysAgo * DAY).toISOString();

  await deleteResults(project.id);
  await savePlan(plan, accountId);
  return `Applied the APQP template to ${demo.key} and set the current gate to ${plan.gates[DEMO_CURRENT_GATE_INDEX].name}.`;
};

export const runSeedStep = async ({ projectKey, step, accountId }) => {
  const demo = demoProject(projectKey);
  if (step === 'jira') return seedJira(demo, accountId);
  if (step === 'confluence') return seedConfluence(demo);
  if (step === 'plan') return seedPlan(demo, accountId);
  throw new UserError(`Unknown step ${step}.`);
};
