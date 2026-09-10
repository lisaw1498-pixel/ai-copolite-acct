import { test } from "node:test";
import assert from "node:assert/strict";
import { matchPreparedQuestion, contentTokens, similarity } from "../match-prepared";

// The real prepared set for the Carrum Health interview. These overlap on
// purpose - several are about bundled payments and several about providers -
// which is exactly where a naive matcher picks the wrong one.
const PREPARED = [
  "Tell me about yourself.",
  "What do you know about Carrum Health?",
  "Why Carrum?",
  "What is value-based care?",
  "What is a bundled payment?",
  "Do you have experience with bundled payments?",
  "Do you have experience with CPTs, DRGs and JOCs?",
  "How would you onboard a new Carrum provider?",
  "Tell me about your experience managing provider relationships.",
  "Tell me about a difficult provider escalation.",
  "How would you handle an angry provider over an unpaid invoice?",
  "What KPIs would you track for a provider account?",
  "How do you manage multiple competing priorities?",
  "How would you identify opportunities to expand an account?",
  "Why should we hire you?",
  "What do you think makes a successful Provider Account Manager at Carrum?",
].map((question) => ({ item: question, question }));

function match(asked: string) {
  return matchPreparedQuestion(asked, PREPARED)?.item ?? null;
}

test("matches a question asked exactly as written", () => {
  assert.equal(match("What is a bundled payment?"), "What is a bundled payment?");
});

test("matches through a spoken preamble and reaction", () => {
  assert.equal(
    match("Got it. So what do you know about us here at Carrum Health?"),
    "What do you know about Carrum Health?"
  );
});

test("matches a short question buried in a long preamble", () => {
  // Verbatim from the mock interviewer. A short question carries few content
  // words, so a preamble this long swamps plain overlap scoring - this is the
  // case that sent the candidate a freshly generated answer instead of the one
  // she wrote.
  assert.equal(
    match("Thanks for making the time today. Let's just dive in. Tell me about yourself."),
    "Tell me about yourself."
  );
  assert.equal(
    match("Okay, that's helpful. So why Carrum, specifically?"),
    "Why Carrum?"
  );
});

test("keeps two near-identical prepared questions apart", () => {
  // The distinguishing word is "experience"; without the margin rule the
  // shorter question wins on containment alone.
  assert.equal(
    match("Do you have experience with bundled payments?"),
    "Do you have experience with bundled payments?"
  );
  assert.equal(match("Can you explain what a bundled payment is?"), "What is a bundled payment?");
});

test("does not guess when the question is genuinely ambiguous", () => {
  // "Tell me about providers" sits between the relationships question and the
  // escalation question with nothing to separate them. Generating a fresh
  // answer beats showing the answer to a question that was not asked.
  assert.equal(match("provider"), null);
});

test("returns nothing for a question that was never prepared", () => {
  assert.equal(match("What are your salary expectations for this role?"), null);
  assert.equal(match("Are you willing to relocate to Boston?"), null);
});

test("plural and singular forms match", () => {
  assert.equal(
    match("Tell me about your experience managing provider relationship."),
    "Tell me about your experience managing provider relationships."
  );
});

test("an empty or stopword-only question matches nothing", () => {
  assert.equal(match(""), null);
  assert.equal(match("So, tell me?"), null);
});

test("no prepared questions means no match", () => {
  assert.equal(matchPreparedQuestion("anything at all", []), null);
});

test("similarity is symmetric and bounded", () => {
  const a = contentTokens("What is a bundled payment?");
  const b = contentTokens("Do you have experience with bundled payments?");
  assert.equal(similarity(a, b), similarity(b, a));
  assert.ok(similarity(a, b) > 0 && similarity(a, b) < 1);
  assert.equal(similarity(a, a), 1);
});

test("stopwords alone produce no tokens", () => {
  assert.equal(contentTokens("so, what about that?").size, 0);
});
