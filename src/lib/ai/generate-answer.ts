import { callClaudeJSON, callClaudeText, streamClaudeText, parseJSONLoose } from "./client";
import { createStringFieldExtractor } from "./stream-json";
import { CLAIM_REWRITE_SYSTEM_PROMPT, CORE_SYSTEM_PROMPT } from "./prompts";
import { FactForPrompt, GeneratedAnswer, StoryForPrompt } from "./types";

export type GenerateAnswerInput = {
  question: string;
  previousQuestion?: string | null;
  previousAnswer?: string | null;
  facts: FactForPrompt[];
  stories: StoryForPrompt[];
  jobContext?: string | null;
  previouslyUsedStoryIds?: string[];
  responseLength?: "quick" | "standard" | "detailed";
  isFollowUpHint?: boolean;
  /** Shapes delivery only - it must never change which facts are usable. */
  answerStyle?: "natural" | "executive" | "star";
  /** Set when the candidate hits "Switch Story" and picks a specific one. */
  preferredStoryId?: string | null;
  /** Who is asking. Shapes emphasis and register only - never what is claimed. */
  interviewer?: { name?: string | null; role?: string | null; notes?: string | null } | null;
};

function buildPrompt(input: GenerateAnswerInput): string {
  const factsBlock = input.facts
    .map(
      (f) =>
        `- [${f.id}] (${f.factType}, ${f.verificationStatus}) ${f.factKey}: ${f.factValue}${
          f.sourceExcerpt ? ` — source: "${f.sourceExcerpt.slice(0, 140)}"` : ""
        }`
    )
    .join("\n") || "(no candidate facts available)";

  const storiesBlock = input.stories
    .map(
      (s) =>
        `- [${s.id}] "${s.title}" (${s.category ?? "uncategorized"}, used ${s.timesUsed ?? 0}x)\n  Situation: ${
          s.situation ?? ""
        }\n  Task: ${s.task ?? ""}\n  Action: ${s.action ?? ""}\n  Result: ${s.result ?? ""}\n  Metrics: ${
          s.metrics ?? "(none verified)"
        }`
    )
    .join("\n") || "(no career stories available)";

  const lengthHint =
    input.responseLength === "quick"
      ? "Keep say_this to about 15-20 seconds spoken (roughly 40-60 words)."
      : input.responseLength === "detailed"
      ? "This may run 60-90 seconds spoken (roughly 150-220 words)."
      : "Aim for about 30-60 seconds spoken (roughly 80-140 words).";

  const styleHint =
    input.answerStyle === "executive"
      ? "Deliver this at an executive altitude: lead with the outcome and the decision you made, keep the narrative tight, and drop granular procedural detail."
      : input.answerStyle === "star"
      ? "Structure say_this explicitly as Situation, then Task, then Action, then Result - still spoken aloud in natural prose, not labelled out loud."
      : input.answerStyle === "natural"
      ? "Push the spoken register further than usual. Looser, more off-the-cuff, the way someone talks when they are relaxed and thinking out loud. More fragments, more connective tissue (\"I mean\", \"you know\", \"honestly\"), less structure. It should sound almost unrehearsed."
      : "";

  const iv = input.interviewer;
  const interviewerHint =
    iv && (iv.role || iv.notes)
      ? `WHO IS ASKING:
${[iv.name && `Name: ${iv.name}`, iv.role && `Role: ${iv.role}`, iv.notes && `Background: ${iv.notes}`]
  .filter(Boolean)
  .join("\n")}

Use this to choose WHICH of the candidate's verified experience to lead with, and how technical to pitch it. A clinical leader cares about workflow and adoption; a technical lead wants build and integration detail; an executive wants outcomes and risk. This changes emphasis and register ONLY. It is not evidence about the candidate, it never licenses a claim they cannot support, and you must never mention or allude to knowing anything about the interviewer.`
      : "";

  const storyHint = input.preferredStoryId
    ? `The candidate has explicitly asked you to build this answer from career story [${input.preferredStoryId}]. Use that story unless it genuinely cannot answer the question.`
    : "";

  return `INTERVIEWER QUESTION:
"${input.question}"

${
  input.previousQuestion
    ? `PREVIOUS QUESTION: "${input.previousQuestion}"\nPREVIOUS ANSWER GIVEN: "${input.previousAnswer ?? ""}"\nHint: this may be a follow-up (${
        input.isFollowUpHint ? "likely" : "uncertain"
      }) to the previous question — if so, stay on the same example.`
    : ""
}

JOB CONTEXT (for relevance only, never as proof of a skill):
${input.jobContext ?? "(no specific job selected)"}

CANDIDATE FACTS (only these may ground candidate-specific claims):
${factsBlock}

CANDIDATE CAREER STORIES:
${storiesBlock}

STORIES ALREADY USED THIS SESSION: ${
    input.previouslyUsedStoryIds?.length ? input.previouslyUsedStoryIds.join(", ") : "(none yet)"
  }

${lengthHint}
${styleHint}
${storyHint}
${interviewerHint}

Return only the JSON object described in your system instructions.`;
}

