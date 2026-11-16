import { FRESH_SINCE } from '../../domain/ruleTypes.js';
import { formatDate, locatePage, met, needsReview, notMet, pageEvidence } from './shared.js';

/**
 * Works out which date the page must be newer than.
 * @returns {{ date: string|null, label: string, missing?: string }}
 */
const resolveReference = (params, ctx) => {
  if (params.since === FRESH_SINCE.FIXED_DATE) {
    return { date: params.date || null, label: 'the reference date', missing: 'The rule has no reference date.' };
  }
  if (params.since === FRESH_SINCE.PREVIOUS_GATE) {
    if (!ctx.previousGate) {
      return { date: null, label: 'the previous gate', missing: 'This is the first gate, so there is no previous gate to compare against.' };
    }
    return {
      date: ctx.previousGate.passedOn || null,
      label: `the ${ctx.previousGate.name} gate`,
      missing: `The ${ctx.previousGate.name} gate has no pass date. Set it in GateReady settings.`,
    };
  }
  return {
    date: ctx.baselineDate || null,
    label: 'the last design change',
    missing: 'The project has no last design change date. Set it in GateReady settings.',
  };
};

/**
 * Met when the page was edited on or after the reference date.
 * Catches documents that exist and are approved but describe an older design.
 */
export const confluencePageFresh = async (requirement, ctx) => {
  const { outcome, page } = await locatePage(requirement, ctx);
  if (outcome) return outcome;

  const reference = resolveReference(requirement.params, ctx);
  const referenceTime = Date.parse(reference.date);
  if (!reference.date || Number.isNaN(referenceTime)) {
    return needsReview(reference.missing, [pageEvidence(page)]);
  }

  const editedTime = Date.parse(page.lastModified);
  if (Number.isNaN(editedTime)) {
    return needsReview(`Could not read when "${page.title}" was last edited.`, [pageEvidence(page)]);
  }

  const evidence = [pageEvidence(page, `Last edited ${formatDate(page.lastModified)}`)];
  if (editedTime >= referenceTime) {
    return met(`"${page.title}" was edited after ${reference.label} (${formatDate(reference.date)}).`, evidence);
  }
  return notMet(
    `"${page.title}" was last edited ${formatDate(page.lastModified)}, before ${reference.label} (${formatDate(reference.date)}).`,
    evidence
  );
};
