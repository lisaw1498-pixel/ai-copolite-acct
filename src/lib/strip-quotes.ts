/**
 * Removes one layer of quotation marks wrapping an entire value.
 *
 * Text pasted in from a document often arrives wrapped in the quotes that
 * surrounded it there. Stored that way it shows up quoted everywhere the value
 * is displayed or spoken, as if the candidate were quoting someone else.
 *
 * The conservative part is what it refuses to touch. A value like
 * `"Yes" is not an answer` opens and closes with a quote without being wrapped
 * in one, and stripping the ends would corrupt it - so a match only counts
 * when the quote characters are a genuine pair around the whole string and the
 * text between them contains no unmatched partner. Apostrophes are left alone
 * entirely: "I'd" and "didn't" are far more common than a value meaningfully
 * wrapped in single quotes, and getting that wrong mangles real words.
 */
const PAIRS: [string, string][] = [
  ['"', '"'],
  ["“", "”"], // curly double quotes
  ["«", "»"], // guillemets
];

export function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length < 2) return value;

  for (const [open, close] of PAIRS) {
    if (!trimmed.startsWith(open) || !trimmed.endsWith(close)) continue;
    const interior = trimmed.slice(open.length, trimmed.length - close.length);
    // An interior copy of either half means these two are not a pair around
    // the whole value.
    if (interior.includes(open) || interior.includes(close)) continue;
    return interior.trim();
  }

  return value;
}

/** Same, for a value that may be null or undefined. */
export function stripWrappingQuotesMaybe<T extends string | null | undefined>(value: T): T {
  if (typeof value !== "string") return value;
  return stripWrappingQuotes(value) as T;
}
