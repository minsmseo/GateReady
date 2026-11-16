import { DEFAULT_APPROVED_STATES } from '../../domain/ruleTypes.js';
import { locatePage, met, notMet, pageEvidence } from './shared.js';

/**
 * Met when the page's Confluence status is one of the approved statuses.
 * A page with no status at all is treated as not approved.
 */
export const confluencePageApproved = async (requirement, ctx) => {
  const { outcome, page } = await locatePage(requirement, ctx);
  if (outcome) return outcome;

  const configured = (requirement.params.approvedStates || []).filter(Boolean);
  const approved = (configured.length ? configured : DEFAULT_APPROVED_STATES).map((name) => name.toLowerCase());
  const state = await ctx.clients.confluence.getContentState(page.id);

  if (!state) {
    return notMet(`"${page.title}" has no status set, so it is not approved.`, [pageEvidence(page, 'No status')]);
  }
  const evidence = [pageEvidence(page, `Status: ${state.name}`)];
  if (approved.includes(String(state.name).toLowerCase())) {
    return met(`"${page.title}" has status "${state.name}".`, evidence);
  }
  return notMet(`"${page.title}" has status "${state.name}", which is not an approved status.`, evidence);
};
