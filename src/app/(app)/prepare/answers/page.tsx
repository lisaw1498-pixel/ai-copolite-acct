"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";

type Item = {
  answer: { id: string; standardAnswer: string | null; approved: boolean | null };
  question: { id: string; question: string; category: string | null; jobId: string | null } | null;
  job: { id: string; company: string; jobTitle: string } | null;
};

export default function AnswerLibraryPage() {
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    fetch("/api/answers")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
      <PageHeader title="Answer Library" subtitle={`${items.length} prepared answer(s)`} />
      {items.map((item) => (
        <Card key={item.answer.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-navy">{item.question?.question}</p>
              <p className="text-xs text-navy/50 mt-0.5">{item.job ? `${item.job.jobTitle} — ${item.job.company}` : "General"}</p>
            </div>
            {item.answer.approved && (
              <Pill tone="green"><CheckCircle2 size={11} className="inline mr-1" />Approved</Pill>
            )}
          </div>
          <p className="mt-2 text-sm text-navy/70">{item.answer.standardAnswer}</p>
          {item.question?.jobId && (
            <a
              href={`/prepare/${item.question.jobId}/answers/${item.question.id}`}
              className="mt-2 inline-block text-xs text-brand-blue hover:underline"
            >
              Edit this answer
            </a>
          )}
        </Card>
      ))}
      {items.length === 0 && <p className="text-sm text-navy/50">No approved or generated answers yet.</p>}
    </div>
  );
}