/**
 * Collects every number the candidate can actually back up, reduced to its
 * bare digits.
 *
 * Normalising to digits matters: the model naturally writes "35-plus" where
 * the resume says "35+", and "12" where a story says "12 states". Matching
 * those literally caused truthful, verified metrics to be stripped out and
 * replaced with vaguer language - which quietly makes the candidate sound
 * weaker than they are. The number itself is what needs verifying, not its
 * typography.
 *
 * Career stories count as evidence here too (status verified_story), not just
 * facts - a metric the candidate wrote into their own STAR story is exactly
 * as verified as one parsed from their resume.
 */
export function extractSafeNumberTokens(
  facts: FactForPrompt[],
  stories: StoryForPrompt[] = []
): Set<string> {
  const safe = new Set<string>();
  const harvest = (text: string) => {
    for (const m of text.match(/\d[\d,]*(\.\d+)?/g) ?? []) {
      safe.add(m.replace(/,/g, ""));
    }
  };

  for (const f of facts) {
    if (!f.verificationStatus.startsWith("verified_")) continue;
    harvest(`${f.factValue} ${f.normalizedValue ?? ""}`);
  }
  for (const st of stories) {
    harvest(
      [st.situation, st.task, st.action, st.result, st.metrics].filter(Boolean).join(" ")
    );
  }
  return safe;
}

/**
 * Flags sentences containing a number with no verified counterpart.
 *
 * Known limitation: numbers spelled as words ("thirty percent") are not
 * detected here. The system prompt forbids them, and the model overwhelmingly
 * emits digits for metrics, but this check is digit-based by design rather
 * than a full number parser.
 */
export function findUnsupportedNumberClauses(sayThis: string, safeTokens: Set<string>): string[] {
  const sentences = sayThis.split(/(?<=[.!?])\s+/);
  const flagged: string[] = [];
  for (const sentence of sentences) {
    const found = sentence.match(/\d[\d,]*(\.\d+)?/g);
    if (!found) continue;
    for (const n of found) {
      if (!safeTokens.has(n.replace(/,/g, ""))) {
        flagged.push(sentence.trim());
        break;
      }
    }
  }
  return flagged;
}

/**
 * Applies Metric Protection to the REMEMBER THIS cues.
 *
 * The cues were previously exempt from validation, which was a real hole: a
 * cue reading "METRIC: 30% faster" would render with a green verification
 * badge next to it, and a glancing candidate would say it out loud. Cues are
 * dropped rather than rewritten - a cue is a handful of words, so there is
 * nothing left to salvage once the number goes, and this needs no API call.
 */
export function validateCues(
  cues: GeneratedAnswer["remember_this"],
  safeTokens: Set<string>
): { cues: GeneratedAnswer["remember_this"]; dropped: string[] } {
  const kept: GeneratedAnswer["remember_this"] = [];
  const dropped: string[] = [];
  for (const cue of cues ?? []) {
    if (findUnsupportedNumberClauses(cue.value ?? "", safeTokens).length > 0) {
      dropped.push(`${cue.label}: ${cue.value}`);
    } else {
      kept.push(cue);
    }
  }
  return { cues: kept, dropped };
}

/**
 * Claim-level validation (Metric Protection). Any numeric claim in the draft
 * that doesn't literally trace back to a verified fact we actually supplied is
 * sent back for a targeted rewrite. This deliberately does not rely on the
 * model's own report of what it used.
 *
 * Returns whether the answer was changed, so the live UI can tell the
 * candidate that a claim was pulled rather than silently swapping the text
 * they were about to say out loud.
 */
