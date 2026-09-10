import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkForSpeech, rankVoices, pickVoice } from "../use-speech-synthesis";

/** Asserts a value is present and narrows it, so the tests read cleanly. */
function must<T>(value: T | null | undefined, what: string): T {
  assert.ok(value, `expected ${what}`);
  return value;
}

/** Minimal stand-in for the browser type, which does not exist under node. */
function voice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang, voiceURI: `${name}::${lang}`, localService: true, default: false } as SpeechSynthesisVoice;
}

// What Windows actually offers, in the order browsers tend to list it: British
// and Indian voices ahead of the American ones.
const WINDOWS_VOICES = [
  voice("Microsoft Hazel - English (United Kingdom)", "en-GB"),
  voice("Microsoft Heera - English (India)", "en-IN"),
  voice("Microsoft David - English (United States)", "en-US"),
  voice("Microsoft Zira - English (United States)", "en-US"),
];

const EDGE_VOICES = [
  ...WINDOWS_VOICES,
  voice("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB"),
  voice("Microsoft Aria Online (Natural) - English (United States)", "en-US"),
  voice("Microsoft Andrew Online (Natural) - English (United States)", "en-US"),
];

test("prefers an American voice over a British or Indian one", () => {
  const picked = must(pickVoice(WINDOWS_VOICES), "a picked voice");
  assert.match(picked.name, /Zira/);
  assert.equal(picked.lang, "en-US");
});

test("prefers a natural US voice over a local US one", () => {
  const picked = must(pickVoice(EDGE_VOICES), "a picked voice");
  assert.match(picked.name, /Aria/);
});

test("never picks a male voice when a female one exists", () => {
  assert.doesNotMatch(must(pickVoice(WINDOWS_VOICES), "a voice").name, /David|Mark|Andrew/);
  assert.doesNotMatch(must(pickVoice(EDGE_VOICES), "a voice").name, /David|Mark|Andrew/);
});

test("a British natural voice does not outrank an American local one", () => {
  // The accent matters more than the engine: an American voice that sounds
  // synthetic is still the right choice over a beautiful British one.
  const picked = must(pickVoice([
    voice("Microsoft Sonia Online (Natural) - English (United Kingdom)", "en-GB"),
    voice("Microsoft Zira - English (United States)", "en-US"),
  ]), "a picked voice");
  assert.match(picked.name, /Zira/);
});

test("falls back to another English accent when no US voice exists", () => {
  const picked = must(pickVoice([voice("Microsoft Hazel - English (United Kingdom)", "en-GB")]), "a picked voice");
  assert.match(picked.name, /Hazel/);
});

test("a saved choice wins over the ranking", () => {
  const chosen = must(EDGE_VOICES.find((v) => /Sonia/.test(v.name)), "the Sonia fixture");
  assert.equal(must(pickVoice(EDGE_VOICES, chosen.voiceURI), "a voice").name, chosen.name);
});

test("a saved choice that is no longer installed falls back", () => {
  const picked = must(pickVoice(WINDOWS_VOICES, "Some Uninstalled Voice::en-US"), "a picked voice");
  assert.match(picked.name, /Zira/);
});

test("ranking lists American voices first", () => {
  const ranked = rankVoices(EDGE_VOICES);
  assert.equal(ranked[0].lang, "en-US");
  assert.match(ranked[0].name, /Aria/);
});

test("handles an empty voice list", () => {
  assert.equal(pickVoice([]), null);
  assert.deepEqual(rankVoices([]), []);
});

test("splits a question into speakable chunks at sentence ends", () => {
  const text =
    "Thanks for making the time today. I run our Ambulatory Applications team here. So let's start simple, tell me about yourself and what's drawing you to this role.";
  const chunks = chunkForSpeech(text);
  assert.ok(chunks.length > 1);
  for (const c of chunks) assert.ok(c.length <= 140, `chunk too long: ${c.length}`);
  // Nothing may be lost or invented - this is read aloud verbatim.
  assert.equal(chunks.join(" ").replace(/\s+/g, " "), text.replace(/\s+/g, " "));
});

test("keeps a short question as a single chunk", () => {
  assert.deepEqual(chunkForSpeech("Tell me about yourself."), ["Tell me about yourself."]);
});

test("breaks an over-long sentence on a space, not mid-word", () => {
  const long = `${"word ".repeat(80)}end.`;
  const chunks = chunkForSpeech(long);
  for (const c of chunks) {
    assert.ok(c.length <= 140);
    assert.doesNotMatch(c, /^\S*wor$|wor$/);
  }
  assert.equal(chunks.join(" ").replace(/\s+/g, " ").trim(), long.replace(/\s+/g, " ").trim());
});

test("empty text produces no chunks", () => {
  assert.deepEqual(chunkForSpeech(""), []);
  assert.deepEqual(chunkForSpeech("   "), []);
});
