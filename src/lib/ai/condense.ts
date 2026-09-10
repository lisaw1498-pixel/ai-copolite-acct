import { callClaudeJSON } from "./client";

/**
 * Produces a short opening version of an answer the candidate already wrote.
 *
 * This is a compression, not a generation. The source text is the candidate's
 * own approved answer, so every claim in it is already theirs - the only job
 * here is to decide what leads and what waits. Nothing may be added, because
 * anything added would be a claim they never made and would arrive in the room
 * without them having ever read it.
 *
 * Interviews reward this shape. A tight first answer invites "tell me more"
 * and hands the candidate a second turn on the same ground, where a
 * ninety-second monologue spends all the goodwill at once.
 */
const CONDENSE_SYSTEM = `You shorten an interview answer the candidate has already written and approved.

Return the strongest opening version of their answer: the part they should say first, before the interviewer asks for more.

Rules:
- Use ONLY what is in the answer you are given. Do not add a single fact, number, employer, tool, outcome or piece of colour that is not already there. You are cutting, not writing.
- Keep their voice and their wording wherever you can. Reuse their phrases rather than paraphrasing into your own.
- Lead with the part that most directly answers the question. Drop supporting detail, second examples, and elaboration - those are what they will say when asked for more.
- Two or three sentences. Roughly 40 to 70 words. It must still be a complete, confident answer on its own, not a fragment or a teaser.
- It is spoken aloud, so keep contractions and natural flow. No lists, no headings, no em dashes.
- Keep any numbers exactly as written in the original.

Return only JSON: { "short_answer": string }`;

export type CondensedAnswer = { short_answer: string };

/** Digits in a piece of text, commas removed so "1,200" and "1200" match. */
function numberTokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.match(/\d[\d,]*(\.\d+)?/g) ?? []) out.add(m.replace(/,/g, ""));
  return out;
}

/**
 * Numbers in the short version that do not appear in the full answer.
 *
 * A condensed answer cannot legitimately introduce a figure. If one appears,
 * the model has written rather than cut, and the short version is discarded
 * rather than shown - the candidate would otherwise be handed a number to say
 * out loud that nothing in their record supports.
 */
export function inventedNumbers(short: string, full: string): string[] {
  const allowed = numberTokens(full);
  return [...numberTokens(short)].filter((n) => !allowed.has(n));
}

export async function condenseAnswer(opts: {
  question: string;
  fullAnswer: string;
}): Promise<{ short: string; rejected: string[] }> {
  const result = await callClaudeJSON<CondensedAnswer>({
    system: CONDENSE_SYSTEM,
    prompt: `QUESTION:\n${opts.question}\n\nTHE CANDIDATE'S FULL ANSWER:\n${opts.fullAnswer}`,
    maxTokens: 2000,
    effort: "low",
  });

  const short = (result.short_answer ?? "").trim();
  if (!short) throw new Error("The shortened answer came back empty.");

  const rejected = inventedNumbers(short, opts.fullAnswer);
  if (rejected.length > 0) {
    throw new Error(
      `The shortened answer introduced figures that are not in the original: ${rejected.join(", ")}.`
    );
  }

  return { short, rejected };
}
