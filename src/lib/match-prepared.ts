// Matching a spoken interview question back to one the candidate prepared.
//
// The mock interviewer asks the candidate's own questions, but it says them
// aloud: it reacts to the previous answer first, softens the opening, drops a
// question mark. "What do you know about Carrum Health?" comes out as "Got it.
// So what do you know about us here at Carrum Health?". A string comparison
// misses that, and the candidate is shown a freshly generated answer instead
// of the one they wrote and approved.
//
// Getting this wrong in the other direction is worse than missing a match: the
// prepared questions overlap heavily ("What is a bundled payment?" against "Do
// you have experience with bundled payments?"), and showing the answer to the
// wrong question mid-interview is actively misleading. So the scoring is
// symmetric and the best match has to beat the runner-up by a clear margin.

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "if", "then", "so", "as", "of", "to", "in", "on", "at",
  "for", "with", "about", "into", "over", "is", "are", "was", "were", "be", "been", "being", "do",
  "does", "did", "have", "has", "had", "can", "could", "would", "should", "will", "shall", "may",
  "might", "must", "i", "you", "your", "we", "our", "us", "me", "my", "it", "its", "this", "that",
  "these", "those", "there", "here", "what", "how", "why", "when", "which", "who", "whom", "tell",
  "give", "walk", "through", "me", "please", "just", "really", "okay", "ok", "right", "well", "now",
  "some", "any", "very", "much", "more", "like", "got", "let", "from", "by", "up", "out",
]);

/**
 * Content words, lightly de-pluralised.
 *
 * The stemming is deliberately crude - "payments" to "payment" is the case
 * that matters here, and anything cleverer would need a real stemmer for no
 * benefit at this scale. "ss" is left alone so "process" survives.
 */
export function contentTokens(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  const out = new Set<string>();
  for (const w of words) {
    if (STOPWORDS.has(w)) continue;
    const stem = w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w;
    out.add(stem);
  }
  return out;
}

/** Jaccard overlap of two token sets: shared words over total distinct words. */
export function similarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

export type Candidate<T> = { item: T; question: string };

export type MatchResult<T> = { item: T; score: number; runnerUp: number } | null;

/** How much of the prepared question shows up in what was asked. */
export function containment(prepared: Set<string>, asked: Set<string>): number {
  if (prepared.size === 0) return 0;
  let shared = 0;
  for (const t of prepared) if (asked.has(t)) shared++;
  return shared / prepared.size;
}

/**
 * Picks the prepared question the interviewer is actually asking, or nothing.
 *
 * Two measures, because neither works alone.
 *
 * Containment - how much of the prepared question survives in what was asked -
 * is the gate. It has to be, because the interviewer wraps short questions in
 * conversation: "Tell me about yourself" arrives as "Thanks for making the
 * time today. Let's just dive in. Tell me about yourself." Overlap scoring
 * alone drowns in the preamble and finds nothing.
 *
 * Similarity then ranks whatever clears the gate, and this is what keeps the
 * overlapping questions apart. "What is a bundled payment?" is fully contained
 * inside "Do you have experience with bundled payments?", so containment calls
 * both a perfect match; similarity prefers the one that is the same length as
 * the question actually asked.
 *
 * If the top two are too close to separate, this returns null. Generating a
 * fresh answer is a much smaller failure than confidently showing the answer
 * to a question nobody asked.
 *
 * There is deliberately no minimum on similarity. A short prepared question
 * inside a long preamble scores very low on it by construction - "Tell me
 * about yourself" reduces to a single content word - so a floor there rejects
 * exactly the matches this is for. The gate and the margin carry the safety.
 */
export function matchPreparedQuestion<T>(
  asked: string,
  candidates: Candidate<T>[],
  opts: { minContainment?: number; minMargin?: number } = {}
): MatchResult<T> {
  const minContainment = opts.minContainment ?? 0.8;
  const minMargin = opts.minMargin ?? 0.15;
  if (candidates.length === 0) return null;

  const askedTokens = contentTokens(asked);
  if (askedTokens.size === 0) return null;

  const passed = candidates
    .map((c) => {
      const tokens = contentTokens(c.question);
      return {
        item: c.item,
        contained: containment(tokens, askedTokens),
        score: similarity(askedTokens, tokens),
      };
    })
    .filter((c) => c.contained >= minContainment)
    .sort((x, y) => y.score - x.score);

  if (passed.length === 0) return null;

  const best = passed[0];
  const runnerUp = passed[1]?.score ?? 0;
  if (passed.length > 1 && best.score - runnerUp < minMargin) return null;
  return { item: best.item, score: best.score, runnerUp };
}
