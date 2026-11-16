/**
 * Reads the heading structure out of a Confluence page body
 * (storage format, which is XHTML).
 */

const HEADING = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;

/** Removes tags and collapses whitespace, leaving readable text. */
export const toPlainText = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Splits a page into sections.
 * @returns {Array<{heading: string, level: number, text: string}>}
 *   `text` is everything between this heading and the next heading of the
 *   same or a higher level, so sub-sections count as content of their parent.
 */
export const extractSections = (storage) => {
  const body = String(storage || '');
  const headings = [];
  let match;
  HEADING.lastIndex = 0;
  while ((match = HEADING.exec(body)) !== null) {
    headings.push({
      level: Number(match[1]),
      heading: toPlainText(match[2]),
      start: match.index,
      contentStart: match.index + match[0].length,
    });
  }

  return headings.map((current, index) => {
    const next = headings.slice(index + 1).find((later) => later.level <= current.level);
    const end = next ? next.start : body.length;
    return {
      heading: current.heading,
      level: current.level,
      text: toPlainText(body.slice(current.contentStart, end)),
    };
  });
};

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Finds the section whose heading matches a required name.
 * A heading matches when it contains the required words, so
 * "3. Failure Modes" satisfies "Failure Mode".
 */
export const findSection = (sections, required) => {
  const wanted = normalize(required);
  if (!wanted) return null;
  return sections.find((section) => normalize(section.heading).includes(wanted)) || null;
};

/** Returns a short excerpt of the page around a required section. */
export const excerpt = (text, maxLength = 600) => {
  const clean = String(text || '');
  return clean.length > maxLength ? `${clean.slice(0, maxLength).trimEnd()}...` : clean;
};
