"use client";

import { useCallback, useEffect, useState, use } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

type SessionDetail = {
  session: { id: string; sessionType: string; overallScore: number | null; durationSeconds: number | null };
  job: { company: string; jobTitle: string } | null;
  turns: { id: string; speaker: string; cleanedTranscript: string | null; questionDetected: boolean | null }[];
  answers: { id: string; question: string; answer: string; confidence: number | null }[];
  scores: { relevanceScore: number | null; clarityScore: number | null; starScore: number | null; metricsScore: number | null; jobAlignmentScore: number | null }[];
  report: {
    summary: string;
    strongMomentsJson: string[];
    concernsJson: string[];
    repeatedThemesJson: string[];
    employerDetailsJson: Record<string, string>;
    thankYouDraft: string;
  } | null;
  reportStatus?: "ready" | "processing" | "failed" | "not_enough" | "none";
  reportError?: string | null;
};

export default function SessionReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SessionDetail | null>(null);
  const [tone, setTone] = useState<"professional" | "warm" | "concise">("professional");
  const [regenerating, setRegenerating] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}`);
    setData(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // The report is generated in the background after the interview ends, so
  // keep refreshing until it lands rather than showing "no report" to someone
  // who has just finished an interview.
  useEffect(() => {
    if (data?.reportStatus !== "processing") return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [data?.reportStatus, load]);

  async function retryReport() {
    setRetrying(true);
    await fetch(`/api/sessions/${id}/end`, { method: "POST" });
    await load();
    setRetrying(false);
  }

  async function regenerateEmail(newTone: typeof tone) {
    setTone(newTone);
    setRegenerating(true);
    const res = await fetch(`/api/sessions/${id}/thank-you`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tone: newTone }),
    });
    const d = await res.json();
    setRegenerating(false);
    if (data?.report && d.email) {
      setData({ ...data, report: { ...data.report, thankYouDraft: d.email } });
    }
  }

  if (!data) return <div className="p-8 text-sm text-navy/50">Loading...</div>;

  const avgScore = (key: keyof NonNullable<SessionDetail["scores"][number]>) => {
    const vals = data.scores.map((s) => s[key]).filter((v): v is number => typeof v === "number");
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title="Interview Complete"
        subtitle={data.job ? `${data.job.jobTitle} — ${data.job.company}` : "General practice session"}
      />

      {data.session.sessionType === "mock" && data.scores.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Relevance" value={avgScore("relevanceScore")} tone="blue" />
          <StatCard label="Clarity" value={avgScore("clarityScore")} tone="blue" />
          <StatCard label="STAR" value={avgScore("starScore")} tone="teal" />
          <StatCard label="Metrics" value={avgScore("metricsScore")} tone="teal" />
          <StatCard label="Job Alignment" value={avgScore("jobAlignmentScore")} tone="green" />
        </div>
      )}

      {data.report ? (
        <>
          <Card>
            <CardHeader title="Summary" />
            <p className="px-5 py-4 text-sm text-navy/80">{data.report.summary}</p>
          </Card>
          <Card>
            <CardHeader title="Strong moments" />
            <ul className="px-5 py-4 space-y-1 text-sm text-navy/70 list-disc list-inside">
              {data.report.strongMomentsJson?.map((s, i) => <li key={i}>{s}</li>)}
              {(!data.report.strongMomentsJson || data.report.strongMomentsJson.length === 0) && <li className="list-none text-navy/40">None noted.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Possible concerns" />
            <ul className="px-5 py-4 space-y-1 text-sm text-navy/70 list-disc list-inside">
              {data.report.concernsJson?.map((s, i) => <li key={i}>{s}</li>)}
              {(!data.report.concernsJson || data.report.concernsJson.length === 0) && <li className="list-none text-navy/40">None noted.</li>}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Repeated themes" />
            <div className="px-5 py-4 flex flex-wrap gap-2">
              {data.report.repeatedThemesJson?.map((s, i) => (
                <span key={i} className="text-xs bg-surface-muted text-navy/70 rounded-full px-2.5 py-1">{s}</span>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="What the employer revealed" />
            <dl className="px-5 py-4 space-y-2 text-sm">
              {Object.entries(data.report.employerDetailsJson || {})
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xs font-medium text-navy/40 capitalize">{k.replace(/_/g, " ")}</dt>
                    <dd className="text-navy/80">{v}</dd>
                  </div>
                ))}
            </dl>
          </Card>
          <Card>
            <CardHeader
              title="Thank-you email"
              action={
                <div className="flex gap-1.5">
                  {(["professional", "warm", "concise"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => regenerateEmail(t)}
                      className={`px-2.5 py-1 rounded-full text-xs border capitalize ${tone === t ? "bg-brand-blue text-white border-brand-blue" : "border-surface-border text-navy/60"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              }
            />
            <div className="px-5 py-4">
              {regenerating ? (
                <p className="text-sm text-navy/40">Generating...</p>
              ) : (
                <textarea readOnly className="w-full rounded-lg border border-surface-border p-3 text-sm" rows={8} value={data.report.thankYouDraft} />
              )}
              <div className="mt-2 flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => navigator.clipboard.writeText(data.report?.thankYouDraft || "")}
                >
                  <Copy size={14} /> Copy
                </Button>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card className="p-8 text-center text-sm">
          {data.reportStatus === "processing" ? (
            <div className="text-navy/60">
              <p className="font-medium text-navy">Analyzing your interview...</p>
              <p className="mt-1 text-navy/50">
                Reading the full transcript and drafting your follow-up email. This takes about a
                minute — the page updates on its own.
              </p>
            </div>
          ) : data.reportStatus === "not_enough" ? (
            <div className="text-navy/60">
              <p className="font-medium text-navy">Not enough of the interview to report on</p>
              <p className="mt-1 text-navy/50">
                This session ended before you answered anything, so there is nothing to review. A
                report is built from what you actually said — run the interview again and answer a
                few questions.
              </p>
            </div>
          ) : data.reportStatus === "failed" ? (
            <div className="text-navy/60">
              <p className="text-brand-danger">{data.reportError || "Report generation failed."}</p>
              <Button className="mt-3" onClick={retryReport} disabled={retrying}>
                {retrying ? "Retrying..." : "Generate report"}
              </Button>
            </div>
          ) : (
            <span className="text-navy/50">No report generated for this session.</span>
          )}
        </Card>
      )}
    </div>
  );
}
