"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/badge";

type Job = { id: string; company: string; jobTitle: string };
type Question = { id: string; jobId: string | null; question: string; category: string; likelihood: string; difficulty: string };

export default function QuestionLibraryPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [questionsByJob, setQuestionsByJob] = useState<Record<string, Question[]>>({});

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then(async (d) => {
        const jobList: Job[] = d.jobs || [];
        setJobs(jobList);
        const entries = await Promise.all(
          jobList.map(async (j) => {
            const res = await fetch(`/api/jobs/${j.id}/questions`);
            const data = await res.json();
            return [j.id, data.questions || []] as const;
          })
        );
        setQuestionsByJob(Object.fromEntries(entries));
      });
  }, []);

  const total = Object.values(questionsByJob).reduce((sum, arr) => sum + arr.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Question Library" subtitle={`${total} question(s) across all job opportunities`} />
      {jobs.map((j) => {
        const qs = questionsByJob[j.id] || [];
        if (qs.length === 0) return null;
        return (
          <Card key={j.id}>
            <CardHeader title={`${j.jobTitle} — ${j.company}`} action={<Button variant="ghost" href={`/prepare/${j.id}`}>Open Prep</Button>} />
            <div className="divide-y divide-surface-border">
              {qs.map((q) => (
                <div key={q.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <p className="text-sm text-navy truncate">{q.question}</p>
                  <div className="flex gap-1.5 shrink-0">
                    <Pill>{q.category}</Pill>
                    <Pill tone={q.likelihood === "high" ? "green" : "amber"}>{q.likelihood}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
      {total === 0 && (
        <p className="text-sm text-navy/50">
          No questions generated yet.{" "}
          <Link href="/prepare" className="text-brand-blue hover:underline">
            Prepare for a job
          </Link>{" "}
          to generate some.
        </p>
      )}
    </div>
  );
}
