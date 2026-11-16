import { route } from '@forge/api';
import { send } from './http';

/** A space with more pages than this is only partly scanned. */
const MAX_SPACE_PAGES = 1000;
const PAGE_SIZE = 250;

/** Pulls the paging cursor out of a v2 "next" link. */
const nextCursor = (data) => {
  const next = data?._links?.next;
  if (!next) return null;
  const match = /[?&]cursor=([^&]+)/.exec(next);
  return match ? decodeURIComponent(match[1]) : null;
};

const toPage = (page, base) => ({
  id: page.id,
  title: page.title,
  url: page._links?.webui ? `${base}${page._links.webui}` : null,
  lastModified: page.version?.createdAt || null,
  version: page.version?.number || null,
});

/** Reads every result of a paged v2 list, up to MAX_SPACE_PAGES. */
const readAll = async (as, firstRoute, nextRoute) => {
  const pages = [];
  let data = await send('confluence', as, firstRoute);
  for (;;) {
    const base = data._links?.base || '';
    pages.push(...(data.results || []).map((page) => toPage(page, base)));
    const cursor = nextCursor(data);
    if (!cursor || pages.length >= MAX_SPACE_PAGES) break;
    data = await send('confluence', as, nextRoute(cursor));
  }
  return pages;
};

/**
 * Everything one check needs to know about a space, loaded lazily and only
 * once: the space id, the labels used in it, and page listings.
 *
 * These calls read live content lists, not the search index. The search
 * index lags behind edits, and a readiness check must see a document the
 * moment it is created, labelled or updated.
 */
const openSpace = (spaceKey, as) => {
  const memo = new Map();
  const once = (key, load) => {
    if (!memo.has(key)) memo.set(key, load());
    return memo.get(key);
  };

  const space = () => once('space', () => getSpaceByKey(spaceKey, { as }));

  const labelIds = () =>
    once('labels', async () => {
      const found = await space();
      if (!found) return new Map();
      const data = await send('confluence', as, route`/wiki/api/v2/spaces/${found.id}/content/labels?limit=${PAGE_SIZE}`);
      return new Map((data.results || []).map((label) => [String(label.name).toLowerCase(), label.id]));
    });

  const allPages = () =>
    once('pages', async () => {
      const found = await space();
      if (!found) return [];
      return readAll(
        as,
        route`/wiki/api/v2/spaces/${found.id}/pages?status=current&limit=${PAGE_SIZE}`,
        (cursor) => route`/wiki/api/v2/spaces/${found.id}/pages?status=current&limit=${PAGE_SIZE}&cursor=${cursor}`
      );
    });

  const pagesWithLabel = (label) =>
    once(`label:${label}`, async () => {
      const [found, ids] = await Promise.all([space(), labelIds()]);
      const labelId = ids.get(label);
      if (!found || !labelId) return [];
      return readAll(
        as,
        route`/wiki/api/v2/labels/${labelId}/pages?space-id=${found.id}&limit=${PAGE_SIZE}`,
        (cursor) => route`/wiki/api/v2/labels/${labelId}/pages?space-id=${found.id}&limit=${PAGE_SIZE}&cursor=${cursor}`
      );
    });

  return { allPages, pagesWithLabel };
};

/**
 * Finds pages in a space by label and/or title fragment (both
 * case-insensitive; the title only has to contain the fragment).
 * At least one of `label` or `title` must be given, otherwise every page
 * in the space would count as evidence.
 *
 * `spaceCache` (a Map) lets one check load each space only once. It must be
 * created per check and never shared between users, because the listing
 * reflects what the current user is allowed to see.
 *
 * @returns {Array<{id, title, url, lastModified, version}>} newest first
 */
