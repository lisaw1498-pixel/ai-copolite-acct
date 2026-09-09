import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export class AIConfigError extends Error {
  constructor() {
    super(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (see Settings → AI Configuration) to enable AI features."
    );
    this.name = "AIConfigError";
  }
}

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new AIConfigError();
  if (!client) {
    // An API key created at the organization level (rather than inside a
    // specific workspace) is rejected unless the request names a workspace.
    // Supporting the header means such a key works without being reissued.
    const workspaceId = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
    client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
    });
  }
  return client;
}

/**
 * Raised for API failures the user can actually do something about - an
 * exhausted credit balance being the common one. Without this they surface as
 * "Couldn't generate an answer right now", which sends people hunting through
 * their own code for a bug that is really a billing state.
 */
export class AIServiceError extends Error {
  readonly actionable: boolean;
  constructor(message: string, actionable = true) {
    super(message);
    this.name = "AIServiceError";
    this.actionable = actionable;
  }
}

/** Translates SDK errors into messages worth showing a user. */
export function toFriendlyError(err: unknown): unknown {
  if (err instanceof Anthropic.APIError) {
    const raw = typeof err.message === "string" ? err.message : "";
    if (/credit balance is too low|insufficient.*credit/i.test(raw)) {
      return new AIServiceError(
        "Your Anthropic API credit balance is too low. Add credits at console.anthropic.com (Plans & Billing) to re-enable AI features."
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return new AIServiceError("Anthropic API rate limit reached. Wait a moment and try again.");
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return new AIServiceError("Your ANTHROPIC_API_KEY was rejected. Check the key in .env.local.");
    }
  }
  return err;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

/**
 * Effort controls how much the model reasons before answering, which is the
 * main latency/quality dial we have. The live interview path is latency
 * critical (blueprint target: first useful text in ~1-3s), so it runs "low";
 * offline preparation work can afford to think harder.
 */
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * NOTE: `temperature` is deliberately not sent. It was removed from the
 * Claude 4.6+ / 5 family and returns HTTP 400 on claude-opus-5. Determinism is
 * steered through the system prompts and `effort` instead.
 */
type CallOpts = {
  system: string;
  prompt: string;
  maxTokens?: number;
  effort?: Effort;
};

function buildParams(opts: CallOpts) {
  return {
    model: MODEL,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.prompt }],
    // `output_config` is newer than some installed SDK typings, so it is
    // attached through a cast rather than changing the whole param type.
    output_config: { effort: opts.effort ?? "medium" },
  } as unknown as Anthropic.MessageCreateParamsNonStreaming;
}

/**
 * Streams the response and returns the final text. Streaming avoids HTTP
 * timeouts on long generations and is what the live copilot builds on.
 */
/**
 * A truncated or declined response must fail loudly. Otherwise a response cut
 * off mid-JSON surfaces as an unhelpful "couldn't parse JSON" much later.
 */
function finishMessage(res: Anthropic.Message, opts: CallOpts): string {
  if (res.stop_reason === "max_tokens") {
    throw new Error(
      `Response hit the ${opts.maxTokens ?? 16000}-token cap and was cut off before it finished.`
    );
  }
  if (res.stop_reason === "refusal") {
    throw new Error("The model declined to answer this request.");
  }
  const textBlock = res.content.find((b) => b.type === "text");
  return textBlock && "text" in textBlock ? textBlock.text.trim() : "";
}

export async function callClaudeText(opts: CallOpts): Promise<string> {
  const anthropic = getClient();
  try {
    const stream = anthropic.messages.stream(buildParams(opts));
    return finishMessage(await stream.finalMessage(), opts);
  } catch (err) {
    throw toFriendlyError(err);
  }
}

/**
 * Calls Claude and expects a single JSON object back. We instruct the model
 * heavily to return raw JSON only, then defensively strip code fences and
 * parse. Throws on malformed output so callers can retry/handle it.
 */
export async function callClaudeJSON<T = unknown>(opts: CallOpts): Promise<T> {
  const raw = await callClaudeText(opts);
  return parseJSONLoose<T>(raw);
}

/**
 * Token-level streaming for the live copilot: `onDelta` fires as text arrives
 * so the SAY THIS panel can paint before the full answer is finished.
 */
export async function streamClaudeText(
  opts: CallOpts,
  onDelta: (chunk: string) => void
): Promise<string> {
  const anthropic = getClient();
  try {
    const stream = anthropic.messages.stream(buildParams(opts));
    stream.on("text", (chunk: string) => onDelta(chunk));
    return finishMessage(await stream.finalMessage(), opts);
  } catch (err) {
    throw toFriendlyError(err);
  }
}

export function parseJSONLoose<T = unknown>(raw: string): T {
  let text = raw.trim();
  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) text = fenceMatch[1].trim();
  // Fall back to the first { ... } or [ ... ] block found.
  if (!(text.startsWith("{") || text.startsWith("["))) {
    const objMatch = text.match(/[{[][\s\S]*[}\]]/);
    if (objMatch) text = objMatch[0];
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // Include the shape of what actually came back - a bare "couldn't parse"
    // is impossible to act on when it happens mid-interview.
    const snippet =
      text.length > 400 ? `${text.slice(0, 200)} [...] ${text.slice(-200)}` : text;
    throw new Error(
      `AI returned a response that could not be parsed as JSON (length ${text.length}): ${snippet}`
    );
  }
}
