"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Row = {
  session: {
    id: string;
    sessionType: string;
    startedAt: string;
    durationSeconds: number | null;
    status: string;
    overallScore: number | null;
  };
  job: { company: string; jobTitle: string } | null;
};

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/sessions");
    const data = await res.json();
    setRows(data.sessions || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      <PageHeader title="Interview History" subtitle="Every mock and live session you've run." />
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-navy/40 border-b border-surface-border">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Company / Role</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Duration</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-border">
            {rows.map(({ session: s, job }) => (
              <tr key={s.id}>
                <td className="px-5 py-3 text-navy/60">{s.startedAt ? new Date(s.startedAt).toLocaleDateString() : ""}</td>
                <td className="px-5 py-3 text-navy">{job ? `${job.jobTitle} — ${job.company}` : "General practice"}</td>
                <td className="px-5 py-3"><Pill tone={s.sessionType === "live" ? "blue" : "teal"}>{s.sessionType}</Pill></td>
                <td className="px-5 py-3 text-navy/60">{s.durationSeconds ? `${Math.round(s.durationSeconds / 60)} min` : "—"}</td>
                <td className="px-5 py-3 text-navy/60">{s.overallScore ? `${s.overallScore.toFixed(1)}/10` : "—"}</td>
                <td className="px-5 py-3"><Pill tone={s.status === "ended" ? "green" : "amber"}>{s.status}</Pill></td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Button variant="ghost" href={`/history/${s.id}`}>Review</Button>
                    <button onClick={() => remove(s.id)}><Trash2 size={14} className="text-brand-danger" /></button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-8 text-center text-navy/40">No interviews yet.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
