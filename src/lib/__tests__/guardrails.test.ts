import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractSafeNumberTokens,
  findUnsupportedNumberClauses,
} from "../ai/generate-answer";
import { rankFacts, rankStories } from "../retrieval";
import type { FactForPrompt, StoryForPrompt } from "../ai/types";

function fact(p: Partial<FactForPrompt> & { id: string }): FactForPrompt {
  return {
    factType: "metric",
    factKey: "k",
    factValue: "v",
    normalizedValue: null,
    verificationStatus: "verified_resume",
    sourceType: "resume",
    sourceExcerpt: null,
    ...p,
  } as FactForPrompt;
}

// ---------------------------------------------------------------------------
// Metric Protection. These are the tests that matter most: the product's core
// promise is that it never states a number the candidate cannot back up.
// ---------------------------------------------------------------------------

test("verified numbers are collected as safe tokens", () => {
  const safe = extractSafeNumberTokens([
    fact({ id: "1", factValue: "35+ concurrent projects", normalizedValue: "35" }),
    fact({ id: "2", factValue: "98% on-time delivery", normalizedValue: "98" }),
  ]);
  assert.ok(safe.has("35+") || safe.has("35"));
  assert.ok(safe.has("98%") || safe.has("98"));
});

test("numbers from UNVERIFIED facts are never treated as safe", () => {
  const safe = extractSafeNumberTokens([
    fact({ id: "1", factValue: "$4M program budget", verificationStatus: "unverified" }),
  ]);
  assert.equal(safe.has("4"), false, "an unverified metric must not become quotable");
});

test("numbers from TRANSFERABLE facts are never treated as safe", () => {
  const safe = extractSafeNumberTokens([
    fact({ id: "1", factValue: "6 years eClinicalWorks", verificationStatus: "transferable" }),
  ]);
  assert.equal(safe.has("6"), false);
});

test("a fabricated metric is flagged for rewrite", () => {
  const safe = extractSafeNumberTokens([
    fact({ id: "1", factValue: "98% on-time delivery", normalizedValue: "98" }),
  ]);
  const flagged = findUnsupportedNumberClauses(
    "I kept a 98% on-time rate. I also cut implementation time by 30%.",
    safe
  );
  assert.equal(flagged.length, 1);
  assert.match(flagged[0], /30%/);
  assert.doesNotMatch(flagged[0], /98%/, "the supported sentence must survive");
});

test("an answer with no numbers is never flagged", () => {
  assert.deepEqual(
    findUnsupportedNumberClauses("I streamlined the process and reduced delays.", new Set()),
    []
  );
});

test("every numeric claim is flagged when the candidate has no verified metrics", () => {
  const flagged = findUnsupportedNumberClauses("I led a team of 15 across 12 states.", new Set());
  assert.equal(flagged.length, 1);
});

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

test("retrieval surfaces the topically relevant fact over noise", () => {
  const facts: FactForPrompt[] = [
    fact({ id: "rel", factKey: "stakeholder", factValue: "Executive stakeholder management" }),
    ...Array.from({ length: 80 }, (_, i) =>
      fact({ id: `noise${i}`, factKey: "misc", factValue: `unrelated warehouse logistics detail ${i}` })
    ),
  ];
  const ranked = rankFacts(facts, { question: "Tell me about a difficult stakeholder." }, 10);
  assert.ok(ranked.some((f) => f.id === "rel"), "the stakeholder fact must be retrieved");
  assert.ok(ranked.length <= 16, "retrieval must actually bound what is sent to the model");
});

test("identity facts are always retained as anchors", () => {
  const facts: FactForPrompt[] = [
    fact({ id: "emp", factType: "employer", factValue: "Meridian Health Systems" }),
    ...Array.from({ length: 80 }, (_, i) =>
      fact({ id: `n${i}`, factValue: `kubernetes cluster autoscaling note ${i}` })
    ),
  ];
  const ranked = rankFacts(facts, { question: "How do you scale kubernetes clusters?" }, 5);
  assert.ok(ranked.some((f) => f.id === "emp"), "employer must survive an unrelated question");
});

test("verified facts outrank unverified ones at equal relevance", () => {
  const facts: FactForPrompt[] = [
    fact({ id: "unver", factValue: "stakeholder management", verificationStatus: "unverified" }),
    fact({ id: "ver", factValue: "stakeholder management", verificationStatus: "verified_resume" }),
    ...Array.from({ length: 40 }, (_, i) => fact({ id: `n${i}`, factValue: `filler ${i}` })),
  ];
  const ranked = rankFacts(facts, { question: "Describe stakeholder management." }, 3);
  const vi = ranked.findIndex((f) => f.id === "ver");
  const ui = ranked.findIndex((f) => f.id === "unver");
  assert.ok(vi !== -1 && (ui === -1 || vi < ui));
});