export async function validateClaims(
  draft: GeneratedAnswer,
  facts: FactForPrompt[],
  stories: StoryForPrompt[] = []
): Promise<{ answer: GeneratedAnswer; corrected: boolean; removed: string[] }> {
  const safeTokens = extractSafeNumberTokens(facts, stories);

  // Cues are cleaned unconditionally - this is programmatic and instant.
  const { cues, dropped } = validateCues(draft.remember_this, safeTokens);
  draft.remember_this = cues;
  if (dropped.length > 0) {
    draft.excluded_unverified_claims = Array.from(
      new Set([...(draft.excluded_unverified_claims ?? []), ...dropped])
    );
  }

  const unsupported = findUnsupportedNumberClauses(draft.say_this, safeTokens);
  if (unsupported.length === 0) return { answer: draft, corrected: false, removed: [] };

  try {
    const rewritten = await callClaudeJSON<{ say_this: string }>({
      system: CLAIM_REWRITE_SYSTEM_PROMPT,
      prompt: `ORIGINAL ANSWER:
"${draft.say_this}"

UNSUPPORTED PHRASES TO REMOVE OR SOFTEN (no verified fact backs the number in these sentences):
${unsupported
        .map((s) => `- "${s}"`)
        .join("\n")}

Return the JSON object described in your instructions.`,
      maxTokens: 4000,
      effort: "low",
    });
    draft.say_this = rewritten.say_this;
  } catch {
    // If the rewrite call fails for any reason, fail safe by stripping the
    // flagged sentences outright rather than shipping an unverified metric.
    let safe = draft.say_this;
    unsupported.forEach((sentence) => {
      safe = safe.replace(sentence, "").trim();
    });
    draft.say_this = safe;
  }

  draft.excluded_unverified_claims = Array.from(
    new Set([...(draft.excluded_unverified_claims ?? []), ...unsupported])
  );
  return { answer: draft, corrected: true, removed: unsupported };
}

/** Non-streaming generation, used by mock interviews and answer preparation. */
export async function generateAnswer(input: GenerateAnswerInput): Promise<GeneratedAnswer> {
  const draft = await callClaudeJSON<GeneratedAnswer>({
    system: CORE_SYSTEM_PROMPT,
    prompt: buildPrompt(input),
    effort: "low",
  });
  const { answer } = await validateClaims(draft, input.facts, input.stories);
  return answer;
}

/**
 * Streaming generation for the Live Interview Copilot.
 *
 * `onSayThisDelta` fires with decoded characters of the spoken answer as the
 * model produces them, so the SAY THIS panel paints immediately instead of
 * waiting for the whole JSON object. Validation still runs afterwards on the
 * complete answer, and the caller is told if the text changed.
 */
export async function generateAnswerStreaming(
  input: GenerateAnswerInput,
  handlers: {
    onSayThisDelta: (text: string) => void;
    /**
     * Fires the moment the JSON parses and the cues pass Metric Protection -
     * deliberately *before* the say_this rewrite round-trip. That rewrite only
     * ever touches say_this, so holding the cue cards behind it left the
     * REMEMBER THIS panel empty for an extra 8-15 seconds of a live interview
     * for no reason.
     */
    onCues?: (payload: Partial<GeneratedAnswer>) => void;
  }
): Promise<{ answer: GeneratedAnswer; corrected: boolean; removed: string[] }> {
  const extract = createStringFieldExtractor("say_this");

  const raw = await streamClaudeText(
    {
      system: CORE_SYSTEM_PROMPT,
      prompt: buildPrompt(input),
      effort: "low",
    },
    (chunk) => {
      const text = extract(chunk);
      if (text) handlers.onSayThisDelta(text);
    }
  );

  const draft = parseJSONLoose<GeneratedAnswer>(raw);

  if (handlers.onCues) {
    const safeTokens = extractSafeNumberTokens(input.facts, input.stories);
    const { cues } = validateCues(draft.remember_this, safeTokens);
    handlers.onCues({
      remember_this: cues,
      story_id: draft.story_id,
      framework: draft.framework,
      question_type: draft.question_type,
      facts_used: draft.facts_used,
      transferable_experience: draft.transferable_experience,
      is_follow_up: draft.is_follow_up,
    });
  }

  return validateClaims(draft, input.facts, input.stories);
}

export async function improveStoryWording(story: {
  situation?: string | null;
  task?: string | null;
  action?: string | null;
  result?: string | null;
}): Promise<{ situation: string; task: string; action: string; result: string }> {
  const text = await callClaudeText({
    system:
      "You improve the wording, clarity, and flow of a candidate's STAR career story. You may reorganize sentences and tighten language. You must NEVER invent new facts, numbers, employers, or details that are not already present in the candidate's own text. Return only a JSON object: {\"situation\":string,\"task\":string,\"action\":string,\"result\":string}",
    prompt: `Situation: ${story.situation ?? ""}\nTask: ${story.task ?? ""}\nAction: ${
      story.action ?? ""
    }\nResult: ${story.result ?? ""}`,
    maxTokens: 4000,
    effort: "medium",
  });
  return JSON.parse(
    text.replace(/```json|```/g, "").trim()
  ) as { situation: string; task: string; action: string; result: string };
}
