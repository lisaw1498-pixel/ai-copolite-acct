// Client-safe heuristics for live question detection (blueprint section on
// "Question Detection" / "Partial Question Intelligence"). No AI call - this
// needs to run continuously on every transcript chunk with near-zero latency.

export const QUESTION_TRIGGER_PHRASES = [
  "tell me about",
  "walk me through",
  "describe a time",
  "give me an example",
  "how do you",
  "what do you",
  "why did you",
  "why do you",
  "have you",
  "explain",
  "how would you",
  "what would you",
  "what experience do you have",
  "what happened when",
  "how did you",
  "can you explain",
  "can you tell me",
  "what is your",
  "what are your",
];

export function looksLikeQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return false;
  const lower = trimmed.toLowerCase();
  if (trimmed.endsWith("?")) return true;
  return QUESTION_TRIGGER_PHRASES.some((phrase) => lower.includes(phrase));
}

// Very small set of cues used to soften false positives from casual chatter -
// require some minimum length once a trigger phrase is seen, since partial
// streaming transcripts arrive progressively ("Tell me about a time..." then
// "...you had a difficult stakeholder" then "...and how you handled it.").
export function hasEnoughQuestionContext(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 6;
}

export function classifySpeaker(text: string, isFirstOfBurst: boolean): "interviewer" | "candidate" | "unknown" {
  // Without real diarization we fall back to a simple heuristic: question-like
  // utterances are attributed to the interviewer, everything else to the
  // candidate. The UI always allows manual override.
  if (looksLikeQuestion(text)) return "interviewer";
  if (isFirstOfBurst) return "unknown";
  return "candidate";
}
