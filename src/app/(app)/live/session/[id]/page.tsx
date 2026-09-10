"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { looksLikeQuestion, hasEnoughQuestionContext } from "@/lib/question-detection";
import { VerificationBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Mic,
  MicOff,
  Pause,
  Play,
  PhoneOff,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Keyboard,
  Maximize2,
  Minimize2,
  SendHorizonal,
} from "lucide-react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/theme-toggle";

type RememberCue = { label: string; value: string; verification?: string };
type LiveAnswer = {
  say_this: string;
  remember_this: RememberCue[];
  facts_used: { fact_id: string; claim: string; verification_status: string; source: string }[];
  transferable_experience: { requirement: string; candidate_equivalent: string }[];
  confidence: number;
  story_id?: string | null;
  is_follow_up?: boolean;
};

type DisplayMode = "standard" | "compact" | "discreet" | "quick_glance";
type AnswerStyle = "natural" | "executive" | "star";
type StoryOption = { id: string; title: string; category: string | null; alreadyUsed: boolean };

export default function LiveSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<{ company: string; jobTitle: string } | null>(null);
  const [displayMode, setDisplayMode] = useState<DisplayMode>("standard");
  const [responseLength, setResponseLength] = useState<"quick" | "standard" | "detailed">("standard");
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState<LiveAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualQuestion, setManualQuestion] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [showEvidence, setShowEvidence] = useState(false);
  const [transcript, setTranscript] = useState<{ speaker: string; text: string }[]>([]);
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [ending, setEnding] = useState(false);
  const [availableStories, setAvailableStories] = useState<StoryOption[]>([]);
  const [storyAlreadyUsed, setStoryAlreadyUsed] = useState(false);
  const [isFollowUpAnswer, setIsFollowUpAnswer] = useState(false);
  const [showStorySwitch, setShowStorySwitch] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  // Cues arrive ahead of the finalised answer, so they render from their own
  // state rather than waiting on `currentAnswer`.
  const [earlyCues, setEarlyCues] = useState<LiveAnswer["remember_this"]>([]);
  const [earlyStoryId, setEarlyStoryId] = useState<string | null>(null);
  // The fuller version of a prepared answer, held back until they probe.
  const [moreDetail, setMoreDetail] = useState<string | null>(null);
  const [showingMore, setShowingMore] = useState(false);
  const [correction, setCorrection] = useState<string[] | null>(null);

  const manualRef = useRef<HTMLTextAreaElement>(null);
  const prevQARef = useRef<{ q: string; a: string }>({ q: "", a: "" });

  useEffect(() => {
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((d) => setJob(d.job));
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const submitQuestion = useCallback(
    async (
      question: string,
      isFollowUp: boolean,
      opts?: { answerStyle?: AnswerStyle; preferredStoryId?: string | null }
    ) => {
      setLoading(true);
      setError(null);
      setCurrentAnswer(null);
      setStreamingText("");
      setEarlyCues([]);
      setEarlyStoryId(null);
      setCorrection(null);
      setMoreDetail(null);
      setShowingMore(false);
      // Show the question immediately - waiting for the model to respond before
      // acknowledging it makes the copilot feel broken mid-interview.
      setCurrentQuestion(question);
      setTranscript((prev) => [...prev, { speaker: "interviewer", text: question }]);

      try {
        const res = await fetch(`/api/sessions/${id}/live-turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question,
            previousQuestion: prevQARef.current.q || undefined,
            previousAnswer: prevQARef.current.a || undefined,
            responseLength,
            isFollowUp,
            answerStyle: opts?.answerStyle,
            preferredStoryId: opts?.preferredStoryId ?? null,
          }),
        });

        if (!res.ok || !res.body) {
          setError("Couldn't reach the answer service.");
          setLoading(false);
          return;
        }

        // Parse the SSE stream by hand: EventSource only supports GET, and this
        // turn needs a POST body.
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamed = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Frames are separated by a blank line.
          let split;
          while ((split = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);

            const eventLine = frame.split("\n").find((l) => l.startsWith("event: "));
            const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
            if (!eventLine || !dataLine) continue;

            const event = eventLine.slice(7).trim();
            const payload = JSON.parse(dataLine.slice(6));

            if (event === "delta") {
              streamed += payload.text;
              setStreamingText(streamed);
            } else if (event === "cues") {
              setEarlyCues(payload.remember_this ?? []);
              setEarlyStoryId(payload.story_id ?? null);
              setIsFollowUpAnswer(Boolean(payload.is_follow_up ?? isFollowUp));
            } else if (event === "corrected") {
              // Claim validation removed an unsupported claim from the text the
              // candidate is reading. Replace it and say so.
              streamed = payload.say_this;
              setStreamingText(streamed);
              setCorrection(payload.removed ?? []);
            } else if (event === "final") {
              setCurrentAnswer(payload.generated);
              if (payload.hasMore && payload.fullAnswer) setMoreDetail(payload.fullAnswer);
              setAvailableStories(payload.availableStories ?? []);
              setStoryAlreadyUsed(Boolean(payload.storyAlreadyUsed));
              setIsFollowUpAnswer(Boolean(payload.generated?.is_follow_up ?? isFollowUp));
              setShowStorySwitch(false);
              prevQARef.current = { q: question, a: payload.generated.say_this };
              setTranscript((prev) => [
                ...prev,
                { speaker: "copilot", text: payload.generated.say_this },
              ]);
            } else if (event === "error") {
              setError(
                [payload.error || "Couldn't generate an answer.", payload.detail]
                  .filter(Boolean)
                  .join(" — ")
              );
            }
          }
        }
      } catch {
        setError("Network error generating the answer.");
      }
      setLoading(false);
    },
    [id, responseLength]
  );

  const recordCandidateSpeech = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      // Ignore back-channel noise ("mm-hm", "right") that adds nothing to a report.
      if (trimmed.split(/\s+/).filter(Boolean).length < 4) return;
      setTranscript((prev) => [...prev, { speaker: "candidate", text: trimmed }]);
      fetch(`/api/sessions/${id}/transcript`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speaker: "candidate", text: trimmed }),
      }).catch(() => {
        // Never interrupt a live interview over a failed transcript write.
      });
    },
    [id]
  );

  const { start, stop, listening, supported } = useSpeechRecognition((text, isFinal) => {
    if (!isFinal) {
      setInterim(text);
      return;
    }
    setInterim("");
    if (looksLikeQuestion(text) && hasEnoughQuestionContext(text)) {
      const isFollowUp = text.trim().split(/\s+/).length < 10 && Boolean(currentQuestion);
      submitQuestion(text, isFollowUp);
      return;
    }
    // Everything else is treated as the candidate speaking. Persisting it is
    // what makes the post-interview report possible - otherwise the only
    // record of the interview is the questions plus what we *suggested* they
    // say, which is not the same thing as what they actually said.
    recordCandidateSpeech(text);
  });

  useEffect(() => {
    if (supported) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported]);

  // Hotkeys
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if (e.key === "q" || e.key === "Q") setDisplayMode((m) => (m === "quick_glance" ? "standard" : "quick_glance"));
      if (e.key === "1") setResponseLength("quick");
      if (e.key === "2") setResponseLength("standard");
      if (e.key === "3") setResponseLength("detailed");
      if (e.key === "s" || e.key === "S")
        if (currentQuestion) submitQuestion(currentQuestion, false, { answerStyle: "star" });
      if (e.key === "r" || e.key === "R") if (currentQuestion) submitQuestion(currentQuestion, false);
      if (e.key === "m" || e.key === "M") manualRef.current?.focus();
      if (e.key === "p" || e.key === "P") {
        if (listening) stop();
        else start();
      }
      if (e.key === "h" || e.key === "H") setDisplayMode((m) => (m === "discreet" ? "standard" : "discreet"));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentQuestion, listening, start, stop, submitQuestion]);

  async function endInterview() {
    setEnding(true);
    stop();
    await fetch(`/api/sessions/${id}/end`, { method: "POST" });
    router.push(`/history/${id}`);
  }

  function submitManual() {
    if (!manualQuestion.trim()) return;
    submitQuestion(manualQuestion.trim(), false);
    setManualQuestion("");
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  const isQuickGlance = displayMode === "quick_glance";
  const isDiscreet = displayMode === "discreet";
  const isCompact = displayMode === "compact";

  return (
    <div className={clsx("min-h-screen bg-surface-muted flex flex-col", isCompact && "max-w-md mx-auto")}>
      <header className="flex items-center justify-between px-5 py-3 bg-midnight text-white">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={clsx("h-2 w-2 rounded-full bg-brand-success", listening && "pulse-dot")} />
          {listening ? "LISTENING" : "PAUSED"}
        </div>
        <div className="text-sm font-medium truncate">
          {job ? `${job.company} — ${job.jobTitle}` : "Live Interview"}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="tabular-nums text-white/70">{mm}:{ss}</span>
          <ThemeToggle compact />
          <button onClick={() => (listening ? stop() : start())} title="Pause/Resume" className="text-white/70 hover:text-white">
            {listening ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button onClick={() => setDisplayMode(isCompact ? "standard" : "compact")} title="Toggle compact mode" className="text-white/70 hover:text-white">
            {isCompact ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button onClick={endInterview} disabled={ending} title="End" className="text-red-300 hover:text-red-200">
            <PhoneOff size={16} />
          </button>
        </div>
      </header>

      {!isDiscreet && (
        <div className="px-5 py-3 bg-surface border-b border-surface-border">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">Interviewer asked</p>
            {isFollowUpAnswer && currentAnswer && (
              <span className="rounded-full bg-sky-50 border border-sky-200 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-sky-700">
                Follow-up
              </span>
            )}
          </div>
          <p className="text-sm text-navy mt-0.5">{currentQuestion || (interim ? `"${interim}"` : "Waiting for a question...")}</p>
        </div>
      )}
      {isDiscreet && (currentQuestion || interim) && (
        <div className="px-5 py-2 bg-surface border-b border-surface-border">
          <p className="text-xs text-navy/70 truncate">{currentQuestion || interim}</p>
        </div>
      )}

      <div className={clsx("flex-1 grid gap-0", !isCompact && !isQuickGlance && "md:grid-cols-[65%_35%]")}>
        <div className={clsx("p-5 bg-surface border-r border-surface-border", isDiscreet && "text-sm")}>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40 mb-2">Say This</p>
          {/* Tokens paint as they arrive; the finalised answer replaces them. */}
          {(currentAnswer || streamingText) && (
            <p className={clsx("text-navy leading-relaxed", isDiscreet ? "text-sm" : "text-base")}>
              {showingMore && moreDetail ? moreDetail : currentAnswer ? currentAnswer.say_this : streamingText}
              {!currentAnswer && <span className="ml-0.5 inline-block animate-pulse text-brand-blue">▍</span>}
            </p>
          )}
          {loading && !streamingText && (
            <p className="text-sm text-navy/40">Finding your strongest verified experience...</p>
          )}
          {!loading && !currentAnswer && !streamingText && (
            <p className="text-sm text-navy/40">Your personalized answer will appear here.</p>
          )}

          {/* Open short, expand only if they probe. Mid-interview this has to
              be one tap with nothing to wait for, so both versions arrived
              together with the answer. */}
          {moreDetail && !loading && (
            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" onClick={() => setShowingMore((v) => !v)}>
                {showingMore ? "Back to the short version" : "They asked for more"}
              </Button>
              {!showingMore && (
                <span className="text-[11px] text-navy/45">More detail ready if they probe.</span>
              )}
            </div>
          )}

          {correction && correction.length > 0 && (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800">
              An unverified claim was removed from this answer before you say it.
            </p>
          )}

          {!currentAnswer && streamingText && (
            <p className="mt-4 text-xs text-navy/35">Checking every claim against your verified experience...</p>
          )}

          {currentAnswer && (
            <button
              onClick={() => setShowEvidence((v) => !v)}
              className="mt-4 inline-flex items-center gap-1.5 text-xs text-brand-success font-medium"
            >
              <ShieldCheck size={13} /> Answer Grounded in Your Experience — {currentAnswer.facts_used?.length ?? 0} verified fact(s)
              {showEvidence ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          {showEvidence && currentAnswer && (
            <div className="mt-2 space-y-1 text-xs text-navy/60">
              {(currentAnswer.facts_used ?? []).map((f, i) => (
                <p key={i}>• {f.claim} — <span className="text-navy/40">{f.source}</span></p>
              ))}
              {(currentAnswer.transferable_experience ?? []).map((t, i) => (
                <p key={`t${i}`}>↔ {t.requirement}: {t.candidate_equivalent}</p>
              ))}
            </div>
          )}

          {!isQuickGlance && (
            <div className="mt-6 flex flex-wrap items-center gap-1.5">
              {(["quick", "standard", "detailed"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setResponseLength(l)}
                  className={clsx(
                    "px-2.5 py-1 rounded-full text-xs border",
                    responseLength === l ? "bg-brand-blue text-white border-brand-blue" : "border-surface-border text-navy/60"
                  )}
                >
                  {l === "quick" ? "15 Sec" : l === "standard" ? "30 Sec" : "60 Sec"}
                </button>
              ))}
              {(
                [
                  ["star", "STAR"],
                  ["natural", "More Natural"],
                  ["executive", "More Executive"],
                ] as const
              ).map(([style, label]) => (
                <button
                  key={style}
                  onClick={() => currentQuestion && submitQuestion(currentQuestion, false, { answerStyle: style })}
                  disabled={!currentQuestion || loading}
                  className="px-2.5 py-1 rounded-full text-xs border border-surface-border text-navy/60 disabled:opacity-40"
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => currentQuestion && submitQuestion(currentQuestion, false)}
                disabled={!currentQuestion || loading}
                className="px-2.5 py-1 rounded-full text-xs border border-surface-border text-navy/60 disabled:opacity-40"
              >
                Regenerate
              </button>
              <button
                onClick={() => setDisplayMode("quick_glance")}
                className="px-2.5 py-1 rounded-full text-xs border border-surface-border text-navy/60"
              >
                Quick Glance
              </button>
            </div>
          )}
        </div>

        {!isCompact && !isQuickGlance && (
          <div className="p-5 bg-surface-muted overflow-y-auto">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40 mb-3">Remember This</p>

            {(currentAnswer || earlyCues.length > 0) && availableStories.length > 0 && (
              <div className="mb-3 rounded-lg border border-surface-border bg-surface p-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-navy/40">Using</p>
                <p className="mt-0.5 text-xs text-navy">
                  {availableStories.find(
                    (st) => st.id === (currentAnswer?.story_id ?? earlyStoryId)
                  )?.title ??
                    "No specific career story"}
                </p>

                {storyAlreadyUsed && (
                  <p className="mt-1.5 text-[11px] text-brand-warning">
                    Story previously used this interview.
                  </p>
                )}

                <button
                  onClick={() => setShowStorySwitch((v) => !v)}
                  className="mt-1.5 text-[11px] font-medium text-brand-blue"
                >
                  {showStorySwitch ? "Cancel" : "Switch Story"}
                </button>

                {showStorySwitch && (
                  <div className="mt-1.5 space-y-1">
                    {availableStories
                      .filter((st) => st.id !== (currentAnswer?.story_id ?? earlyStoryId))
                      .map((st) => (
                        <button
                          key={st.id}
                          onClick={() =>
                            currentQuestion &&
                            submitQuestion(currentQuestion, isFollowUpAnswer, { preferredStoryId: st.id })
                          }
                          className="block w-full rounded border border-surface-border px-2 py-1 text-left text-[11px] text-navy/70 hover:bg-surface-muted"
                        >
                          {st.title}
                          {st.alreadyUsed && <span className="text-brand-warning"> · used</span>}
                        </button>
                      ))}
                    {availableStories.length <= 1 && (
                      <p className="text-[11px] text-navy/40">No alternative stories available.</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-3">
              {(currentAnswer?.remember_this ?? earlyCues).map((cue, i) => (
                <div key={i} className="rounded-lg bg-surface border border-surface-border p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-navy/40">{cue.label}</p>
                  <p className="mt-1 text-sm text-navy">{cue.value}</p>
                  {cue.verification && (
                    <div className="mt-1">
                      <VerificationBadge status={cue.verification} />
                    </div>
                  )}
                </div>
              ))}
              {!currentAnswer && earlyCues.length === 0 && (
                <p className="text-sm text-navy/40">Cues will appear here once you get a question.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {isQuickGlance && (currentAnswer || earlyCues.length > 0) && (
        <div className="p-5 bg-surface-muted grid grid-cols-2 gap-2">
          {(currentAnswer?.remember_this ?? earlyCues).slice(0, 6).map((cue, i) => (
            <div key={i} className="rounded-lg bg-surface border border-surface-border p-2.5 text-xs">
              <p className="font-semibold text-navy/40 uppercase">{cue.label}</p>
              <p className="text-navy mt-0.5">{cue.value}</p>
            </div>
          ))}
        </div>
      )}

      {error && <p className="px-5 py-2 text-xs text-brand-danger bg-red-50">{error}</p>}

      {!isDiscreet && (
        <div className="border-t border-surface-border bg-surface px-5 py-3 flex items-center gap-2">
          <button
            onClick={() => (listening ? stop() : start())}
            className={clsx("p-2 rounded-lg border", listening ? "border-brand-blue text-brand-blue" : "border-surface-border text-navy/40")}
            title={supported ? "Toggle microphone" : "Not supported in this browser"}
          >
            {listening ? <Mic size={15} /> : <MicOff size={15} />}
          </button>
          <textarea
            ref={manualRef}
            rows={1}
            placeholder="Type the interviewer's question... (Ctrl/Cmd+Enter to send)"
            value={manualQuestion}
            onChange={(e) => setManualQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitManual();
            }}
            className="flex-1 rounded-lg border border-surface-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-blue/40"
          />
          <button
            onClick={submitManual}
            disabled={!manualQuestion.trim() || loading}
            className="rounded-lg bg-brand-blue px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
            title="Send question (Ctrl/Cmd+Enter)"
          >
            <SendHorizonal size={15} />
          </button>
          <button onClick={() => setShowTranscript((v) => !v)} className="p-2 rounded-lg border border-surface-border text-navy/40" title="Transcript">
            <Keyboard size={15} />
          </button>
        </div>
      )}

      {showTranscript && (
        <div className="border-t border-surface-border bg-surface max-h-52 overflow-y-auto px-5 py-3 space-y-2">
          {transcript.map((t, i) => (
            <p key={i} className="text-xs">
              <span
                className={clsx(
                  "font-semibold",
                  t.speaker === "interviewer"
                    ? "text-navy"
                    : t.speaker === "candidate"
                    ? "text-brand-success"
                    : "text-brand-blue"
                )}
              >
                {t.speaker === "interviewer"
                  ? "Interviewer: "
                  : t.speaker === "candidate"
                  ? "You: "
                  : "Copilot: "}
              </span>
              <span className="text-navy/60">{t.text}</span>
            </p>
          ))}
          {transcript.length === 0 && <p className="text-xs text-navy/40">No turns yet.</p>}
        </div>
      )}
    </div>
  );
}
