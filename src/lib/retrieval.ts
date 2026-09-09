// Candidate knowledge retrieval.
//
// The blueprint's latency strategy is explicit: "Do not send entire resume to
// LLM after every question... Retrieve only relevant chunks." Sending every
// candidate fact on every turn burns input tokens, slows the live path, and
// measurably dilutes answer quality once a profile grows past a few dozen
// facts.
//
// This is a lexical (BM25-flavoured) ranker rather than a vector search. That
// is a deliberate tradeoff for the local-first SQLite build: it needs no
// embedding service, no extra round trip, and runs in well under a
// millisecond, which matters more on the live path than semantic recall of
// paraphrases. The scoring interface is intentionally shaped so a pgvector /
// embedding backend can replace `scoreText` later without touching callers.

import { FactForPrompt, StoryForPrompt } from "./ai/types";

const STOPWORDS = new Set([
  "a","an","the","and","or","but","if","then","than","that","this","these","those","of","to","in","on","at","for","with","by","from","as","is","are","was","were","be","been","being","do","does","did","have","has","had","can","could","would","should","will","shall","may","might","must","i","you","he","she","it","we","they","me","my","your","our","their","about","into","over","under","time","tell","give","walk","describe","example","when","what","how","why","who","where","which","some","any","most","more","very","really","just","like","get","got","make","made","take","took","us","them",
]);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9+#.]+/g) ?? [])
    .map((t) => t.replace(/^[.]+|[.]+$/g, ""))
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Crude stemmer: collapses common English suffixes so "implementations"
 *  matches "implementation" and "managed" matches "managing". */
function stem(token: string): string {
  return token
    .replace(/(ations|ation|ements|ement|ingly|ing|edly|ed|ies|es|s)$/u, (m) =>
      token.length - m.length >= 4 ? "" : m
    )
    .replace(/i$/, "y");
}

function bag(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const raw of tokenize(text)) {
    const t = stem(raw);
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return counts;
}

/**
 * Scores a document against a query using inverse-document-frequency weighting
 * so distinctive terms ("eclinicalworks", "stakeholder") count for far more
 * than terms that appear across the candidate's whole profile.
 */
function scoreText(queryBag: Map<string, number>, docText: string, idf: Map<string, number>): number {
  const docBag = bag(docText);
  if (docBag.size === 0) return 0;
  let score = 0;
  for (const [term] of queryBag) {
    const tf = docBag.get(term);
    if (!tf) continue;
    // Saturating term frequency keeps one repeated word from dominating.
    score += (idf.get(term) ?? 1) * (tf / (tf + 1.2));
  }
  // Mild length normalisation so a long story doesn't automatically outrank a
  // short, precisely-matching fact.
  return score / Math.log2(docBag.size + 4);
}

function buildIdf(docs: string[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const d of docs) {
    for (const term of new Set(bag(d).keys())) df.set(term, (df.get(term) ?? 0) + 1);
  }
  const n = Math.max(docs.length, 1);
  const idf = new Map<string, number>();
  for (const [term, count] of df) idf.set(term, Math.log(1 + n / (count + 0.5)));
  return idf;
}

// Verified evidence should outrank unverified evidence at equal textual
// relevance - the Verified Experience Layer will strip unverified claims
// downstream anyway, so surfacing them costs tokens for no benefit.
const STATUS_WEIGHT: Record<string, number> = {
  verified_story: 1.3,
  verified_resume: 1.25,
  verified_user: 1.2,
  verified_project: 1.2,
  verified_approved: 1.15,
  transferable: 1.0,
  unverified: 0.55,
  conflicted: 0.4,
};

// Identity facts anchor almost any answer ("at my last role as X at Y"), so a
// few are always included regardless of lexical overlap with the question.
const ANCHOR_FACT_TYPES = new Set(["employer", "job_title", "employment_dates", "years_experience"]);

function factText(f: FactForPrompt): string {
  return `${f.factType} ${f.factKey} ${f.factValue} ${f.normalizedValue ?? ""} ${f.sourceExcerpt ?? ""}`;
}

function storyText(s: StoryForPrompt): string {
  return `${s.title} ${s.category ?? ""} ${s.situation ?? ""} ${s.task ?? ""} ${s.action ?? ""} ${
    s.result ?? ""
  } ${s.metrics ?? ""}`;
}

export type RetrievalQuery = {
  question: string;
  /** Previous question/answer, so follow-ups retrieve against the live thread. */
  conversationContext?: string | null;
  /** Job requirements text - steers *which* verified experience is relevant. */
  jobContext?: string | null;
};

function queryString(q: RetrievalQuery): string {
  // The question dominates; job context is included at lower weight by simply
  // being shorter/less repeated, and only its first chunk is used so a long JD
  // can't drown out the actual question.
  return [q.question, q.question, q.conversationContext ?? "", (q.jobContext ?? "").slice(0, 600)].join(" ");
}

export function rankFacts(facts: FactForPrompt[], q: RetrievalQuery, limit = 60): FactForPrompt[] {
  if (facts.length <= limit) return facts;
  const idf = buildIdf(facts.map(factText));
  const qBag = bag(queryString(q));

  const scored = facts.map((f) => ({
    fact: f,
    score:
      scoreText(qBag, factText(f), idf) * (STATUS_WEIGHT[f.verificationStatus] ?? 0.8) +
      (ANCHOR_FACT_TYPES.has(f.factType) ? 0.35 : 0),
  }));

  scored.sort((a, b) => b.score - a.score);

  // Guarantee the answer can always name where the candidate worked, even if
  // the question shares no vocabulary with their employer records.
  const picked = scored.slice(0, limit).map((s) => s.fact);
  const pickedIds = new Set(picked.map((f) => f.id));
  const anchors = facts
    .filter((f) => ANCHOR_FACT_TYPES.has(f.factType) && !pickedIds.has(f.id))
    .slice(0, 6);
  return [...picked, ...anchors];
}

export function rankStories(stories: StoryForPrompt[], q: RetrievalQuery, limit = 8): StoryForPrompt[] {
  if (stories.length <= limit) return stories;
  const idf = buildIdf(stories.map(storyText));
  const qBag = bag(queryString(q));
  return stories
    .map((s) => ({
      story: s,
      // A story with a verified metric is more useful in an interview than an
      // equally relevant one without, so nudge it up.
      score: scoreText(qBag, storyText(s), idf) * (s.metrics ? 1.15 : 1),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.story);
}
