import * as jira from '../clients/jira';
import { UserError } from '../services/checks.js';
import { VERDICT_LABEL } from '../domain/ruleTypes.js';

/**
 * Shared plumbing for Rovo agent actions.
 *
 * Inputs are extracted from the conversation by a language model, so they
 * are treated as untrusted hints. Every action resolves the project by
 * calling Jira as the current user: if that user cannot see the project,
 * Jira refuses and the action stops. No input can widen access.
 */

/** Resolves the project from the input, or from where the chat was opened. */
export const resolveProject = async (payload) => {
  const key = String(payload?.projectKey || payload?.context?.jira?.projectKey || '').trim().toUpperCase();
  if (!key) {
    throw new UserError('Which Jira project should I look at? Give me the project key, for example BSH.', 'no_project');
  }
  if (!/^[A-Z][A-Z0-9_]{1,19}$/.test(key)) {
    throw new UserError(`"${key}" is not a valid Jira project key.`, 'no_project');
  }
  try {
    const [project, siteUrl] = await Promise.all([jira.getProject(key), jira.getSiteUrl()]);
    return { projectId: String(project.id), projectKey: project.key, projectName: project.name, siteUrl };
  } catch (error) {
    if (error.status === 404 || error.status === 403 || error.status === 401) {
      throw new UserError(`Project ${key} does not exist or you do not have access to it.`, 'no_project');
    }
    throw error;
  }
};

/**
 * Wraps an action handler. Expected problems come back as { error } so the
 * agent can explain them; unexpected ones are logged and reported generically.
 */
export const action = (name, fn) => async (payload, context) => {
  try {
    return await fn(payload || {}, context || {});
  } catch (error) {
    if (error instanceof UserError) return { error: error.message };
    if (error.status === 401 || error.status === 403) {
      return { error: 'The current user does not have permission to do this in Jira or Confluence.' };
    }
    console.error(`Action ${name} failed: ${error.status || ''} ${error.message}`);
    return { error: 'GateReady could not complete this action because of an unexpected error. Try again.' };
  }
};

/** Compact, agent-friendly view of one judged requirement. */
export const presentItem = (item, gapLink, siteUrl) => ({
  requirement: item.title,
  verdict: VERDICT_LABEL[item.verdict] || item.verdict,
  finding: item.reason,
  owner: item.owner?.displayName || 'No owner',
  evidence: (item.evidence || []).map((evidence) => ({ title: evidence.title, url: evidence.url, detail: evidence.detail })),
  gapWorkItem: gapLink ? { key: gapLink.issueKey, url: `${siteUrl}/browse/${gapLink.issueKey}` } : null,
});

export const presentSummary = (summary) => ({
  readinessPercent: summary.readiness,
  met: summary.met,
  notMet: summary.notMet,
  needsReview: summary.needsReview,
  total: summary.total,
});

export const VERDICT_NOTE =
  'Verdicts are computed by deterministic rules from live Jira and Confluence data. Report them as they are; do not change or soften a verdict.';
