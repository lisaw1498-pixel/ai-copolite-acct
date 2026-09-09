"use client";

import { useCallback, useEffect, useRef, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Send, StopCircle } from "lucide-react";
import { useSpeechRecognition } from "@/lib/use-speech-recognition";

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
        <Button variant="danger" onClick={endInterview} disabled={ending}>
          <StopCircle size={15} /> {ending ? "Ending..." : "End Interview"}
        </Button>
      </div>

      <Card className="flex-1 overflow-y-auto p-5 space-y-4">
        {turns.map((t) => (
          <div key={t.id} className={`flex ${t.speaker === "ai_interviewer" ? "justify-start" : "justify-end"}`}>
            <div
              className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                t.speaker === "ai_interviewer" ? "bg-slate-100 text-navy" : "bg-brand-blue text-white"
              }`}
            >
              {t.cleanedTranscript || t.rawTranscript}
            </div>
          </div>
        ))}
        {busy && <p className="text-xs text-navy/40">The interviewer is thinking...</p>}
        <div ref={bottomRef} />
      </Card>

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
    </div>
  );
}
