import { locatePage, met, pageEvidence } from './shared.js';

/** Met when a page with the given label or title exists in the project space. */
export const confluencePageExists = async (requirement, ctx) => {
  const { outcome, page, others } = await locatePage(requirement, ctx);
  if (outcome) return outcome;

  const note = others.length ? ` ${others.length} other matching page(s) were ignored; the most recent is used.` : '';
  return met(`Found "${page.title}".${note}`, [pageEvidence(page)]);
};
