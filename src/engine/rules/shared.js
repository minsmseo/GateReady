import { VERDICT } from '../../domain/ruleTypes.js';

export const met = (reason, evidence = []) => ({ verdict: VERDICT.MET, reason, evidence });
export const notMet = (reason, evidence = []) => ({ verdict: VERDICT.NOT_MET, reason, evidence });
export const needsReview = (reason, evidence = []) => ({ verdict: VERDICT.NEEDS_REVIEW, reason, evidence });

/** Describes how a rule looks for its page, for use in messages. */
export const describeLocator = (params) => {
  const parts = [];
  if (params.label) parts.push(`label "${params.label}"`);
  if (params.title) parts.push(`title containing "${params.title}"`);
  return parts.join(' and ');
};

export const pageEvidence = (page, detail) => ({
  type: 'confluence_page',
  id: page.id,
  title: page.title,
  url: page.url,
  detail: detail || null,
});

export const issueEvidence = (issue, siteUrl) => ({
  type: 'jira_issue',
  id: issue.key,
  title: `${issue.key} ${issue.summary}`,
  url: siteUrl ? `${siteUrl}/browse/${issue.key}` : null,
  // Results are stored, so no person's name goes in here: only the status
  // and the assignee's account id. The name is looked up when displayed.
  detail: issue.status,
  assigneeId: issue.assigneeId || null,
});

/**
 * Finds the page a Confluence rule refers to.
 * Returns either { page, others } or { outcome } when the rule can already
 * be decided (no space configured, or no page found).
 *
 * When several pages match, the most recently edited one is used and the
 * others are reported so a reviewer can spot duplicates.
 */
export const locatePage = async (requirement, ctx) => {
  const params = requirement.params || {};
  const spaceKey = params.spaceKey || ctx.spaceKey;
  if (!spaceKey) {
    return {
      outcome: needsReview('No Confluence space is linked to this project. Set one in GateReady settings.'),
    };
  }

  const cacheKey = `${spaceKey}|${params.label || ''}|${params.title || ''}`;
  if (!ctx.pageCache.has(cacheKey)) {
    ctx.pageCache.set(cacheKey, ctx.clients.confluence.findPages({ spaceKey, label: params.label, title: params.title }));
  }
  const pages = await ctx.pageCache.get(cacheKey);

  if (!pages.length) {
    return { outcome: notMet(`No page with ${describeLocator(params)} was found in space ${spaceKey}.`) };
  }
  return { page: pages[0], others: pages.slice(1) };
};

/** Formats an ISO timestamp as a plain UTC date and time for messages. */
export const formatDate = (iso) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return `${date.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
};

/**
 * JQL clause that selects one project. The numeric project id is preferred:
 * matching by key or name is ambiguous on some sites (a key can collide with
 * another project's name or a previous key) and was seen to return nothing.
 */
export const projectClause = (projectRef) => {
  const ref = String(projectRef ?? '').trim();
  return /^\d+$/.test(ref) ? `project = ${ref}` : `project = "${ref.replace(/"/g, '')}"`;
};

/**
 * Scopes a user-written JQL filter to one project.
 * Any ORDER BY is dropped because the filter is wrapped in parentheses.
 */
export const scopeJql = (projectRef, jql) => {
  const filter = String(jql || '').replace(/\s+order\s+by\s+[\s\S]*$/i, '').trim();
  return `${projectClause(projectRef)} AND (${filter})`;
};
