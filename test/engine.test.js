import test from 'node:test';
import assert from 'node:assert/strict';
import { runGateCheck, summarize } from '../src/engine/evaluate.js';
import { extractSections, findSection } from '../src/engine/sections.js';
import { scopeJql } from '../src/engine/rules/shared.js';
import { validateRequirement } from '../src/domain/ruleTypes.js';
import { buildApqpGates } from '../src/domain/apqpTemplate.js';

// ---------- Test doubles ----------

const page = (overrides = {}) => ({
  id: '100',
  title: 'PFMEA - Housing',
  url: 'https://example.test/wiki/pfmea',
  lastModified: '2026-03-10T09:00:00.000Z',
  labels: ['pfmea'],
  ...overrides,
});

const issue = (key, done, overrides = {}) => ({ key, summary: `Task ${key}`, status: done ? 'Done' : 'To Do', done, assignee: null, ...overrides });

/** Builds fake clients. `pages` maps a label to the pages found for it. */
const fakeClients = ({ pages = {}, states = {}, bodies = {}, issues = [], jiraError, confluenceError } = {}) => {
  const calls = { findPages: 0, searchIssues: [] };
  return {
    calls,
    confluence: {
      findPages: async ({ label, title }) => {
        calls.findPages += 1;
        if (confluenceError) throw confluenceError;
        return pages[label || title] || [];
      },
      getContentState: async (id) => states[id] || null,
      getPageBody: async (id) => ({ id, storage: bodies[id] || '' }),
    },
    jira: {
      searchIssues: async (jql) => {
        calls.searchIssues.push(jql);
        if (jiraError) throw jiraError;
        return { issues, truncated: false };
      },
    },
  };
};

const planWith = (requirements, overrides = {}) => ({
  projectId: '10000',
  projectKey: 'BSH',
  spaceKey: 'BSH',
  baselineDate: '2026-03-01T00:00:00.000Z',
  gates: [
    { id: 'g1', name: 'Product Design', passedOn: '2026-02-01T00:00:00.000Z', requirements: [] },
    { id: 'g2', name: 'Process Design', passedOn: null, requirements: requirements.map((r, i) => ({ id: `r${i}`, owner: null, ...r })) },
  ],
  ...overrides,
});

const check = async (requirement, clientOptions, planOverrides) => {
  const clients = fakeClients(clientOptions);
  const result = await runGateCheck({
    plan: planWith([requirement], planOverrides),
    gateId: 'g2',
    clients,
    siteUrl: 'https://example.test',
    now: new Date('2026-03-15T00:00:00.000Z'),
  });
  return { item: result.items[0], result, clients };
};

// ---------- confluence_page_exists ----------

test('exists: met when a page is found', async () => {
  const { item } = await check(
    { title: 'PFD exists', ruleType: 'confluence_page_exists', params: { label: 'process-flow' } },
    { pages: { 'process-flow': [page({ title: 'Process Flow' })] } }
  );
  assert.equal(item.verdict, 'met');
  assert.equal(item.evidence[0].title, 'Process Flow');
});

test('exists: not met when no page is found', async () => {
  const { item } = await check({ title: 'PFD exists', ruleType: 'confluence_page_exists', params: { label: 'process-flow' } }, {});
  assert.equal(item.verdict, 'not_met');
  assert.match(item.reason, /label "process-flow"/);
});

test('exists: needs review when the project has no Confluence space', async () => {
  const { item } = await check(
    { title: 'PFD exists', ruleType: 'confluence_page_exists', params: { label: 'process-flow' } },
    {},
    { spaceKey: null }
  );
  assert.equal(item.verdict, 'needs_review');
});

// ---------- confluence_page_approved ----------

const approvedRule = { title: 'PFMEA approved', ruleType: 'confluence_page_approved', params: { label: 'pfmea' } };

test('approved: met for an approved status, case-insensitive', async () => {
  const { item } = await check(approvedRule, { pages: { pfmea: [page()] }, states: { 100: { name: 'approved' } } });
  assert.equal(item.verdict, 'met');
});

test('approved: not met for another status', async () => {
  const { item } = await check(approvedRule, { pages: { pfmea: [page()] }, states: { 100: { name: 'In progress' } } });
  assert.equal(item.verdict, 'not_met');
  assert.match(item.reason, /In progress/);
});

test('approved: not met when the page has no status', async () => {
  const { item } = await check(approvedRule, { pages: { pfmea: [page()] } });
  assert.equal(item.verdict, 'not_met');
});

