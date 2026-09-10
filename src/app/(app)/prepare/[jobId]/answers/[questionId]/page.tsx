"use client";

import { useEffect, useState, use } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VerificationBadge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

type GeneratedAnswer = {
  say_this: string;
  remember_this: { label: string; value: string; verification?: string }[];
  facts_used: { fact_id: string; claim: string; verification_status: string; source: string }[];
  transferable_experience: { requirement: string; candidate_equivalent: string }[];
  excluded_unverified_claims: string[];
  confidence: number;
};

type Lengths = { quick: GeneratedAnswer; standard: GeneratedAnswer; detailed: GeneratedAnswer };

export default function AnswerPrepPage({ params }: { params: Promise<{ jobId: string; questionId: string }> }) {
  const { questionId } = use(params);
  const [question, setQuestion] = useState<string>("");
  const [answers, setAnswers] = useState<Lengths | null>(null);
  const [activeLength, setActiveLength] = useState<keyof Lengths>("standard");
  const [loading, setLoading] = useState(false);
  const [approved, setApproved] = useState(false);
  const [loadedFromSaved, setLoadedFromSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    setApproved(false);
    setLoadedFromSaved(false);
    const res = await fetch(`/api/questions/${questionId}/answer`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Couldn't generate an answer.");
      return;
    }
    setAnswers({ quick: data.quick, standard: data.standard, detailed: data.detailed });
  }

  useEffect(() => {
    fetch(`/api/questions/${questionId}`)
      .then((r) => r.json())
      .then((d) => setQuestion(d.question?.question || ""));

    // Load the saved answer if there is one. Only generate when nothing has
    // been prepared yet - regenerating is an explicit user action, not a side
    // effect of opening the page.
    let cancelled = false;
    setLoading(true);
    fetch(`/api/questions/${questionId}/answer`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.answer) {
          setAnswers({ quick: d.answer.quick, standard: d.answer.standard, detailed: d.answer.detailed });
          setApproved(Boolean(d.answer.approved));
          setLoadedFromSaved(true);
          setLoading(false);
        } else {
          generate();
        }
      })
      .catch(() => {
        if (!cancelled) generate();
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  async function approve() {
    await fetch(`/api/questions/${questionId}/answer/approve`, { method: "POST" });
    setApproved(true);
  }

  const current = answers?.[activeLength];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Answer Preparation" subtitle={question || "Personalized, verified answer"} />

      <div className="flex gap-2">
        {(["quick", "standard", "detailed"] as const).map((len) => (
          <button
            key={len}
            onClick={() => setActiveLength(len)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${
              activeLength === len ? "bg-brand-blue text-white border-brand-blue" : "border-surface-border text-navy/60"
            }`}
          >
            {len === "quick" ? "15–25 sec" : len === "standard" ? "30–60 sec" : "60–90 sec"}
          </button>
        ))}
        <Button variant="ghost" onClick={generate} disabled={loading}>
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Regenerate
        </Button>
      </div>

      {error && <p className="text-sm text-brand-danger">{error}</p>}
      {loading && !answers && <p className="text-sm text-navy/50">Generating a grounded answer...</p>}
      {loadedFromSaved && !loading && (
        <p className="text-xs text-navy/40">
          Showing your saved answer. Regenerating replaces it and clears any approval.
        </p>
      )}

      {current && (
        <>
          <Card>
            <CardHeader title="SAY THIS" subtitle="Personalized answer" />
            <p className="px-5 py-4 text-sm text-navy leading-relaxed">{current.say_this}</p>
            <div className="px-5 pb-4 flex items-center gap-2 text-xs text-brand-success">
              <ShieldCheck size={14} /> Answer Grounded in Your Experience — {current.facts_used.length} verified fact(s) used
            </div>
          </Card>

          <Card>
            <CardHeader title="REMEMBER THIS" subtitle="Glance. Remember. Speak naturally." />
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              {current.remember_this.map((cue, i) => (
                <div key={i} className="rounded-lg bg-surface-muted border border-surface-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">{cue.label}</p>
                  <p className="mt-1 text-sm text-navy">{cue.value}</p>
                  {cue.verification && <div className="mt-1"><VerificationBadge status={cue.verification} /></div>}
                </div>
              ))}
            </div>
          </Card>

          {current.transferable_experience.length > 0 && (
            <Card>
              <CardHeader title="Transferable experience used" />
              <div className="px-5 py-4 space-y-2">
                {current.transferable_experience.map((t, i) => (
                  <p key={i} className="text-sm text-navy/70">
                    <strong>{t.requirement}:</strong> {t.candidate_equivalent}
                  </p>
                ))}
              </div>
            </Card>
          )}

          {current.excluded_unverified_claims.length > 0 && (
            <Card className="border-amber-200">
              <CardHeader title="Excluded unverified claims" subtitle="Removed automatically — not backed by a verified fact" />
              <ul className="px-5 py-4 space-y-1 text-sm text-navy/60 list-disc list-inside">
                {current.excluded_unverified_claims.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={approve} disabled={approved}>
              <CheckCircle2 size={15} /> {approved ? "Approved" : "Approve Answer"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
