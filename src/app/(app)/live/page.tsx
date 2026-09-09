"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { isVerified } from "@/lib/verification";
import { isSpeechRecognitionSupported } from "@/lib/use-speech-recognition";
import { Radio, AlertTriangle } from "lucide-react";

type Job = { id: string; company: string; jobTitle: string; matchScore: number | null };
type Fact = { verificationStatus: string };

export default function LiveLaunchPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [facts, setFacts] = useState<Fact[]>([]);
  const [responseStyle, setResponseStyle] = useState<"quick" | "standard" | "detailed">("standard");
  const [displayMode, setDisplayMode] = useState<"standard" | "compact" | "discreet" | "quick_glance">("standard");
  const [consent, setConsent] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [micSupported, setMicSupported] = useState(true);

  useEffect(() => {
    setMicSupported(isSpeechRecognitionSupported());
    fetch("/api/jobs").then((r) => r.json()).then((d) => setJobs(d.jobs || []));
    fetch("/api/facts").then((r) => r.json()).then((d) => setFacts(d.facts || []));
  }, []);

  const verifiedCount = facts.filter((f) => isVerified(f.verificationStatus)).length;
  const unresolvedCount = facts.filter((f) => f.verificationStatus === "unverified" || f.verificationStatus === "conflicted").length;
  const selectedJob = jobs.find((j) => j.id === jobId);

  async function launch() {
    setLaunching(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionType: "live", jobId: jobId || null, config: { responseStyle, displayMode } }),
    });
    const data = await res.json();
    router.push(`/live/session/${data.session.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Ready to Launch?" subtitle="Review your setup before starting the Live Interview Copilot." />

      <Card>
        <CardHeader title="Interview" />
        <div className="p-5 space-y-3">
          <select className="input" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">No specific job selected</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.jobTitle} — {j.company}</option>)}
          </select>
          {selectedJob && (
            <p className="text-xs text-navy/50">Match score: {selectedJob.matchScore ?? "—"}%</p>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Experience Verification Check" />
        <div className="p-5 grid grid-cols-2 gap-3">
          <StatCard label="Verified Facts Available" value={verifiedCount} tone="green" />
          <StatCard label="Unresolved Items" value={unresolvedCount} tone="amber" />
        </div>
        {unresolvedCount > 0 && (
          <p className="px-5 pb-4 text-xs text-navy/50">
            {unresolvedCount} experience item(s) need your confirmation.{" "}
            <a href="/profile/verified-experience" className="text-brand-blue hover:underline">Review Experience</a> — or launch
            anyway and unresolved facts will simply be excluded from live answers.
          </p>
        )}
      </Card>

      <Card>
        <CardHeader title="Response style" />
        <div className="p-5 flex gap-2">
          {(["quick", "standard", "detailed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setResponseStyle(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${
                responseStyle === s ? "bg-brand-blue text-white border-brand-blue" : "border-surface-border text-navy/60"
              }`}
            >
              {s}{s === "standard" ? " (recommended)" : ""}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Display mode" />
        <div className="p-5 flex flex-wrap gap-2">
          {(["standard", "compact", "discreet", "quick_glance"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDisplayMode(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize border ${
                displayMode === m ? "bg-brand-blue text-white border-brand-blue" : "border-surface-border text-navy/60"
              }`}
            >
              {m.replace("_", " ")}
            </button>
          ))}
        </div>
      </Card>

      {!micSupported && (
        <Card className="p-4 flex gap-2 items-start border-amber-200 bg-amber-50">
          <AlertTriangle size={16} className="text-brand-warning shrink-0 mt-0.5" />
          <p className="text-xs text-navy/70">
            This browser doesn&apos;t support live speech recognition. You can still use Manual Question Mode to type
            the interviewer&apos;s question and get instant answers.
          </p>
        </Card>
      )}

      <Card className="p-5">
        <label className="flex items-start gap-2 text-sm text-navy/70">
          <input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          Make sure your use of transcription or recording complies with applicable laws, company policies, interview
          rules, and consent requirements. I understand.
        </label>
      </Card>

      <Button className="w-full" disabled={!consent || launching} onClick={launch}>
        <Radio size={15} /> {launching ? "Launching..." : "Launch Interview Copilot"}
      </Button>

      <style jsx global>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
      `}</style>
    </div>
  );
}
