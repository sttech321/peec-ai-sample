# Existing Reference Stack — Thrive's AI Visibility Scanner

## TL;DR — don't fork it

Thrive has a working AI visibility scanner running in production. **Do not fork the repo.** It is shaped differently from what you're building:

- It's a **single-shot scanner** (give it a domain → get a report). You're building a **tracker** (daily scheduled runs → longitudinal data → multi-tenant dashboards). Different products.
- It's single-tenant SQLite. You need multi-tenant Postgres.
- It runs scans synchronously in HTTP handlers. You need a job queue.
- It has no auth, no billing, no workspaces, no scheduling.

Forking it and converting would cost more than starting fresh. The architecture is wrong-shaped for your product.

## What is worth borrowing

Three files from `lib/`. These are well-trodden patterns where rewriting buys nothing:

1. **`lib/brand-extractor.js`** — LLM-based brand extraction with the brand list as input, structured output, confidence scoring. Better than regex by a wide margin.
2. **`lib/ai-clients/`** — wrappers per engine (OpenAI, Gemini, Perplexity) handling citation parsing, retry, timeout. Saves a week of per-API quirk wrangling.
3. **`lib/technical-audit.js`** — checks the onsite signals from the SEJ study (blog count, schema presence, GBP sync). Output feeds your "recommendations" panel.

Ask Aaron to share just those three files (or the relevant snippets) once you're past initial scaffolding and ready to wire up actual scans. Don't take them on day one — you'll have a clearer view of what fits your architecture after a week or two.

## Reference: what's running today

Listed for orientation only. Not a recommendation to copy.

**Repo name:** `ai-visibility-report-app` (Render-deployed, Express backend).

**Stack:**
- Node 20
- Express 4
- better-sqlite3 (single-tenant prototype DB — replace with Postgres for multi-tenant)
- OpenAI SDK + `@google/generative-ai` (Gemini)
- Cheerio for scraping
- node-fetch for everything else
- SerpAPI for Google AI Overviews

**Env vars:**
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `SERPAPI_KEY`
- `PERPLEXITY_API_KEY`

**Deploy:**
- Render web service.
- Build: `npm install --build-from-source` (better-sqlite3 needs native compile).
- Start: `node server.js`, port 3000.

## Layout

```
server.js              # Express server (~20KB)
database.js            # SQLite init / schema (~8KB)
lib/
  ai-clients/          # Wrappers per engine (OpenAI, Gemini, Perplexity)
  brand-extractor.js   # LLM-based brand mention extraction
  metrics-calculator.js
  prompt-generator.js  # Generates prompts from a domain + topic
  prompt-matcher.js
  report-data.js
  scraper.js
  technical-audit.js   # Onsite signal audit (schema, blog count, GBP sync)
data/                  # SQLite DB
public/                # Static frontend
```

## What you'd be building net-new anyway

Everything below the three reusable files above. Listed so you can scope realistically:

- **Database.** Postgres with RLS. Supabase or Neon. Multi-tenant from day one (`workspace_id` on every table).
- **Background jobs.** Daily prompt runs are jobs, not requests. Inngest, Trigger.dev, or BullMQ. Idempotent on `(workspace_id, prompt_id, engine, run_date)`.
- **Auth + billing.** Clerk or Auth.js + Stripe. None of this exists in the reference app.
- **Frontend.** Next.js + Tailwind + shadcn + Recharts/Tremor. Reference app's static HTML is unusable.
- **Workspaces / teams / roles.** Doesn't exist in reference.
- **Scheduling UI.** Daily / weekly / on-demand prompt runs. Doesn't exist.
- **Alerting.** "Your visibility dropped 10pp" notifications. Doesn't exist.
- **Observability.** Per-engine latency, success rate, brand-extraction confidence distribution, spend per workspace. Critical from day one.

## Be careful with

- The reference app's `data/*.db` is production state with Thrive customer data. Never copy the DB itself — only patterns.
- API keys live in Render env on the reference app. Don't share the `.env`.
