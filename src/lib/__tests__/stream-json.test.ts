import { test } from "node:test";
import assert from "node:assert/strict";
import { createStringFieldExtractor } from "../ai/stream-json";

// Built rather than written literally: a backslash in source here is easy to
// get wrong, and these tests are specifically about escape handling.
const BS = String.fromCharCode(92); // \
const LF = String.fromCharCode(10); // newline
const EMDASH = String.fromCharCode(0x2014);

/** Feeds a string through the extractor in fixed-size chunks. */
function run(json: string, chunkSize: number, field = "say_this"): string {
  const push = createStringFieldExtractor(field);
  let out = "";
  for (let i = 0; i < json.length; i += chunkSize) {
    out += push(json.slice(i, i + chunkSize));
  }
  return out;
}

const OBJ = '{"question_type":"behavioral","say_this":"I led the rollout.","confidence":0.9}';

test("extracts the field when it arrives in one chunk", () => {
  assert.equal(run(OBJ, OBJ.length), "I led the rollout.");
});

test("produces identical output at every chunk boundary", () => {
  // The marker, the escapes, and the closing quote must all survive being
  // split across arbitrary token boundaries.
  for (let size = 1; size <= 40; size++) {
    assert.equal(run(OBJ, size), "I led the rollout.", `chunk size ${size}`);
  }
});

test("decodes escaped quotes without ending the field early", () => {
  const json = '{"say_this":"He said ' + BS + '"ship it' + BS + '" on Friday.","x":1}';
  for (let size = 1; size <= 25; size++) {
    assert.equal(run(json, size), 'He said "ship it" on Friday.', `chunk size ${size}`);
  }
});

test("decodes newline and unicode escapes", () => {
  const json = '{"say_this":"line one' + BS + "nline two " + BS + 'u2014 done"}';
  const expected = "line one" + LF + "line two " + EMDASH + " done";
  for (let size = 1; size <= 20; size++) {
    assert.equal(run(json, size), expected, `chunk size ${size}`);
  }
});

test("a trailing backslash is never emitted as a stray character", () => {
  const push = createStringFieldExtractor("say_this");
  // The chunk ends mid-escape: the backslash must be held back, not emitted,
  // otherwise the panel would briefly show a character we then have to retract.
  assert.equal(push('{"say_this":"a' + BS), "a");
  assert.equal(push('"b"}'), '"b');
});

test("emits nothing before the field appears", () => {
  const push = createStringFieldExtractor("say_this");
  assert.equal(push('{"question_type":"behavioral","framework":"STAR",'), "");
  assert.equal(push('"say_this":"Hello'), "Hello");
});

test("stops at the closing quote and ignores later fields", () => {
  const push = createStringFieldExtractor("say_this");
  push('{"say_this":"done."');
  assert.equal(push(',"remember_this":["not this"]}'), "");
});

test("returns nothing when the field is absent", () => {
  assert.equal(run('{"other":"value"}', 3), "");
});