test('approved: honours custom approved statuses', async () => {
  const rule = { ...approvedRule, params: { label: 'pfmea', approvedStates: ['Released'] } };
  const { item } = await check(rule, { pages: { pfmea: [page()] }, states: { 100: { name: 'Released' } } });
  assert.equal(item.verdict, 'met');
});

// ---------- confluence_page_fresh ----------

const freshRule = (since, extra = {}) => ({
  title: 'Control Plan current',
  ruleType: 'confluence_page_fresh',
  params: { label: 'control-plan', since, ...extra },
});

test('fresh: met when edited after the last design change', async () => {
  const { item } = await check(freshRule('design_change'), { pages: { 'control-plan': [page({ lastModified: '2026-03-05T00:00:00.000Z' })] } });
  assert.equal(item.verdict, 'met');
});

test('fresh: not met when edited before the last design change', async () => {
  const { item } = await check(freshRule('design_change'), { pages: { 'control-plan': [page({ lastModified: '2026-02-20T00:00:00.000Z' })] } });
  assert.equal(item.verdict, 'not_met');
  assert.match(item.reason, /before the last design change/);
});

test('fresh: compares against the previous gate pass date', async () => {
  const { item } = await check(freshRule('previous_gate'), { pages: { 'control-plan': [page({ lastModified: '2026-01-15T00:00:00.000Z' })] } });
  assert.equal(item.verdict, 'not_met');
  assert.match(item.reason, /Product Design gate/);
});

test('fresh: needs review when the reference date is not set', async () => {
  const { item } = await check(freshRule('design_change'), { pages: { 'control-plan': [page()] } }, { baselineDate: null });
  assert.equal(item.verdict, 'needs_review');
});

test('fresh: supports a fixed date', async () => {
  const { item } = await check(freshRule('fixed_date', { date: '2026-03-20' }), { pages: { 'control-plan': [page()] } });
  assert.equal(item.verdict, 'not_met');
});

// ---------- confluence_page_sections ----------

const sectionsRule = {
  title: 'PFMEA sections',
  ruleType: 'confluence_page_sections',
  params: { label: 'pfmea', sections: ['Failure Mode', 'Current Controls'] },
};
const filled = '<p>Burrs on the mounting face detected at final inspection.</p>';

test('sections: met when every section exists with content', async () => {
  const body = `<h2>1. Failure Modes</h2>${filled}<h2>Current Controls</h2>${filled}`;
  const { item } = await check(sectionsRule, { pages: { pfmea: [page()] }, bodies: { 100: body } });
  assert.equal(item.verdict, 'met');
});

test('sections: not met and names the missing section', async () => {
  const { item } = await check(sectionsRule, { pages: { pfmea: [page()] }, bodies: { 100: `<h2>Failure Mode</h2>${filled}` } });
  assert.equal(item.verdict, 'not_met');
  assert.match(item.reason, /Current Controls/);
});

test('sections: needs review when a required section is empty', async () => {
  const body = `<h2>Failure Mode</h2>${filled}<h2>Current Controls</h2><p>TBD</p>`;
  const { item } = await check(sectionsRule, { pages: { pfmea: [page()] }, bodies: { 100: body } });
  assert.equal(item.verdict, 'needs_review');
});

test('sections: sub-sections count as content of their parent', () => {
  const sections = extractSections(`<h1>Risk</h1><h2>Failure Mode</h2>${filled}<h1>Next</h1>`);
  assert.ok(findSection(sections, 'Risk').text.includes('Burrs'));
  assert.equal(findSection(sections, 'Next').text, '');
});

// ---------- jira_query_all_done ----------

const allDoneRule = { title: 'Tasks done', ruleType: 'jira_query_all_done', params: { jql: 'labels = gate-3' } };

test('all done: met when every work item is done', async () => {
  const { item, clients } = await check(allDoneRule, { issues: [issue('BSH-1', true), issue('BSH-2', true)] });
  assert.equal(item.verdict, 'met');
  // Scoped by project id, not key.
  assert.equal(clients.calls.searchIssues[0], 'project = 10000 AND (labels = gate-3)');
});

test('all done: not met and lists the open work items', async () => {
  const { item } = await check(allDoneRule, { issues: [issue('BSH-1', true), issue('BSH-2', false)] });
  assert.equal(item.verdict, 'not_met');
  assert.equal(item.evidence.length, 1);
  assert.equal(item.evidence[0].url, 'https://example.test/browse/BSH-2');
});

