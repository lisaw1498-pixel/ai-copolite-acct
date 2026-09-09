// In-process background job runner.
//
// Resume ingestion takes roughly two minutes end to end (PDF text extraction
// plus a large structured-extraction call) and report generation takes about
// 45 seconds. Doing that inside a request handler means the browser sits on a
// dead connection and most hosts kill the request long before it finishes -
// Vercel's default ceiling is far below either figure.
//
// So the handler now returns immediately and the work continues here, with
// progress recorded in the database so the client can poll.
//
// SCOPE: this is deliberately in-process, which suits the local-first,
// single-Node-process design of this app. It is NOT durable - a restart
// mid-job leaves the row in "processing" forever (see reapStaleJobs). Moving
// to serverless or multiple instances means replacing this with a real queue
// (a jobs table plus a worker, or a hosted queue); the call sites won't need
// to change, only this module.

type JobState = { startedAt: number; label: string };

// Survives dev hot-reloads, which would otherwise reset the registry and hide
// jobs that are genuinely still running.
declare global {
  // eslint-disable-next-line no-var
  var __jobs__: Map<string, JobState> | undefined;
}
const running: Map<string, JobState> = global.__jobs__ ?? new Map();
if (process.env.NODE_ENV !== "production") global.__jobs__ = running;

export function isJobRunning(key: string): boolean {
  return running.has(key);
}

export function runningJobCount(): number {
  return running.size;
}

/**
 * Starts `task` in the background and returns immediately.
 *
 * `key` de-duplicates: starting the same job twice (a double-click, a retry)
 * is a no-op while the first is still running. Errors are handed to `onError`
 * rather than thrown, because nothing is awaiting this promise - an unhandled
 * rejection here would take down the process.
 */
export function startJob(
  key: string,
  label: string,
  task: () => Promise<void>,
  onError: (message: string) => void
): { started: boolean } {
  if (running.has(key)) return { started: false };
  running.set(key, { startedAt: Date.now(), label });

  // Deliberately not awaited.
  void (async () => {
    try {
      await task();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        onError(message);
      } catch {
        // Never let failure reporting itself crash the runner.
      }
    } finally {
      running.delete(key);
    }
  })();

  return { started: true };
}

/**
 * A row left "processing" with no live job behind it is a crash artifact - the
 * process restarted mid-run. Callers use this so the UI can offer a retry
 * instead of spinning forever on a job that no longer exists.
 */
export function isStale(key: string, status: string | null): boolean {
  return status === "processing" && !running.has(key);
}

export const jobKeys = {
  resume: (id: string) => `resume:${id}`,
  report: (sessionId: string) => `report:${sessionId}`,
};
