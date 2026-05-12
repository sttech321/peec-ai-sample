# AI Visibility Tracker — Codebase Documentation

> A Peec.ai-style product that tracks how a brand appears across AI search engines (ChatGPT, Claude, Gemini, Perplexity, Google AI Overviews, Bing Copilot). The system runs a fixed set of prompts on a daily schedule, captures responses, and surfaces visibility, share-of-voice, sentiment, and citation metrics.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Repository Layout](#4-repository-layout)
5. [Environment & Configuration](#5-environment--configuration)
6. [Local Development](#6-local-development)
7. [Core Subsystems](#7-core-subsystems)
8. [Conventions & Non-Negotiables](#8-conventions--non-negotiables)
9. [Reference Documentation](#9-reference-documentation)
10. [Glossary](#10-glossary)

---

## 1. Project Overview

**Product name:** AI Visibility Tracker
**Status:** Early scaffold (Next.js skeleton + Inngest wiring). Data model and core jobs not yet implemented.
**Goal:** Help marketing teams answer four questions every day:

| Question | Output Metric |
|----------|---------------|
| Did the brand get mentioned in AI answers? | Visibility (0–1 ratio) |
| How often versus competitors? | Share of Voice (0–1 ratio) |
| Was the mention positive? | Sentiment (0–100) |
| Which sources did the AI cite? | Citation rate (avg, can exceed 1.0) |

Reference product: **Peec.ai**. The conceptual architecture and data model in [docs/handoff/](docs/handoff/) are derived from Peec's published MCP schema and a reference scanner built by Thrive Internet Marketing.

---

## 2. Tech Stack

### Runtime & Framework
| Layer | Technology | Version |
|-------|------------|---------|
| Web framework | **Next.js (App Router)** | `16.2.4` |
| UI runtime | **React** | `19.2.4` |
| Language | **TypeScript** | `^5` |
| Styling | **Tailwind CSS** | `^4` (PostCSS plugin) |
| Linting | **ESLint** + `eslint-config-next` | `^9` |
| Fonts | `next/font` — Geist Sans & Geist Mono | — |

> ⚠️ **Note:** `AGENTS.md` flags that this Next.js version contains breaking changes versus older training data. Always consult `node_modules/next/dist/docs/` before introducing patterns from older Next.js versions.

### Background Jobs
| Component | Technology |
|-----------|------------|
| Job queue / scheduler | **Inngest** (`^4.3.0`) |
| HTTP handler | `inngest/next` (mounted at `app/api/inngest/route.ts`) |
| Local dev runner | `npx inngest-cli@latest dev` (port `8288`) |

### Data Layer (Planned)
| Component | Technology |
|-----------|------------|
| Database | **PostgreSQL** on **Neon** (cloud) — `DATABASE_URL` (pooled) + `DIRECT_URL` (migrations) |
| Local DB | Local Postgres (`localhost:5432`) for dev |

> ORM is not yet selected in code; the handoff stack suggests Prisma. Treat `lib/db/` (when added) as the source of truth.

### AI Providers
| Provider | Use Case | Env Var |
|----------|----------|---------|
| OpenAI | ChatGPT / GPT-5 responses | `OPENAI_API_KEY` |
| Anthropic | Claude responses + brand extraction (with prompt caching) | `ANTHROPIC_API_KEY` |
| Google AI | Gemini responses | `GEMINI_API_KEY` |
| Perplexity | Perplexity Search responses | `PERPLEXITY_API_KEY` |
| SerpAPI | Google AI Overviews scraping | `SERPAPI_KEY` |
| DataForSEO *(optional)* | SERP enrichment | `DATAFORSEO_LOGIN` / `_PASSWORD` |
| Hunter *(optional)* | Outreach email enrichment | `HUNTER_API_KEY` |

### Tooling
- **Path alias:** `@/*` → repo root (configured in `tsconfig.json`)
- **No `src/` directory** — App Router code lives at `app/`, shared modules under `lib/`
- **Strict TypeScript** (`"strict": true`)

---

## 3. High-Level Architecture

```
┌────────────────────┐        ┌────────────────────────────────────┐
│   User / Browser   │◀──────▶│  Next.js App (App Router, RSC/UI)  │
└────────────────────┘        │   app/page.tsx, app/layout.tsx     │
                              └──────────────┬─────────────────────┘
                                             │ enqueue
                                             ▼
                              ┌────────────────────────────────────┐
                              │   Inngest                          │
                              │   - Daily cron triggers            │
                              │   - Fan-out per workspace ×        │
                              │     prompt × engine                │
                              │   - Idempotency on                 │
                              │     (workspace, prompt, engine,    │
                              │      run_date)                     │
                              └──────────────┬─────────────────────┘
                                             │
                ┌────────────────────────────┼────────────────────────────┐
                ▼                            ▼                            ▼
        ┌──────────────┐            ┌──────────────┐            ┌──────────────┐
        │ OpenAI API   │            │ Anthropic    │            │ Gemini /     │
        │ (ChatGPT)    │            │ (Claude)     │            │ Perplexity / │
        └──────┬───────┘            └──────┬───────┘            │ SerpAPI      │
               │                           │                    └──────┬───────┘
               └───────────────┬───────────┴───────────────────────────┘
                               ▼
                  ┌───────────────────────────────┐
                  │ Brand-extraction step         │
                  │ (Anthropic, structured output,│
                  │  prompt-cached system prompt) │
                  └──────────────┬────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │ Postgres (Neon)               │
                  │ chats, sources, citations,    │
                  │ brand_mentions  (workspace_id │
                  │ on every row)                 │
                  └──────────────┬────────────────┘
                                 ▼
                  ┌───────────────────────────────┐
                  │ Metrics + dashboards          │
                  │ visibility, SoV, sentiment,   │
                  │ citation rate                 │
                  └───────────────────────────────┘
```

**Request flow today (skeleton):** UI request → Next.js route → (no business logic yet). Inngest is mounted at [app/api/inngest/route.ts](app/api/inngest/route.ts) and currently exposes one demo function, [helloWorld](lib/inngest/functions/hello.ts).

**Where new work goes:**
- New Inngest jobs → [lib/inngest/functions/](lib/inngest/functions/) and registered in the `serve()` call.
- New API routes → `app/api/<segment>/route.ts`.
- Shared logic → [lib/](lib/) (e.g. `lib/db/`, `lib/engines/`, `lib/metrics/`).

---

## 4. Repository Layout

```
ai-visibility-tracker/
├── app/                          Next.js App Router
│   ├── api/
│   │   └── inngest/route.ts      Inngest webhook (GET/POST/PUT)
│   ├── globals.css               Tailwind v4 entry + theme tokens
│   ├── layout.tsx                Root layout (Geist fonts, html/body)
│   └── page.tsx                  Landing page
├── lib/
│   └── inngest/
│       ├── client.ts             Inngest client (id: "ai-visibility-tracker")
│       └── functions/
│           └── hello.ts          Demo function — replace with real jobs
├── docs/
│   ├── peec-architecture-explainer.md  Conceptual reference (Peec product)
│   └── handoff/                  Spec + design source-of-truth (read first)
│       ├── 01-data-model.md
│       ├── 02-metrics-definitions.md
│       ├── 03-ai-engines-and-apis.md
│       ├── 04-ai-crawler-study.md
│       ├── 05-existing-reference-stack.md
│       ├── 06-skills-to-install.md
│       ├── 07-gotchas-and-learnings.md
│       ├── 08-llm-citation-outreach.md
│       ├── README.md
│       ├── SETUP.md
│       └── skills/               Claude Code skills (seo-geo, etc.)
├── public/                       Static assets
├── AGENTS.md                     Next.js version warning for AI agents
├── CLAUDE.md                     Project rules for Claude Code
├── README.md                     Generic Next.js bootstrap notes
├── eslint.config.mjs             Flat config, extends next + nextTs
├── next.config.ts                Next.js config (currently empty)
├── package.json                  Scripts + deps
├── postcss.config.mjs            Tailwind v4 PostCSS plugin
├── tsconfig.json                 strict TS, alias "@/*" → "./*"
└── .env.local                    Local secrets (gitignored)
```

---

## 5. Environment & Configuration

`.env.local` is **gitignored** (see [.gitignore](.gitignore)) — every developer maintains their own copy.

### Required for runtime
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=
PERPLEXITY_API_KEY=pplx-...
SERPAPI_KEY=

DATABASE_URL=postgresql://...        # pooled (app reads/writes)
DIRECT_URL=postgresql://...          # un-pooled (migrations)

INNGEST_EVENT_KEY=                   # blank locally, set in Inngest Cloud
INNGEST_SIGNING_KEY=                 # blank locally, set in Inngest Cloud
INNGEST_DEV=http://127.0.0.1:8288    # local Inngest dev server

NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Optional (later phases)
```env
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
HUNTER_API_KEY=
```

### Path alias
```jsonc
// tsconfig.json
"paths": { "@/*": ["./*"] }
```
Use `import { x } from "@/lib/..."` everywhere — no relative `../../` traversal.

---

## 6. Local Development

### Prerequisites
- Node.js **20+** (Next 16 / React 19 require modern Node)
- A reachable Postgres instance (local or Neon branch)
- API keys for at least one AI provider (others can be left blank during early dev)

### Install
```bash
npm install
```

### Run the web app
```bash
npm run dev          # http://localhost:3000
```

### Run the Inngest dev server (separate terminal)
```bash
npx inngest-cli@latest dev
# Dashboard: http://127.0.0.1:8288
```
Inngest auto-discovers your local app via `INNGEST_DEV=http://127.0.0.1:8288` and the `/api/inngest` route.

### Build / lint
```bash
npm run build        # next build
npm run start        # next start (production server)
npm run lint         # eslint
```

---

## 7. Core Subsystems

### 7.1 Web (Next.js App Router)
- [app/layout.tsx](app/layout.tsx) — Root layout. Loads Geist Sans/Mono via `next/font`, sets `html` + `body` classes, supports light/dark via `prefers-color-scheme`.
- [app/page.tsx](app/page.tsx) — Placeholder landing page (boilerplate). Replace as the dashboard is built.
- [app/globals.css](app/globals.css) — Tailwind v4 entry. Theme tokens (`--background`, `--foreground`, font vars) declared with `@theme inline`.

### 7.2 Background Jobs (Inngest)
- [lib/inngest/client.ts](lib/inngest/client.ts) — Single Inngest client. App ID: `ai-visibility-tracker`.
- [lib/inngest/functions/hello.ts](lib/inngest/functions/hello.ts) — Reference function showing the `triggers + step.run` pattern.
- [app/api/inngest/route.ts](app/api/inngest/route.ts) — Mounts `serve({ client, functions: [...] })` and exports `GET`, `POST`, `PUT`.

**Adding a new job:**
1. Create `lib/inngest/functions/<name>.ts` exporting `inngest.createFunction(...)`.
2. Add it to the `functions` array in [app/api/inngest/route.ts](app/api/inngest/route.ts).
3. Trigger via event (`inngest.send({ name, data })`) or cron (`{ cron: "0 6 * * *" }`).

### 7.3 Data Model (planned, not yet in code)
Per [docs/handoff/01-data-model.md](docs/handoff/01-data-model.md), expect these tables, every one keyed by `workspace_id`:

`projects`, `prompts`, `topics`, `tags`, `brands`, `chats`, `sources`, `citations`, `brand_mentions`.

### 7.4 Metrics (planned)
Definitions live in [docs/handoff/02-metrics-definitions.md](docs/handoff/02-metrics-definitions.md). Critical display rules:

| Metric | Type | Display |
|--------|------|---------|
| `visibility` | 0–1 ratio | `× 100` for percent |
| `share_of_voice` | 0–1 ratio | `× 100` for percent |
| `retrieved_percentage` | 0–1 ratio | `× 100` for percent |
| `sentiment` | 0–100 score | as-is (typical healthy range 65–85) |
| `position` | rank (lower = better) | as-is, never multiply |
| `retrieval_rate`, `citation_rate` | average (can exceed 1.0) | as-is, never multiply |

> If a dashboard ever shows "share of voice: 4500%", a 0–1 ratio was multiplied by 100 twice. Catch this in tests.

---

## 8. Conventions & Non-Negotiables

These are enforced project-wide. See [CLAUDE.md](CLAUDE.md) for the canonical list.

1. **Multi-tenant from day one.** Every table has `workspace_id`. Retrofitting tenancy later is the most expensive mistake in this category — see [07-gotchas](docs/handoff/07-gotchas-and-learnings.md).
2. **Idempotent jobs.** Daily prompt runs deduplicate on `(workspace_id, prompt_id, engine, run_date)`. Re-running a day must not produce duplicate `chats`.
3. **Snapshot the model.** Every `chat` row stores the exact provider model snapshot (e.g. `gpt-5-2026-04-15`) so metric drift is explainable when providers ship updates.
4. **Spend caps required before any prompt runner ships.** Per-workspace, per-engine, per-day spend tracking + hard caps. A bug here can burn $1k/hour.
5. **Anthropic prompt caching** is mandatory for the brand-extraction system prompt.
6. **Never run scans inside HTTP handlers.** Always enqueue an Inngest event from the route and let the worker do the work.
7. **No `src/` dir.** App Router lives at `app/`, shared modules at `lib/`. Imports use `@/*`.
8. **Brand extraction is LLM-based, not regex.** Use structured output schemas.

---

## 9. Reference Documentation

The handoff bundle in [docs/handoff/](docs/handoff/) is the design source of truth. Read these before scoping a sprint:

| Doc | Purpose |
|-----|---------|
| [01-data-model.md](docs/handoff/01-data-model.md) | Postgres schema (projects, prompts, chats, sources, citations…) |
| [02-metrics-definitions.md](docs/handoff/02-metrics-definitions.md) | Exact metric formulas + display rules |
| [03-ai-engines-and-apis.md](docs/handoff/03-ai-engines-and-apis.md) | Per-engine API quirks, rate limits, web-search flags |
| [04-ai-crawler-study.md](docs/handoff/04-ai-crawler-study.md) | What each AI crawler indexes (SEJ 68M study) |
| [05-existing-reference-stack.md](docs/handoff/05-existing-reference-stack.md) | Thrive's reference scanner — what to borrow |
| [06-skills-to-install.md](docs/handoff/06-skills-to-install.md) | Claude Code skills used by this project |
| [07-gotchas-and-learnings.md](docs/handoff/07-gotchas-and-learnings.md) | Hard-won lessons — read before scoping |
| [08-llm-citation-outreach.md](docs/handoff/08-llm-citation-outreach.md) | Outreach playbook (post-MVP product surface) |
| [SETUP.md](docs/handoff/SETUP.md) | End-to-end setup checklist |

If a request conflicts with the handoff docs, surface the conflict — do not silently override.

---

## 10. Glossary

| Term | Meaning |
|------|---------|
| **AI engine** | A consumer-facing AI surface (ChatGPT, Claude, Gemini, Perplexity, Google AI Overviews, Bing Copilot) |
| **Prompt** | A fixed query the system runs daily on behalf of a workspace |
| **Chat** | One stored response from one engine for one prompt on one date |
| **Citation** | A URL the AI returned alongside its answer |
| **Brand mention** | A detected reference to a tracked brand inside a chat |
| **Visibility** | Fraction of prompts where the brand was mentioned (0–1) |
| **Share of Voice (SoV)** | Brand mentions ÷ total mentions across the tracked brand set (0–1) |
| **Workspace** | Tenant boundary — every row in the DB carries `workspace_id` |
| **Snapshot model** | The exact provider model string (e.g. `claude-opus-4-7`) captured on each chat row |

---

*Last updated: 2026-05-06.*