test("story ranking matches on meaning-bearing words, not stopwords", () => {
  const stories: StoryForPrompt[] = [
    {
      id: "a", title: "Competing priorities across a 12-state rollout", category: "project_recovery",
      situation: "Three implementations had overlapping go-live windows", task: "", action: "", result: "",
      metrics: "98% on-time", verificationScore: 90, timesUsed: 0,
    } as StoryForPrompt,
    ...Array.from({ length: 20 }, (_, i) => ({
      id: `s${i}`, title: `Vendor contract negotiation ${i}`, category: "operations",
      situation: "procurement cycle", task: "", action: "", result: "", metrics: null,
      verificationScore: 50, timesUsed: 0,
    }) as StoryForPrompt),
  ];
  const ranked = rankStories(stories, { question: "Tell me about managing competing priorities." }, 3);
  assert.equal(ranked[0].id, "a");
});

// ---------------------------------------------------------------------------
// Regression: the validator used to match number formatting literally, so a
// verified "35+" written back by the model as "35-plus" was flagged as
// unsupported and rewritten into vaguer language. Stripping a candidate's real
// achievements is a product failure, not a safe default.
// ---------------------------------------------------------------------------

test("verified 35+ is still supported when written as 35-plus", () => {
  const safe = extractSafeNumberTokens([
    fact({ id: "1", factValue: "35+ concurrent implementation projects" }),
  ]);
  assert.deepEqual(
    findUnsupportedNumberClauses("I ran 35-plus concurrent implementations.", safe),
    []
  );
});

test("thousands separators do not trigger a false positive", () => {
  const safe = extractSafeNumberTokens([fact({ id: "1", factValue: "1,200 users migrated" })]);
  assert.deepEqual(findUnsupportedNumberClauses("We migrated 1200 users.", safe), []);
  assert.deepEqual(findUnsupportedNumberClauses("We migrated 1,200 users.", safe), []);
});

test("metrics inside a career story count as verified evidence", () => {
  const story = {
    id: "s1", title: "Rollout", category: "project_recovery",
    situation: "", task: "", action: "", result: "All three sites went live",
    metrics: "98% on-time go-live rate", verificationScore: 90, timesUsed: 0,
  } as StoryForPrompt;
  const safe = extractSafeNumberTokens([], [story]);
  assert.deepEqual(findUnsupportedNumberClauses("We held a 98% on-time rate.", safe), []);
});

test("an invented number is still caught after normalisation", () => {
  const safe = extractSafeNumberTokens([
    fact({ id: "1", factValue: "35+ concurrent implementation projects" }),
  ]);
  const flagged = findUnsupportedNumberClauses(
    "I ran 35-plus implementations. I cut costs by 30%.",
    safe
  );
  assert.equal(flagged.length, 1);
  assert.match(flagged[0], /30%/);
});

// ---------------------------------------------------------------------------
// Job scoping. Resume and story facts belong to the candidate and apply
// everywhere; a fact created from an answer approved for one job must not
// resurface as evidence at a different company.
// ---------------------------------------------------------------------------

/** Mirrors the filter in getUserFacts, without needing a database. */
function visibleForJob<T extends { jobId?: string | null }>(facts: T[], jobId?: string | null): T[] {
  return facts.filter((f) => !f.jobId || f.jobId === jobId);
}

test("resume facts are visible to every job", () => {
  const facts = [{ id: "resume", jobId: null }, { id: "story", jobId: undefined }];
  assert.equal(visibleForJob(facts, "job-a").length, 2);
  assert.equal(visibleForJob(facts, "job-b").length, 2);
});

test("an answer approved for one job is not evidence at another", () => {
  const facts = [
    { id: "resume", jobId: null },
    { id: "approved-for-a", jobId: "job-a" },
  ];
  assert.deepEqual(visibleForJob(facts, "job-a").map((f) => f.id), ["resume", "approved-for-a"]);
  assert.deepEqual(visibleForJob(facts, "job-b").map((f) => f.id), ["resume"]);
});

test("job-scoped facts are hidden when there is no job in play", () => {
  const facts = [{ id: "resume", jobId: null }, { id: "scoped", jobId: "job-a" }];
  assert.deepEqual(visibleForJob(facts, null).map((f) => f.id), ["resume"]);
  assert.deepEqual(visibleForJob(facts, undefined).map((f) => f.id), ["resume"]);
});