export const findPages = async ({ spaceKey, label, title }, { as = 'user', limit = 10, spaceCache } = {}) => {
  const wantedLabel = String(label || '').trim().toLowerCase();
  const wantedTitle = String(title || '').trim().toLowerCase();
  if (!wantedLabel && !wantedTitle) return [];

  let space = spaceCache?.get(spaceKey);
  if (!space) {
    space = openSpace(spaceKey, as);
    spaceCache?.set(spaceKey, space);
  }
  const pages = wantedLabel ? await space.pagesWithLabel(wantedLabel) : await space.allPages();
  return pages
    .filter((page) => !wantedTitle || page.title.toLowerCase().includes(wantedTitle))
    .sort((a, b) => Date.parse(b.lastModified || 0) - Date.parse(a.lastModified || 0))
    .slice(0, limit);
};

const readContentState = async (pageId, as) => {
  const data = await send('confluence', as, route`/wiki/rest/api/content/${pageId}/state`);
  const state = data?.contentState;
  return state ? { id: state.id, name: state.name, color: state.color, lastUpdated: data.lastUpdated || null } : null;
};

/**
 * Returns the page's status ("In progress", "Approved", ...) or null when
 * the page has no status set.
 *
 * Confluence translates its built-in status names into the language of
 * whoever asks, so the same page reads "Verified" for one user and a
 * translated name for another. To judge every user the same way, the status
 * is read with the app's identity, which is not tied to a personal language.
 * Callers only pass pages the current user has already been able to list,
 * so this does not reveal anything they could not see. If the app itself
 * cannot read the page (restricted space), the user's own view is used.
 */
export const getContentState = async (pageId, { as = 'user' } = {}) => {
  if (as === 'user') {
    try {
      return await readContentState(pageId, 'app');
    } catch (error) {
      if (!error.status) throw error;
    }
  }
  return readContentState(pageId, as);
};

/** Returns the page body in storage format (XHTML) plus basic metadata. */
export const getPageBody = async (pageId, { as = 'user' } = {}) => {
  const page = await send('confluence', as, route`/wiki/api/v2/pages/${pageId}?body-format=storage`);
  return {
    id: page.id,
    title: page.title,
    spaceId: page.spaceId,
    lastModified: page.version?.createdAt || null,
    version: page.version?.number || null,
    storage: page.body?.storage?.value || '',
  };
};

/** Looks up a space by key. Returns null when it does not exist or is hidden. */
export const getSpaceByKey = async (spaceKey, { as = 'user' } = {}) => {
  const data = await send('confluence', as, route`/wiki/api/v2/spaces?keys=${spaceKey}&limit=1`);
  const space = data.results?.[0];
  return space ? { id: space.id, key: space.key, name: space.name, homepageId: space.homepageId } : null;
};

// ----- Used only by the demo data loader -----

export const createSpace = ({ key, name, description }, { as = 'user' } = {}) =>
  send('confluence', as, route`/wiki/rest/api/space`, {
    method: 'POST',
    body: { key, name, description: { plain: { value: description || '', representation: 'plain' } } },
  });

export const addLabels = (pageId, labels, { as = 'user' } = {}) =>
  send('confluence', as, route`/wiki/rest/api/content/${pageId}/label`, {
    method: 'POST',
    body: labels.map((name) => ({ prefix: 'global', name })),
  });

export const setContentState = (pageId, { name, color }, { as = 'user' } = {}) =>
  send('confluence', as, route`/wiki/rest/api/content/${pageId}/state?status=current`, {
    method: 'PUT',
    body: { name, color },
  });

/** Creates a page (used for the gate review summary draft). */
export const createPage = async ({ spaceId, parentId, title, storage, draft = false }, { as = 'user' } = {}) => {
  const page = await send('confluence', as, route`/wiki/api/v2/pages`, {
    method: 'POST',
    body: {
      spaceId,
      parentId,
      status: draft ? 'draft' : 'current',
      title,
      body: { representation: 'storage', value: storage },
    },
  });
  const base = page._links?.base || '';
  const path = draft ? page._links?.editui : page._links?.webui;
  return { id: page.id, title: page.title, url: path ? `${base}${path}` : null };
};
