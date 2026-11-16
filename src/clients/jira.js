import { route } from '@forge/api';
import { send } from './http';

/** Hard cap so a broad JQL cannot make one check run for minutes. */
const MAX_ISSUES = 500;
const PAGE_SIZE = 100;

/**
 * Runs a JQL search and returns a flat list of issues.
 * Uses the token-paginated search endpoint and stops at MAX_ISSUES.
 *
 * @returns {{ issues: Array, truncated: boolean }}
 */
export const searchIssues = async (jql, { as = 'user', fields = ['summary', 'status', 'assignee', 'priority'] } = {}) => {
  const issues = [];
  let nextPageToken;
  let truncated = false;

  do {
    const page = await send('jira', as, route`/rest/api/3/search/jql`, {
      method: 'POST',
      body: { jql, fields, maxResults: PAGE_SIZE, nextPageToken },
    });
    issues.push(...(page.issues || []));
    nextPageToken = page.nextPageToken;
    if (issues.length >= MAX_ISSUES && nextPageToken) {
      truncated = true;
      break;
    }
  } while (nextPageToken);

  return { issues: issues.map(toIssue), truncated };
};

/** Reduces a Jira issue to the fields GateReady shows and reasons about. */
const toIssue = (issue) => ({
  id: issue.id,
  key: issue.key,
  summary: issue.fields?.summary || '',
  status: issue.fields?.status?.name || '',
  // "done" is Jira's own category for finished work, independent of the
  // status name a team picked ("Closed", "Released", ...).
  done: issue.fields?.status?.statusCategory?.key === 'done',
  assignee: issue.fields?.assignee?.displayName || null,
  priority: issue.fields?.priority?.name || null,
});

export const getProject = (projectIdOrKey, { as = 'user' } = {}) =>
  send('jira', as, route`/rest/api/3/project/${projectIdOrKey}`);

export const createIssue = (fields, { as = 'user' } = {}) =>
  send('jira', as, route`/rest/api/3/issue`, { method: 'POST', body: { fields } });

/** Issue types that can be created in a project (used to pick "Task"). */
export const getCreateIssueTypes = async (projectIdOrKey, { as = 'user' } = {}) => {
  const data = await send('jira', as, route`/rest/api/3/issue/createmeta/${projectIdOrKey}/issuetypes`);
  return data.issueTypes || data.values || [];
};

/**
 * Checks the current user's permissions. Pass a projectId for project
 * permissions (e.g. ADMINISTER_PROJECTS); omit it for global ones (ADMINISTER).
 * @returns {Object<string, boolean>}
 */
export const getMyPermissions = async (permissions, { projectId, as = 'user' } = {}) => {
  const list = permissions.join(',');
  const data = projectId
    ? await send('jira', as, route`/rest/api/3/mypermissions?permissions=${list}&projectId=${projectId}`)
    : await send('jira', as, route`/rest/api/3/mypermissions?permissions=${list}`);
  return Object.fromEntries(permissions.map((name) => [name, Boolean(data.permissions?.[name]?.havePermission)]));
};

/** Base URL of the site, for building links where no page context exists. */
export const getSiteUrl = async ({ as = 'user' } = {}) => {
  const info = await send('jira', as, route`/rest/api/3/serverInfo`);
  return String(info.baseUrl || '').replace(/\/$/, '');
};

export const getMyself =({ as = 'user' } = {}) => send('jira', as, route`/rest/api/3/myself`);

// ----- Used only by the demo data loader -----

export const createProject = (body, { as = 'user' } = {}) =>
  send('jira', as, route`/rest/api/3/project`, { method: 'POST', body });

export const createIssuesBulk = (issueFields, { as = 'user' } = {}) =>
  send('jira', as, route`/rest/api/3/issue/bulk`, {
    method: 'POST',
    body: { issueUpdates: issueFields.map((fields) => ({ fields })) },
  });

/** Moves a work item to the first available status in the "done" category. */
export const transitionToDone = async (issueKey, { as = 'user' } = {}) => {
  const data = await send('jira', as, route`/rest/api/3/issue/${issueKey}/transitions`);
  const done = (data.transitions || []).find((transition) => transition.to?.statusCategory?.key === 'done');
  if (!done) return false;
  await send('jira', as, route`/rest/api/3/issue/${issueKey}/transitions`, { method: 'POST', body: { transition: { id: done.id } } });
  return true;
};

/** Users who can be assigned issues in a project, filtered by a name query. */
export const findAssignableUsers = (projectKey, query, { as = 'user' } = {}) =>
  send('jira', as, route`/rest/api/3/user/assignable/search?project=${projectKey}&query=${query}&maxResults=10`);
