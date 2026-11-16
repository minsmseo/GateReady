import { extractSections, findSection } from '../sections.js';
import { locatePage, met, needsReview, notMet, pageEvidence } from './shared.js';

/** A section with less text than this is treated as an empty placeholder. */
const MIN_SECTION_CHARS = 20;

/**
 * Met when every required section heading is present and has content.
 * - A missing heading is a clear failure (not met).
 * - A heading that is present but empty needs a human to look (needs review):
 *   the structure is there, the content is not.
 */
export const confluencePageSections = async (requirement, ctx) => {
  const { outcome, page } = await locatePage(requirement, ctx);
  if (outcome) return outcome;

  const required = (requirement.params.sections || []).map((name) => String(name).trim()).filter(Boolean);
  const body = await ctx.clients.confluence.getPageBody(page.id);
  const sections = extractSections(body.storage);

  const missing = [];
  const empty = [];
  for (const name of required) {
    const section = findSection(sections, name);
    if (!section) missing.push(name);
    else if (section.text.length < MIN_SECTION_CHARS) empty.push(name);
  }

  if (missing.length) {
    return notMet(
      `"${page.title}" is missing ${missing.length} of ${required.length} required sections: ${missing.join(', ')}.`,
      [pageEvidence(page, `Missing: ${missing.join(', ')}`)]
    );
  }
  if (empty.length) {
    return needsReview(
      `"${page.title}" has all required sections, but these have no content yet: ${empty.join(', ')}.`,
      [pageEvidence(page, `Empty: ${empty.join(', ')}`)]
    );
  }
  return met(`"${page.title}" contains all ${required.length} required sections.`, [pageEvidence(page)]);
};