test('stored results hold account ids, never names', async () => {
  const rule = { ...allDoneRule, owner: { accountId: 'acc-1', displayName: 'Dana Example' } };
  const { result } = await check(rule, { issues: [issue('BSH-2', false, { assignee: 'Sam Example', assigneeId: 'acc-2' })] });
  const stored = JSON.stringify(result);
  assert.ok(!stored.includes('Dana Example'));
  assert.ok(!stored.includes('Sam Example'));
  assert.deepEqual(result.items[0].owner, { accountId: 'acc-1' });
  assert.equal(result.items[0].evidence[0].assigneeId, 'acc-2');
});

test('all done: needs review when nothing matches', async () => {
  const { item } = await check(allDoneRule, { issues: [] });
  assert.equal(item.verdict, 'needs_review');
});

// ---------- jira_query_none_open ----------

const noneOpenRule = { title: 'No high risk', ruleType: 'jira_query_none_open', params: { jql: 'labels = high-risk AND statusCategory != Done' } };

test('none open: met when the filter returns nothing', async () => {
  const { item } = await check(noneOpenRule, { issues: [] });
  assert.equal(item.verdict, 'met');
});

test('none open: not met when work items match', async () => {
  const { item } = await check(noneOpenRule, { issues: [issue('BSH-7', false), issue('BSH-8', false)] });
  assert.equal(item.verdict, 'not_met');
  assert.equal(item.evidence.length, 2);
});

// ---------- Engine behaviour ----------

test('a permission error becomes needs review, never not met', async () => {
  const error = Object.assign(new Error('forbidden'), { status: 403 });
  const { item } = await check(approvedRule, { confluenceError: error });
  assert.equal(item.verdict, 'needs_review');
  assert.match(item.reason, /permission/);
});

test('an invalid JQL becomes needs review with a hint', async () => {
  const error = Object.assign(new Error('bad request'), { status: 400 });
  const { item } = await check(allDoneRule, { jiraError: error });
  assert.equal(item.verdict, 'needs_review');
  assert.match(item.reason, /JQL/);
});

test('an incomplete requirement is reported instead of evaluated', async () => {
  const { item, clients } = await check({ title: 'Broken', ruleType: 'confluence_page_exists', params: {} }, {});
  assert.equal(item.verdict, 'needs_review');
  assert.equal(clients.calls.findPages, 0);
});

test('rules on the same page share one search', async () => {
  const clients = fakeClients({ pages: { pfmea: [page()] }, states: { 100: { name: 'Approved' } } });
  await runGateCheck({
    plan: planWith([approvedRule, { title: 'PFMEA exists', ruleType: 'confluence_page_exists', params: { label: 'pfmea' } }]),
    gateId: 'g2',
    clients,
  });
  assert.equal(clients.calls.findPages, 1);
});

test('summary counts verdicts and computes readiness', () => {
  const summary = summarize([{ verdict: 'met' }, { verdict: 'met' }, { verdict: 'not_met' }, { verdict: 'needs_review' }]);
  assert.deepEqual(summary, { total: 4, met: 2, notMet: 1, needsReview: 1, readiness: 50 });
  assert.equal(summarize([]).readiness, 0);
});

test('unknown gate id is rejected', async () => {
  await assert.rejects(() => runGateCheck({ plan: planWith([]), gateId: 'nope', clients: fakeClients() }));
});

// ---------- Helpers ----------

test('scopeJql drops ORDER BY and scopes to the project', () => {
  assert.equal(scopeJql('10203', 'labels = x order by created desc'), 'project = 10203 AND (labels = x)');
  assert.equal(scopeJql('EVB', 'labels = x'), 'project = "EVB" AND (labels = x)');
});

test('validateRequirement explains what is missing', () => {
  assert.deepEqual(validateRequirement({ title: 'ok', ruleType: 'jira_query_all_done', params: { jql: 'labels = a' } }), []);
  assert.equal(validateRequirement({ title: '', ruleType: 'jira_query_all_done', params: {} }).length, 2);
  assert.equal(validateRequirement({ title: 'x', ruleType: 'confluence_page_sections', params: { label: 'a', sections: [] } }).length, 1);
});

test('the built-in APQP template is valid and has five gates', () => {
  const gates = buildApqpGates();
  assert.equal(gates.length, 5);
  for (const gate of gates) {
    for (const requirement of gate.requirements) {
      assert.deepEqual(validateRequirement(requirement), [], `${gate.name}: ${requirement.title}`);
    }
  }
  assert.notEqual(buildApqpGates()[0].id, gates[0].id);
});
