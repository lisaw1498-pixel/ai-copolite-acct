# AI Interview Copilot

Your experience. Your answers. Real-time interview support — grounded in what you can actually prove, never invented.

This is a working implementation of the AI Interview Copilot blueprint: account creation, resume parsing, a candidate knowledge base, a **Verified Experience Layer** that gates every AI-generated claim, job matching, mock interviews, and a real-time two-panel Live Interview Copilot (SAY THIS / REMEMBER THIS) driven by your browser's microphone.

## Quick start

```bash
npm install
cp .env.local.example .env.local   # if you don't already have .env.local
# edit .env.local and add your Anthropic API key
npm run dev
```

Open http://localhost:3000, create an account, and go through onboarding.

### Required: an Anthropic API key

Every AI feature (resume parsing, job matching, question/answer generation, the Verified Experience Layer, mock and live interviews) runs on Claude. Without a key, the app still runs — auth, profile editing, career stories, and settings all work — but anything AI-powered returns a clear "add your API key" message instead of failing silently or making something up.

1. Get a key at https://console.anthropic.com/
2. Put it in `.env.local`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Restart `npm run dev`.

The key is only ever read server-side (`src/lib/ai/client.ts`) and is never sent to the browser.

### Live microphone transcription

The Live Interview Copilot uses your browser's **built-in** speech recognition (the Web Speech API) — free, no extra API key, and it's what makes "just clone and run" possible. It currently only works in Chrome and Edge (desktop). If your browser doesn't support it, or you're on a call where you'd rather not use the mic, use **Manual Question Mode** — type the interviewer's question and get the same grounded answer instantly.

## Architecture

- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — single codebase, no separate backend service.
- **SQLite via Drizzle ORM** (`src/db/schema.ts`) instead of Postgres/Supabase for this build — see "Why SQLite, and moving to Supabase" below. The schema is a direct translation of the blueprint's tables (`candidate_facts`, `fact_conflicts`, `verification_reviews`, `answer_fact_links`, `job_requirements`, `interview_sessions`, etc.) and is portable to Postgres essentially as-is.
- **Auth.js (NextAuth v5)** with a Credentials provider (email + bcrypt-hashed password), JWT sessions. `src/proxy.ts` (Next 16 renamed Middleware → Proxy) does an optimistic redirect-if-signed-out check; `requireUser()` in every server component does the real, DB-backed check.
- **Anthropic Claude** for every AI step, isolated behind `src/lib/ai/*` so the prompts and the Verified Experience policy live in one place, not scattered across API routes.

## The Verified Experience Layer (the actual point of this app)

This is implemented as more than a system prompt — it's a pipeline with a real code-level check, not just an instruction the model might ignore:

