"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Save,
  Sparkles,
  Mic,
  Radio,
  Trash2,
  Pencil,
  CheckCircle2,
  Building2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

type Question = {
  id: string;
  question: string;
  category: string | null;
  likelihood: string | null;
  difficulty: string | null;
  generated: boolean | null;
};

type Job = {
  id: string;
  company: string;
  jobTitle: string;
  location: string | null;
  interviewDate: string | null;
  interviewTime: string | null;
  interviewerName: string | null;
  interviewerRole: string | null;
  interviewerNotes: string | null;
  interviewStage: string | null;
  matchScore: number | null;
  companyResearch: string | null;
  prepNotes: string | null;
};

type AnswerState = { text: string; source: string | null; approved: boolean; loading: boolean };

/**
 * Everything for one interview in one place: the details, what you have found
 * out about the company, the questions you expect, and your answers to them.
 *
 * This lives on the job rather than as a separate "interview" record on
 * purpose. The job already owns the company, the posting, the requirements,
 * the match analysis and the practice sessions - splitting the same interview
 * across two entities would mean two places to edit and no clear answer to
 * which one is right.
 */
export default function InterviewPrepHub({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  // Your own questions start open because there are usually a handful. The
  // predicted list runs to 25+ and would otherwise bury everything below it.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    mine: true,
    predicted: false,
  });

  const [details, setDetails] = useState({
    interviewerName: "",
    interviewerRole: "",
    interviewerNotes: "",
    interviewStage: "",
    interviewDate: "",
    interviewTime: "",
  });
  const [detailsSaved, setDetailsSaved] = useState<string | null>(null);
  const [research, setResearch] = useState("");
  const [notes, setNotes] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [newQuestion, setNewQuestion] = useState("");
  const [adding, setAdding] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [starting, setStarting] = useState<"mock" | "live" | null>(null);

  const load = useCallback(async () => {
    const [j, q] = await Promise.all([
      fetch(`/api/jobs/${id}`).then((r) => r.json()),
      fetch(`/api/jobs/${id}/questions`).then((r) => r.json()),
    ]);
    if (j.job) {
      setJob(j.job);
      setResearch(j.job.companyResearch || "");
      setNotes(j.job.prepNotes || "");
      setDetails({
        interviewerName: j.job.interviewerName || "",
        interviewerRole: j.job.interviewerRole || "",
        interviewerNotes: j.job.interviewerNotes || "",
        interviewStage: j.job.interviewStage || "",
        interviewDate: j.job.interviewDate || "",
        interviewTime: j.job.interviewTime || "",
      });
    }
    setQuestions(q.questions || []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveResearch() {
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyResearch: research, prepNotes: notes }),
    });
    setSavedAt(new Date().toLocaleTimeString());
  }

  async function saveDetails() {
    await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(details),
    });
    setDetailsSaved(new Date().toLocaleTimeString());
    await load();
  }

  async function addQuestion() {
    if (!newQuestion.trim()) return;
    setAdding(true);
    await fetch(`/api/jobs/${id}/questions`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: newQuestion.trim() }),
    });
    setNewQuestion("");
    setAdding(false);
    await load();
  }

  async function generateQuestions() {
    setGenerating(true);
    await fetch(`/api/jobs/${id}/questions`, { method: "POST" });
    setGenerating(false);
    await load();
  }

  async function removeQuestion(qid: string) {
    await fetch(`/api/questions/${qid}`, { method: "DELETE" });
    await load();
  }

  /** Loads whatever answer already exists, without generating a new one. */
  async function openAnswer(qid: string) {
    if (openQuestion === qid) return setOpenQuestion(null);
    setOpenQuestion(qid);
    if (answers[qid]) return;
    setAnswers((a) => ({ ...a, [qid]: { text: "", source: null, approved: false, loading: true } }));
    const d = await fetch(`/api/questions/${qid}/answer`).then((r) => r.json());
    setAnswers((a) => ({
      ...a,
      [qid]: {
        text: d.answer?.standard?.say_this || "",
        source: d.answer?.source || null,
        approved: Boolean(d.answer?.approved),
        loading: false,
      },
    }));
  }

  async function saveMyAnswer(qid: string) {
    const text = answers[qid]?.text?.trim();
    if (!text) return;
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], loading: true } }));
    await fetch(`/api/questions/${qid}/answer`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: text }),
    });
    setAnswers((a) => ({ ...a, [qid]: { ...a[qid], loading: false, source: "user", approved: true } }));
  }

  async function startSession(type: "mock" | "live") {
    setStarting(type);
    const res = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionType: type,
        jobId: id,
        config:
          type === "mock"
            ? { interviewType: "Hiring Manager", difficulty: "realistic", useJobDescription: true, useResume: true, verifiedOnly: true }
            : { responseLength: "standard" },
      }),
    });
    const d = await res.json();
    router.push(type === "mock" ? `/practice/session/${d.session.id}` : `/live/session/${d.session.id}`);
  }

  if (!job) return <div className="p-8 text-sm text-navy/50">Loading...</div>;

  const mine = questions.filter((q) => q.generated === false);
  const predicted = questions.filter((q) => q.generated !== false);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
      <PageHeader
        title={`${job.jobTitle} — ${job.company}`}
        subtitle="Everything for this interview in one place."
      />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => startSession("mock")} disabled={starting !== null}>
          <Mic size={15} /> {starting === "mock" ? "Starting..." : "Practice This Interview"}
        </Button>
        <Button variant="secondary" onClick={() => startSession("live")} disabled={starting !== null}>
          <Radio size={15} /> {starting === "live" ? "Starting..." : "Start Live Interview"}
        </Button>
        <Link href={`/jobs/${id}`}>
          <Button variant="secondary">View Match Analysis</Button>
        </Link>
      </div>

      <Card>
        <CardHeader
          title="Interview details"
          action={
            <Button variant="secondary" onClick={saveDetails}>
              <Save size={14} /> Save
            </Button>
          }
        />
        <div className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-navy/70">Interviewer</label>
              <input
                className="input mt-1"
                value={details.interviewerName}
                onChange={(e) => setDetails((d) => ({ ...d, interviewerName: e.target.value }))}
                placeholder="Dana Whitfield"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy/70">Their role</label>
              <input
                className="input mt-1"
                value={details.interviewerRole}
                onChange={(e) => setDetails((d) => ({ ...d, interviewerRole: e.target.value }))}
                placeholder="Director, Ambulatory Applications"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-navy/70">Stage</label>
              <select
                className="input mt-1"
                value={details.interviewStage}
                onChange={(e) => setDetails((d) => ({ ...d, interviewStage: e.target.value }))}
              >
                <option value="">Not set</option>
                {[
                  ["recruiter_screen", "Recruiter Screen"],
                  ["hiring_manager", "Hiring Manager"],
                  ["technical", "Technical Interview"],
                  ["panel", "Panel"],
                  ["final", "Final Interview"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-navy/70">Date</label>
                <input
                  type="date"
                  className="input mt-1"
                  value={details.interviewDate}
                  onChange={(e) => setDetails((d) => ({ ...d, interviewDate: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-navy/70">Time</label>
                <input
                  type="time"
                  className="input mt-1"
                  value={details.interviewTime}
                  onChange={(e) => setDetails((d) => ({ ...d, interviewTime: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-navy/70">About your interviewer</label>
            <p className="text-xs text-navy/45 mt-0.5">
              Their background, how long they have been there, what they seem to care about. Knowing
              who is across the table changes which of your examples land best.
            </p>
            <textarea
              className="input mt-1.5 min-h-[90px]"
              value={details.interviewerNotes}
              onChange={(e) => setDetails((d) => ({ ...d, interviewerNotes: e.target.value }))}
              placeholder="Clinical background, came from Epic. Ran their last two rollouts herself, so she will push on hands-on build detail..."
            />
          </div>

          <div className="flex items-center justify-between border-t border-surface-border pt-3">
            <span className="text-xs text-navy/45">
              Match score{" "}
              <span className="text-navy font-medium">
                {job.matchScore != null ? `${job.matchScore}%` : "not analyzed yet"}
              </span>{" "}
              — calculated from the posting, not editable here.
            </span>
            {detailsSaved && <span className="text-xs text-brand-success">Saved at {detailsSaved}</span>}
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Company research"
          action={
            <Button variant="secondary" onClick={saveResearch}>
              <Save size={14} /> Save
            </Button>
          }
        />
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-navy/80">
              <Building2 size={13} /> What you know about them
            </label>
            <p className="text-xs text-navy/45 mt-0.5">
              Recent news, their EHR environment, who you are meeting, why the role is open. This is
              yours to write - it is not sent anywhere until you use it.
            </p>
            <textarea
              className="input mt-1.5 min-h-[130px]"
              value={research}
              onChange={(e) => setResearch(e.target.value)}
              placeholder="Northshore runs eClinicalWorks across 14 clinics. The role is open because their last implementation manager left mid-rollout..."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-navy/80">Your prep notes</label>
            <p className="text-xs text-navy/45 mt-0.5">Questions to ask them, salary range, logistics, anything else.</p>
            <textarea
              className="input mt-1.5 min-h-[90px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ask about team size and who owns configuration decisions..."
            />
          </div>
          {savedAt && <p className="text-xs text-brand-success">Saved at {savedAt}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Questions & answers"
          action={
            <Button variant="secondary" onClick={generateQuestions} disabled={generating}>
              <Sparkles size={14} /> {generating ? "Generating..." : "Predict more"}
            </Button>
          }
        />

        <div className="px-5 py-4 border-b border-surface-border">
          <label className="text-sm font-medium text-navy/80">Add a question you expect</label>
          <p className="text-xs text-navy/45 mt-0.5">
            Anything the recruiter told you, or that you know this company asks.
          </p>
          <div className="mt-1.5 flex gap-2">
            <input
              className="input flex-1"
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuestion()}
              placeholder="Why are you leaving your current role?"
            />
            <Button onClick={addQuestion} disabled={adding || !newQuestion.trim()}>
              <Plus size={15} /> Add
            </Button>
          </div>
        </div>

        {([
          ["mine", "Your questions", mine],
          ["predicted", "Predicted for this role", predicted],
        ] as const).map(([key, label, items]) => {
          if (items.length === 0) return null;
          const expanded = openGroups[key];
          return (
            <div key={key}>
              <button
                onClick={() => setOpenGroups((g) => ({ ...g, [key]: !g[key] }))}
                className="flex w-full items-center gap-1.5 px-5 py-3 text-left hover:bg-surface-muted"
                aria-expanded={expanded}
              >
                {expanded ? (
                  <ChevronDown size={14} className="text-navy/40" />
                ) : (
                  <ChevronRight size={14} className="text-navy/40" />
                )}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-navy/40">
                  {label} ({items.length})
                </span>
                {!expanded && (
                  <span className="ml-1 text-[11px] text-navy/30">click to show</span>
                )}
              </button>

              {expanded && (
                <div className="divide-y divide-surface-border border-t border-surface-border">
                  {items.map((q) => {
                    const a = answers[q.id];
                    const open = openQuestion === q.id;
                    return (
                      <div key={q.id} className="px-5 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <button onClick={() => openAnswer(q.id)} className="text-left flex-1">
                            <p className="text-sm text-navy">{q.question}</p>
                            <p className="mt-0.5 text-[11px] text-navy/40">
                              {q.category}
                              {q.difficulty ? ` · ${q.difficulty}` : ""}
                              {q.generated === false ? " · yours" : ""}
                            </p>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button variant="secondary" onClick={() => openAnswer(q.id)}>
                              <Pencil size={13} /> {open ? "Close" : "Answer"}
                            </Button>
                            {q.generated === false && (
                              <Button variant="secondary" onClick={() => removeQuestion(q.id)} title="Delete">
                                <Trash2 size={13} />
                              </Button>
                            )}
                          </div>
                        </div>

                        {open && (
                          <div className="mt-3 rounded-lg border border-surface-border bg-surface-muted p-3">
                            {a?.loading && <p className="text-xs text-navy/50">Working...</p>}
                            {!a?.loading && (
                              <>
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-medium text-navy/70">Your answer</label>
                                  {a?.source === "user" && a?.approved && (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-brand-success">
                                      <CheckCircle2 size={11} /> Saved in your words
                                    </span>
                                  )}
                                </div>
                                <textarea
                                  className="input mt-1 min-h-[110px]"
                                  value={a?.text ?? ""}
                                  onChange={(e) =>
                                    setAnswers((prev) => ({
                                      ...prev,
                                      [q.id]: {
                                        ...(prev[q.id] ?? { source: null, approved: false, loading: false }),
                                        text: e.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Write how you would actually say it..."
                                />
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button onClick={() => saveMyAnswer(q.id)} disabled={!a?.text?.trim()}>
                                    <Save size={13} /> Save my answer
                                  </Button>
                                  <Link href={`/prepare/${id}/answers/${q.id}`}>
                                    <Button variant="secondary">
                                      <Sparkles size={13} /> Build one from my experience
                                    </Button>
                                  </Link>
                                </div>
                                <p className="mt-2 text-[11px] text-navy/40">
                                  Your own words are the strongest grounding there is. A saved answer is
                                  used as verified experience in later interviews.
                                </p>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {questions.length === 0 && (
          <p className="px-5 py-6 text-sm text-navy/40">
            No questions yet. Add one above, or use Predict more to generate them from the posting.
          </p>
        )}
      </Card>
    </div>
  );
}
