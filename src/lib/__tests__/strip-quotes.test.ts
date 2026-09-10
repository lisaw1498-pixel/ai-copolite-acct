import { test } from "node:test";
import assert from "node:assert/strict";
import { stripWrappingQuotes, stripWrappingQuotesMaybe } from "../strip-quotes";

const s = stripWrappingQuotes;

test("removes straight quotes wrapping the whole value", () => {
  assert.equal(s('"Tell me about yourself."'), "Tell me about yourself.");
  assert.equal(s('"What is a bundled payment?"'), "What is a bundled payment?");
});

test("removes curly quotes and guillemets", () => {
  assert.equal(s("“Why Carrum?”"), "Why Carrum?");
  assert.equal(s("«Bonjour»"), "Bonjour");
});

test("keeps apostrophes inside the text", () => {
  assert.equal(
    s("\"First, I'd acknowledge the concern and let them know I'm on it.\""),
    "First, I'd acknowledge the concern and let them know I'm on it."
  );
});

test("leaves an unwrapped value alone", () => {
  assert.equal(s("Why Carrum?"), "Why Carrum?");
  assert.equal(s("He said hello."), "He said hello.");
});

test("refuses to strip when the ends are not a matching pair", () => {
  // Opens and closes with a quote without being wrapped in one. Stripping the
  // ends here would silently corrupt the text.
  assert.equal(s('"Yes" is not an answer, and neither is "no"'), '"Yes" is not an answer, and neither is "no"');
  assert.equal(s('"quoted start only'), '"quoted start only');
  assert.equal(s('quoted end only"'), 'quoted end only"');
});

test("leaves a value containing an inner quotation alone", () => {
  const v = 'She told me "get it done" and walked off';
  assert.equal(s(v), v);
});

test("leaves a double-wrapped value alone rather than guessing", () => {
  // Indistinguishable from `"a" and "b"` under the pair rule, so it declines.
  // Removing one layer here would mean removing a layer from the other shape
  // too, which corrupts it.
  assert.equal(s('""double wrapped""'), '""double wrapped""');
});

test("handles short and empty values safely", () => {
  assert.equal(s(""), "");
  assert.equal(s('"'), '"');
  assert.equal(s('""'), "");
});

test("is idempotent", () => {
  const once = s('"Tell me about yourself."');
  assert.equal(s(once), once);
});

test("preserves apostrophe-quoted values rather than mangling contractions", () => {
  // Single quotes are deliberately not treated as wrappers.
  assert.equal(s("'not stripped'"), "'not stripped'");
  assert.equal(s("didn't"), "didn't");
});

test("passes null and undefined through", () => {
  assert.equal(stripWrappingQuotesMaybe(null), null);
  assert.equal(stripWrappingQuotesMaybe(undefined), undefined);
  assert.equal(stripWrappingQuotesMaybe('"hi"'), "hi");
});