1. **`src/lib/ai/prompts.ts`** — the core system prompt enforces the verification policy from the blueprint (never invent employers/metrics/tech/years, never upgrade transferable → direct, prioritize verified career stories → resume → user-confirmed → project → skill → approved answer).
2. **`src/lib/ai/generate-answer.ts`** — calls Claude once to draft `say_this` + `remember_this` + `facts_used` + `excluded_unverified_claims`, all as one structured JSON response (`src/lib/ai/types.ts`).
3. **Programmatic Metric Protection** — after the model returns its draft, `generate-answer.ts` extracts every digit-based number in `say_this` and checks it against the *actual* verified facts we sent (not the model's self-report of what it used). Any number that doesn't trace back to a real verified fact triggers a second, targeted Claude call (`CLAIM_REWRITE_SYSTEM_PROMPT`) that rewrites only the unsupported clause, exactly like blueprint section 79's example ("eight years of Epic" → "hands-on Epic experience... broader EHR background").
4. **`answer_fact_links`** — every claim used in every generated answer (prepared or live) is persisted with its verification status *at generation time*, so there's a real audit trail, not just a UI badge.

Facts move through `verified_resume → verified_story → verified_user → verified_project → verified_approved`, `transferable`, `unverified`, or `conflicted` (`src/lib/verification.ts`), and the Verified Experience Center (`/profile/verified-experience`) is where you confirm, reject, edit, or mark facts transferable — exactly the blueprint's Confirm Experience Workflow, minus a live-interview interruption (verification never happens mid-interview; unresolved facts are just excluded).

## What's simplified vs. the full blueprint, and why

This was built end-to-end in one sitting as a local-first app you can run immediately. A few things are intentionally scoped down rather than half-built:

- **No vector database (pgvector/Pinecone).** A single candidate's fact base is small enough (dozens to low hundreds of facts) to pass directly in-context to Claude for retrieval/ranking, so there's no embedding pipeline. This is the one piece that would need real work to scale to multi-tenant production.
- **Speaker diarization is heuristic, not audio-based.** Question-like utterances (`src/lib/question-detection.ts`) are attributed to the interviewer; everything else to the candidate. Manual Question Mode is the reliable fallback.
- **Speech-to-text is the browser's Web Speech API**, not Deepgram/AssemblyAI/Azure. Free and zero-config, but Chrome/Edge only and less robust on noisy audio than a dedicated streaming ASR provider.
- **"System audio" capture, always-on-top desktop companion, and screen-share/recording invisibility are not implemented — the last one deliberately.** A mode built specifically to hide the Copilot from an interviewer's screen share or recording is an anti-detection feature for concealing AI assistance during a monitored interview, which is a step I chose not to take regardless of framing. What *is* built: Compact and Discreet display modes (small footprint, adjustable layout) that you control on your own screen like any other app window.
- **Mock interview scoring and post-interview reports are single-pass Claude calls**, not a tuned rubric-based model.

None of these are stubs — every screen in the blueprint is wired to a real database and a real AI call end-to-end. They're just the pragmatic version of a production feature.

## Why SQLite, and moving to Supabase/Postgres

You asked to start local-first. `src/db/client.ts` and `drizzle.config.ts` are the only two files that know about SQLite specifically — the schema (`src/db/schema.ts`) uses Drizzle's `sqlite-core`, which maps closely to `pg-core`. To move to Supabase later:

1. Create a Supabase project, enable `pgvector` if you want real embeddings.
2. Swap `sqlite-core` imports in `schema.ts` for `pg-core` equivalents (`text`, `integer`, `boolean`, `timestamp`, `jsonb` instead of `text(..., {mode:'json'})`).
3. Point `drizzle.config.ts` at `dialect: "postgresql"` and a `DATABASE_URL`.
4. Swap `src/db/client.ts`'s `better-sqlite3` driver for `postgres-js` or Supabase's driver.

No API routes or components need to change — they all go through `db` from `src/db/client.ts`.

## Project structure

```
src/
  app/
    (auth)/login, (auth)/signup          — auth screens
    (app)/...                            — everything behind login (sidebar layout)
      dashboard, onboarding
      profile/{resume,experience,career-stories,skills,verified-experience}
      jobs, jobs/[id]
      prepare, prepare/[jobId], prepare/[jobId]/answers/[questionId], prepare/{questions,answers}
      practice, practice/session/[id]
      live, live/session/[id]            — the two-panel Live Interview Copilot
      history, history/[id], settings
    api/...                              — one route per resource, mirrors the pages above
  lib/
    ai/                                  — Claude client, prompts, extraction, generation, questions, mock interviewer, post-interview
    facts.ts                             — candidate_facts read/write helpers shared by resume parsing and answer generation
    verification.ts                      — the verification-status vocabulary used everywhere
    question-detection.ts                — client-safe live question-phrase heuristics
    use-speech-recognition.ts            — Web Speech API hook (Mock + Live both use this)
  db/
    schema.ts                            — full Drizzle schema (23 tables)
    client.ts
```

## Known limitations to be aware of

- Single-user-per-browser-session in spirit: there's real multi-account auth, but everything (facts, stories, jobs) is scoped by `user_id` with app-level checks rather than Postgres Row-Level Security (RLS wasn't applicable without Postgres). If you migrate to Supabase, add RLS policies keyed on `user_id = auth.uid()` for defense in depth.
- No email/password reset flow, no Google OAuth (the button is present but disabled — wire up a Google provider in `src/auth.ts` if you want it).
- No automated tests yet.
