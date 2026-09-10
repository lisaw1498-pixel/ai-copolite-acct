"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Job = { id: string; company: string; jobTitle: string };

const TYPES = ["Recruiter Screen", "Hiring Manager", "Behavioral", "Technical", "Executive", "Panel Interview", "Final Interview"];
const DIFFICULTIES = ["Supportive", "Realistic", "Challenging", "Aggressive Follow-Up"];
const DURATIONS = ["10", "20", "30", "45", "60"];

export default function MockSetupPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobId, setJobId] = useState("");
  const [interviewType, setInterviewType] = useState(TYPES[2]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [duration, setDuration] = useState(DURATIONS[1]);
  const [starting, setStarting] = useState(false);
  const [toggles, setToggles] = useState({
    useJobDescription: true,
    useResume: true,
    verifiedOnly: true,
    includeGap: true,
    includeTechnical: false,
    includeSalary: false,
  });

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []));
  }, []);

  async function start() {
    setStarting(true);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionType: "mock",
        jobId: jobId || null,
        config: { interviewType, difficulty: difficulty.toLowerCase().replace(/\s/g, "_"), duration, ...toggles },
      }),
    });
    const data = await res.json();
    setStarting(false);
    router.push(`/practice/session/${data.session.id}`);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Practice Before the Real Interview" subtitle="Configure your mock interview." />

      <Card className="p-6 space-y-5">
        <div>
          <label className="text-sm font-medium text-navy/80">Job (optional)</label>
          <select className="input mt-1" value={jobId} onChange={(e) => setJobId(e.target.value)}>
            <option value="">General practice — no specific job</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.jobTitle} — {j.company}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-navy/80">Interview Type</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <Chip key={t} active={interviewType === t} onClick={() => setInterviewType(t)}>{t}</Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-navy/80">Duration</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d} Minutes</Chip>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-navy/80">Difficulty</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {DIFFICULTIES.map((d) => (
              <Chip key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>{d}</Chip>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {Object.entries({
            useJobDescription: "Use Current Job Description",
            useResume: "Use My Resume",
            verifiedOnly: "Use Verified Experience Only",
            includeGap: "Include Gap Questions",
            includeTechnical: "Include Technical Questions",
            includeSalary: "Include Salary Questions",
          }).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-navy/70">
              <input
                type="checkbox"
                checked={toggles[key as keyof typeof toggles]}
                onChange={(e) => setToggles({ ...toggles, [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>

        <Button className="w-full" onClick={start} disabled={starting}>
          {starting ? "Starting..." : "Start Mock Interview"}
        </Button>
      </Card>

      <style jsx global>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid var(--color-border); padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; }
      `}</style>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
        active ? "bg-brand-blue text-white border-brand-blue" : "border-surface-border text-navy/60 hover:bg-surface-muted"
      }`}
    >
      {children}
    </button>
  );
}
