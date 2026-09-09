"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Job = { id: string; company: string; jobTitle: string; matchScore: number | null };

export default function PrepareHubPage() {
  const [jobs, setJobs] = useState<Job[]>([]);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => setJobs(d.jobs || []));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Interview Prep" subtitle="Choose a job opportunity to prepare for." />
      <div className="grid md:grid-cols-2 gap-4">
        {jobs.map((j) => (
          <Card key={j.id} className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-navy">{j.jobTitle}</p>
              <p className="text-xs text-navy/50">{j.company}</p>
            </div>
            <Button href={`/prepare/${j.id}`}>Prepare</Button>
          </Card>
        ))}
        {jobs.length === 0 && (
          <p className="text-sm text-navy/50">
            No jobs yet. <Link href="/jobs" className="text-brand-blue hover:underline">Add a job opportunity</Link> to start
            preparing.
          </p>
        )}
      </div>
    </div>
  );
}
