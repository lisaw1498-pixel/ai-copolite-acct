"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, StopCircle, Volume2, VolumeX, Loader2, Lightbulb, ShieldCheck } from "lucide-react";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";
import { useSpeechSynthesis } from "@/lib/use-speech-synthesis";

type Turn = {
  id: string;
  speaker: string;
  rawTranscript: string | null;
  cleanedTranscript: string | null;
};

export default function MockSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { speak, cancel, speaking, supported: voiceSupported } = useSpeechSynthesis();
  const [voiceOn, setVoiceOn] = useState(true);
  // Questions already read aloud, so re-fetching the transcript doesn't make
  // the interviewer repeat itself.
  const spokenRef = useRef<Set<string>>(new Set());
  const wasListeningRef = useRef(false);
  const primedRef = useRef(false);
  const bootstrappedRef = useRef(false);

  // Coaching mode: show a grounded suggested answer for the question just
  // asked, so the candidate can read it aloud and practise saying it.
  const [coachOn, setCoachOn] = useState(true);
  const [suggestion, setSuggestion] = useState("");
  const [suggestionCues, setSuggestionCues] = useState<{ label: string; value: string }[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  // Whether what is on screen is the answer the candidate wrote for this
  // question, rather than one generated just now.
  const [suggestionSource, setSuggestionSource] = useState<"prepared" | "generated">("generated");
  const suggestedForRef = useRef<string | null>(null);

  const { start, stop, listening, supported } = useSpeechRecognition((text, isFinal) => {
    if (isFinal) setAnswer((prev) => (prev ? prev + " " + text : text));
  });

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}`);
    const data = await res.json();
    setTurns(data.turns || []);
  }, [id]);

  const bootstrap = useCallback(async () => {
    setBusy(true);
    await fetch(`/api/sessions/${id}/mock-turn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    await refresh();
    setBusy(false);
  }, [id, refresh]);

  useEffect(() => {
    // Guard against this effect running twice (React re-invokes mount effects
    // in development). Without it the interview opened with the same question
    // asked twice, and paid for two model calls to do it.
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;
    (async () => {
      const res = await fetch(`/api/sessions/${id}`);
      const data = await res.json();
      if (!data.turns?.length) await bootstrap();
      else setTurns(data.turns);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("mockVoiceOn");
      if (saved !== null) setVoiceOn(saved === "true");
    } catch {
      // Private mode / blocked storage - just keep the default.
    }
  }, []);

  // Read each new interviewer question aloud.
  //
  // The microphone must be muted while this plays. Speakers feed straight back
  // into the recognizer, and without this the interviewer's own question gets
  // transcribed into the candidate's answer box.
  useEffect(() => {
    if (!voiceOn || !voiceSupported || turns.length === 0) return;

    // On the first render of an existing transcript, mark what is already
    // there as spoken. Re-opening a session should not blurt out a question
    // the candidate has already heard and answered - and browsers can block
    // audio that starts without a user interaction anyway. "Repeat Question"
    // covers the case where they do want to hear it again.
    if (!primedRef.current) {
      primedRef.current = true;
      const isFreshInterview =
        turns.length === 1 && turns[0].speaker === "ai_interviewer";
      if (!isFreshInterview) {
        turns.forEach((t) => spokenRef.current.add(t.id));
        return;
      }
    }

    const latest = [...turns].reverse().find((t) => t.speaker === "ai_interviewer");
    if (!latest || spokenRef.current.has(latest.id)) return;

    // Mark before speaking so a re-render cannot double-trigger it.
    spokenRef.current.add(latest.id);
    const text = latest.cleanedTranscript || latest.rawTranscript || "";
    if (!text.trim()) return;

    wasListeningRef.current = listening;
    if (listening) stop();
    void speak(text).finally(() => {
      if (wasListeningRef.current) start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, voiceOn, voiceSupported]);

  const fetchSuggestion = useCallback(
    async (question: string) => {
      setSuggesting(true);
      setSuggestion("");
      setSuggestionCues([]);
      setSuggestionSource("generated");
      try {
        const res = await fetch(`/api/sessions/${id}/suggest`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question }),
        });
        if (!res.ok || !res.body) {
          setSuggestion("Couldn't load a suggested answer.");
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamed = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let split;
          while ((split = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, split);
            buffer = buffer.slice(split + 2);
            const lines = frame.split("\n");
            const ev = lines.find((l) => l.startsWith("event: "))?.slice(7).trim();
            const dataLine = lines.find((l) => l.startsWith("data: "));
            if (!ev || !dataLine) continue;
            const payload = JSON.parse(dataLine.slice(6));
            if (ev === "delta") {
              streamed += payload.text;
              setSuggestion(streamed);
            } else if (ev === "cues") {
              setSuggestionCues((payload.remember_this ?? []).slice(0, 6));
            } else if (ev === "final") {
              setSuggestion(payload.generated.say_this);
              setSuggestionCues((payload.generated.remember_this ?? []).slice(0, 6));
              if (payload.source === "prepared") setSuggestionSource("prepared");
            } else if (ev === "error") {
              setSuggestion(payload.error || "Couldn't suggest an answer.");
            }
          }
        }
      } catch {
        setSuggestion("Couldn't load a suggested answer.");
      } finally {
        setSuggesting(false);
      }
    },
    [id]
  );

  // Suggest an answer for each new question, once.
  useEffect(() => {
    if (!coachOn) return;
    const latest = [...turns].reverse().find((t) => t.speaker === "ai_interviewer");
    const text = latest?.cleanedTranscript || latest?.rawTranscript || "";
    if (!latest || !text.trim()) return;
    // Only for the question currently awaiting an answer.
    if (turns[turns.length - 1]?.id !== latest.id) return;
    if (suggestedForRef.current === latest.id) return;
    suggestedForRef.current = latest.id;
    void fetchSuggestion(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns, coachOn]);

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) cancel();
    try {
      localStorage.setItem("mockVoiceOn", String(next));
    } catch {
      // Preference just won't persist; not worth surfacing.
    }
  }

  function replayQuestion() {
    if (!lastQuestion.trim()) return;
    wasListeningRef.current = listening;
    if (listening) stop();
    void speak(lastQuestion).finally(() => {
      if (wasListeningRef.current) start();
    });
  }

  const lastQuestion = [...turns].reverse().find((t) => t.speaker === "ai_interviewer")?.cleanedTranscript || "";

  async function submitAnswer() {
    if (!answer.trim()) return;
    if (listening) stop();
    setBusy(true);
    await fetch(`/api/sessions/${id}/mock-turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ candidateAnswer: answer, lastQuestion }),
    });
    setAnswer("");
    await refresh();
    setBusy(false);
  }

  async function endInterview() {
    setEnding(true);
    cancel();
    if (listening) stop();
    await fetch(`/api/sessions/${id}/end`, { method: "POST" });
    router.push(`/history/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col h-[calc(100vh-2rem)]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-brand-blue uppercase tracking-wide">Mock Interview</p>
          <h1 className="text-lg font-semibold text-navy">Practice Session</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setCoachOn((v) => !v)}
            title={coachOn ? "Hide suggested answers" : "Show a suggested answer for each question"}
          >
            <Lightbulb size={15} /> {coachOn ? "Coaching On" : "Coaching Off"}
          </Button>
          {voiceSupported && (
            <>
              <Button
                variant="secondary"
                onClick={replayQuestion}
                disabled={!lastQuestion || speaking}
                title="Hear the question again"
              >
                Repeat Question
              </Button>
              <Button
                variant="secondary"
                onClick={toggleVoice}
                title={voiceOn ? "Mute the interviewer" : "Hear the interviewer"}
              >
                {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </Button>
            </>
          )}
          <Button variant="danger" onClick={endInterview} disabled={ending}>
            <StopCircle size={15} /> {ending ? "Ending..." : "End Interview"}
          </Button>
        </div>
      </div>

      <Card className="flex-1 overflow-y-auto p-5 space-y-4">
        {turns.map((t) => (
          <div key={t.id} className={`flex ${t.speaker === "ai_interviewer" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                t.speaker === "ai_interviewer" ? "bg-surface-muted text-navy" : "bg-brand-blue text-white"
              }`}
            >
              {t.cleanedTranscript || t.rawTranscript}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-navy/40">The interviewer is thinking...</p>}
        {speaking && (
          <p className="flex items-center gap-1.5 text-xs text-brand-blue">
            <Loader2 size={12} className="animate-spin" /> Interviewer is speaking - your mic is
            muted until they finish.
          </p>
        )}
        <div ref={bottomRef} />
      </Card>

      {coachOn && (suggesting || suggestion) && (
        <Card className="mt-4 border-brand-blue/30 bg-accent-soft/40 p-4">
          <div className="flex items-center gap-1.5">
            <Lightbulb size={13} className="text-brand-blue" />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-blue">
              {suggestionSource === "prepared"
                ? "Your prepared answer — practise reading it aloud"
                : "Say this — practise reading it aloud"}
            </p>
          </div>

          {suggesting && !suggestion && (
            <p className="mt-2 text-sm text-navy/50">Finding your strongest verified experience...</p>
          )}
          {suggestion && (
            <p className="mt-2 text-sm leading-relaxed text-navy">
              {suggestion}
              {suggesting && <span className="ml-0.5 inline-block animate-pulse text-brand-blue">▍</span>}
            </p>
          )}

          {suggestionCues.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {suggestionCues.map((cue, i) => (
                <span
                  key={i}
                  className="rounded-full border border-surface-border bg-surface px-2 py-0.5 text-[11px] text-navy/70"
                >
                  <span className="font-semibold text-navy/40">{cue.label}:</span> {cue.value}
                </span>
              ))}
            </div>
          )}

          {suggestion && !suggesting && (
            <p className="mt-3 flex items-center gap-1 text-[11px] text-brand-success">
              <ShieldCheck size={12} />{" "}
              {suggestionSource === "prepared"
                ? "This is the answer you wrote and approved for this question."
                : "Grounded in your verified experience — say it in your own words, don't recite it."}
            </p>
          )}
        </Card>
      )}

      <div className="mt-4 flex items-end gap-2">
        <textarea
          className="flex-1 rounded-lg border border-surface-border p-3 text-sm outline-none focus:ring-2 focus:ring-brand-blue/40"
          rows={3}
          placeholder="Type or speak your answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitAnswer();
          }}
        />
        <div className="flex flex-col gap-2">
          <Button
            variant={listening ? "danger" : "secondary"}
            onClick={() => (listening ? stop() : start())}
            disabled={!supported}
            title={supported ? "Toggle voice input" : "Speech recognition isn't supported in this browser"}
          >
            {listening ? <MicOff size={15} /> : <Mic size={15} />}
          </Button>
          <Button onClick={submitAnswer} disabled={busy || !answer.trim()}>
            <Send size={15} />
          </Button>
        </div>
      </div>
      {!supported && (
        <p className="mt-2 text-xs text-navy/40">
          Voice input needs Chrome or Edge. You can still type your answers above.
        </p>
      )}
      {!voiceSupported && (
        <p className="mt-2 text-xs text-navy/40">
          Spoken questions need Chrome or Edge. The questions are still shown above.
        </p>
      )}
    </div>
  );
}
