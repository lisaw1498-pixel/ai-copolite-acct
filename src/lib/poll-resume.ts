"use client";

export type ResumeStatus = {
  id: string;
  name: string;
  status: "processing" | "analyzed" | "failed";
  statusMessage?: string | null;
  parsed?: unknown;
};

/**
 * Polls a resume until analysis finishes.
 *
 * Ingestion runs as a background job (it takes ~2 minutes), so the upload
 * response only tells us the work started. The interval backs off from 2s to
 * 6s: fast enough that a quick paste-in feels responsive, slow enough that a
 * long PDF analysis isn't making thirty pointless round trips.
 */
export async function pollResumeStatus(
  id: string,
  onUpdate?: (s: ResumeStatus) => void,
  opts: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<ResumeStatus> {
  const timeoutMs = opts.timeoutMs ?? 6 * 60 * 1000;
  const startedAt = Date.now();
  let delay = 2000;

  for (;;) {
    if (opts.signal?.aborted) throw new Error("aborted");

    const res = await fetch(`/api/resumes/${id}`, { signal: opts.signal });
    if (res.ok) {
      const data = await res.json();
      const resume: ResumeStatus = data.resume;
      onUpdate?.(resume);
      if (data.done) return resume;
    }

    if (Date.now() - startedAt > timeoutMs) {
      return {
        id,
        name: "",
        status: "failed",
        statusMessage:
          "Analysis is taking longer than expected. It may still finish - reload this page to check.",
      };
    }

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 1000, 6000);
  }
}
