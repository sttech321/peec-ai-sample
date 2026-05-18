# AI Visibility Tracker

A multi-tenant SaaS platform that tracks how brands appear across AI search engines — ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews. Inspired by [Peec.ai](https://peec.ai).

---

## What This Is

Traditional SEO tracks rankings on Google. This tracks **GEO — Generative Engine Optimization**: whether your brand gets mentioned, cited, and ranked when users ask AI assistants questions in your category.

The platform runs a fixed set of prompts daily against multiple AI engines, captures the responses, and reports:

- **Visibility** — did your brand get mentioned? (%)
- **Share of Voice** — how often vs. competitors? (%)
- **Sentiment** — was the mention positive? (0–100 score)
- **Citations** — which URLs did the AI cite?
- **Gap Analysis** — where do competitors get cited that you don't?
- **Earned Actions** — off-page GEO recommendations (Reddit, listicles, G2, Quora, LinkedIn, YouTube, Medium)
- **Owned Actions** — on-page content recommendations

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL via Drizzle ORM |
| Background Jobs | Inngest (daily prompt pipeline) |
| Auth | Custom magic-link + Google/Microsoft OAuth (JWT session cookie) |
| AI Engines | OpenAI SDK, Anthropic SDK, Google GenAI SDK, Perplexity REST, SerpAPI |
| Charts | Recharts |
| Maps | react-simple-maps + d3-geo |
| Payments | Stripe |
| Email | Nodemailer (SMTP) |

---

## Prerequisites

- **Node.js 20+**
- **PostgreSQL** database (local, Supabase, Neon, Railway, etc.)
- **Inngest** account (free tier works) — for background job processing
- At least **one AI API key** (OpenAI or Anthropic minimum to run scans)

---

## Installation

```bash
# 1. Clone the repository
git clone <your-repo-url>
cd peec-ai-sample

# 2. Install dependencies
npm install

# 3. Copy environment file
cp .env.example .env.local
# Then fill in .env.local (see Environment Variables section below)

# 4. Push the database schema
npx drizzle-kit push

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll land on the sign-in page.

---

## Environment Variables

Create a `.env.local` file in the project root. Every variable is documented below.

### Required — Core

```env
# PostgreSQL connection string
# Format: postgresql://user:password@host:5432/dbname
DATABASE_URL=postgresql://postgres:password@localhost:5432/peec_ai

# Secret used to sign session cookies (JWT-style HMAC)
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AUTH_SECRET=your-random-32-byte-hex-secret

# The public URL of your app (used for OAuth redirects and magic link emails)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Required — AI Engines

At least one AI key is needed to run scans. Each engine is optional — the pipeline skips engines with missing keys.

```env
# OpenAI — ChatGPT scans (model: gpt-4o-mini)
# Get from: https://platform.openai.com/api-keys
# Key format: sk-...
OPENAI_API_KEY=sk-...

# Anthropic — Claude scans + brand extraction (model: claude-haiku-4-5-20251001)
# Get from: https://console.anthropic.com/settings/keys
# Key format: sk-ant-...
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini — Gemini scans (model: gemini-2.0-flash)
# Get from: https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIza...

# Perplexity — Perplexity scans (model: sonar)
# Get from: https://www.perplexity.ai/settings/api
# Key format: pplx-...
PERPLEXITY_API_KEY=pplx-...

# SerpAPI — Google AI Overviews scraping
# Get from: https://serpapi.com/dashboard
SERPAPI_KEY=...

# Groq — free fallback for brand extraction (model: llama-3.3-70b-versatile)
# Get from: https://console.groq.com/keys
# Key format: gsk_...
GROQ_API_KEY=gsk_...
```

### Optional — Authentication (OAuth)

Magic-link email sign-in works out of the box without these. Add OAuth keys to enable Google/Microsoft sign-in buttons.

```env
# Google OAuth
# Get from: https://console.cloud.google.com/ → APIs & Services → Credentials
# Redirect URI: http://localhost:3000/api/auth/oauth/google/callback
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...

# Microsoft / Azure AD OAuth
# Get from: https://portal.azure.com/ → App registrations
# Redirect URI: http://localhost:3000/api/auth/oauth/microsoft/callback
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
```

### Optional — Email (SMTP)

Without SMTP configured, magic links are printed to the server console (dev mode). Add SMTP to send real emails.

```env
# SMTP server host
SMTP_HOST=smtp.gmail.com

# SMTP port (587 = STARTTLS, 465 = SSL)
SMTP_PORT=587

# SMTP credentials
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password

# From address shown in email headers
SMTP_FROM=noreply@yourdomain.com
```

> **Gmail tip:** Use an App Password (not your account password). Enable 2FA first, then generate at [https://myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).

### Optional — Inngest (Background Jobs)

Without Inngest configured, the daily scan pipeline falls back to inline execution (slower, no retries). Inngest is recommended for production.

```env
# Get from: https://app.inngest.com/ → your app → Event Keys
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=signkey-prod-...
```

> For local dev, run `npx inngest-cli@latest dev` in a separate terminal to get the Inngest Dev Server at [http://localhost:8288](http://localhost:8288).

### Optional — Payments

```env
# Stripe (billing / subscriptions)
# Get from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Optional — UI / Display

```env
# Shown in the top-left of the dashboard (defaults to email from session)
NEXT_PUBLIC_USER_EMAIL=you@yourdomain.com
```

---

## Complete `.env.local` Template

Copy this and fill in your values:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://postgres:password@localhost:5432/peec_ai

# ── Auth ──────────────────────────────────────────────────────────────────────
AUTH_SECRET=                          # 32-byte hex string
NEXT_PUBLIC_APP_URL=http://localhost:3000

# ── AI Engines ────────────────────────────────────────────────────────────────
OPENAI_API_KEY=                       # sk-...
ANTHROPIC_API_KEY=                    # sk-ant-...
GEMINI_API_KEY=                       # AIza...
PERPLEXITY_API_KEY=                   # pplx-...
SERPAPI_KEY=                          # for Google AI Overviews
GROQ_API_KEY=                         # gsk_... (free, used as brand-extraction fallback)

# ── OAuth (optional) ──────────────────────────────────────────────────────────
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# ── Email / SMTP (optional — console fallback in dev) ─────────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@yourdomain.com

# ── Inngest (optional — inline fallback in dev) ───────────────────────────────
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# ── Stripe (optional) ─────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# ── UI ────────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_USER_EMAIL=
```

---

## Database Setup

The schema is managed by Drizzle ORM. To create or update all tables:

```bash
# Push schema to your database (creates tables, applies changes)
npx drizzle-kit push

# View your schema visually
npx drizzle-kit studio
```

Tables created: `projects`, `prompts`, `topics`, `tags`, `prompt_tags`, `brands`, `brand_profiles`, `brand_suggestions`, `chats`, `sources`, `citations`, `brand_mentions`, `earned_actions`, `owned_actions`, `action_history`, `analytics_snapshots`, `competitors`, `workspace_members`, `workspace_invitations`, `magic_link_tokens`.

All tables have `workspace_id` for multi-tenancy.

---

## First Run Walkthrough

### 1. Sign in
Go to `/sign-in`, enter your email, and click the magic link that appears in the browser (dev mode) or your inbox (SMTP configured).

### 2. Run the Setup Wizard
The wizard at `/setup` walks you through:
- Brand profile (your company, services, target audience)
- Competitors to track
- Topics and AI prompts

### 3. Run Your First AI Scan
After adding prompts, trigger a scan manually:

```bash
# Scan all active prompts across all engines
curl http://localhost:3000/api/run-daily-scan

# Scan one specific prompt
curl "http://localhost:3000/api/run-daily-scan?promptId=<id>"

# Scan with specific engines only
curl "http://localhost:3000/api/run-daily-scan?engines=ChatGPT,Claude"
```

Or click the **Run Scan** button in the Prompts UI.

### 4. Generate Earned Actions
After scans complete, go to `/earned` and click **Generate Recommendations**. The engine analyzes citation gaps (where competitors appear but you don't) and creates actionable GEO recommendations.

---

## Available Scripts

```bash
npm run dev        # Start dev server on http://localhost:3000
npm run build      # Production build
npm run start      # Run production build
npm run lint       # ESLint
npx drizzle-kit push    # Push DB schema changes
npx drizzle-kit studio  # Visual DB browser
```

---

## Key Routes

| Route | Description |
|---|---|
| `/` | Overview dashboard — visibility, share of voice, top brands |
| `/prompts` | Manage AI prompts, run scans, view per-prompt results |
| `/prompts/[id]` | Single prompt — engine comparison, mention timeline |
| `/domains` | Domain authority and citation frequency analysis |
| `/urls` | URL-level citation tracking |
| `/insights` | Brand-level visibility insights and sentiment |
| `/earned` | Off-page GEO recommendations (Reddit, listicles, G2, etc.) |
| `/owned` | On-page content recommendations |
| `/impact` | Track completion status and measured impact of actions |
| `/brands` | Manage tracked brands and competitors |
| `/profile` | Brand semantic profile editor |
| `/settings` | Project settings |
| `/projects` | Switch between or create projects |
| `/members` | Invite team members, manage roles |
| `/crawlability` | AI crawler accessibility audit |
| `/setup` | Onboarding wizard |

---

## API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET/POST` | `/api/run-daily-scan` | Trigger AI prompt scans (all or filtered) |
| `POST` | `/api/actions/generate` | Generate earned + owned action recommendations from scan data |
| `DELETE` | `/api/actions/generate` | Delete all actions for current project (force-regenerate) |
| `POST` | `/api/auth/magic-link` | Send or verify magic link |
| `POST` | `/api/auth/logout` | Clear session |
| `GET` | `/api/auth/oauth/google` | Initiate Google OAuth |
| `GET` | `/api/auth/oauth/google/callback` | Google OAuth callback |
| `POST` | `/api/members/invite` | Invite team member |
| `POST` | `/api/inngest` | Inngest webhook (background jobs) |

---

## How the Pipeline Works

```
User adds prompts
      ↓
/api/run-daily-scan  ──▶  Inngest queue
                                ↓
               For each prompt × engine:
               1. Call AI API (ChatGPT / Claude / Gemini / Perplexity / AI Overviews)
               2. Store raw response → chats table
               3. Extract URLs/citations → sources + citations tables
               4. LLM brand extraction (Claude Haiku with prompt caching)
               5. Store brand mentions + sentiment → brand_mentions table
                                ↓
/api/actions/generate
               Reads sources, detects competitor citation gaps
               Generates earned + owned action recommendations
               Stores to earned_actions + owned_actions tables
                                ↓
/earned page shows recommendations
```

**Brand extraction** uses Anthropic prompt caching — the system prompt is cached across thousands of daily calls, cutting extraction cost by ~90%.

**Idempotency key**: `(workspace_id, prompt_id, engine, run_date)` — safe to retry without double-charging APIs.

---

## Metrics Reference

| Metric | Type | Display |
|---|---|---|
| `visibility` | 0–1 ratio | Multiply × 100, show as `%` |
| `share_of_voice` | 0–1 ratio | Multiply × 100, show as `%` |
| `sentiment` | 0–100 score | Show as-is; healthy brands = 65–85 |
| `position` | Rank (integer) | Show as-is; lower = better |
| `retrieval_rate` | Average (can exceed 1.0) | Show as-is, label "avg" — **never** multiply |
| `citation_rate` | Average (can exceed 1.0) | Show as-is, label "avg" — **never** multiply |

> The most common bug: multiplying a 0–1 ratio by 100 twice → "Share of Voice: 4500%". Always check units at the source.

---

## AI Engine Cost Estimates (Q2 2026)

Per prompt × per engine × per day:

| Engine | Approx. cost |
|---|---|
| ChatGPT (gpt-4o-mini) | $0.01–0.05 |
| Claude (Haiku + caching) | $0.002–0.008 |
| Perplexity (sonar) | $0.005–0.01 |
| Gemini (2.0-flash) | $0.002–0.01 |
| AI Overviews (SerpAPI) | $0.005 |

Brand extraction adds ~$0.002/chat with Anthropic prompt caching (>90% cache hit rate in steady state).

**Rule of thumb:** A project with 20 prompts × 4 engines × daily = ~$2–4/day in AI API costs.

---

## Project Structure

```
peec-ai-sample/
├── app/                    # Next.js App Router pages
│   ├── (auth)/             # Sign-in / sign-up pages
│   ├── api/                # API route handlers
│   ├── earned/             # Earned Actions page
│   ├── owned/              # Owned Actions page
│   ├── prompts/            # Prompts management
│   ├── domains/            # Domain analytics
│   └── ...
├── components/             # Reusable React client components
├── db/
│   └── schema.ts           # Drizzle ORM schema (source of truth)
├── drizzle/                # Migration files (auto-generated)
├── inngest/
│   ├── client.ts           # Inngest client init
│   └── functions.ts        # Background job definitions
├── lib/
│   ├── ai-clients.ts       # AI engine SDK wrappers
│   ├── actions-generator.ts # Earned/owned action text generation
│   ├── session.ts          # JWT session cookie helpers
│   ├── send-email.ts       # Nodemailer email helpers
│   ├── oauth.ts            # Google/Microsoft OAuth helpers
│   └── ...
├── docs/handoff/           # Architecture docs and GEO playbooks
├── public/                 # Static assets
├── drizzle.config.ts       # Drizzle config (reads DATABASE_URL)
├── next.config.ts          # Next.js config
├── tailwindcss.config.ts   # Tailwind v4 config
└── .env.local              # Your local secrets (never commit)
```

---

## Deployment

### Vercel (recommended)

1. Push to GitHub
2. Import in [vercel.com/new](https://vercel.com/new)
3. Add all environment variables in the Vercel dashboard
4. Set `DATABASE_URL` to your production PostgreSQL URL
5. Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL

The Inngest webhook at `/api/inngest` must be reachable from the internet for background jobs to work in production. Register it in the Inngest dashboard under **Apps**.

### Environment-specific notes

- `NEXT_PUBLIC_APP_URL` must match your actual domain for OAuth callbacks to work
- `AUTH_SECRET` must be the same across all deployments (session cookies will break if it changes)
- Run `npx drizzle-kit push` against your production database before first deploy

---

## Documentation

See [`docs/handoff/`](docs/handoff/) for deeper reference:

- [`01-data-model.md`](docs/handoff/01-data-model.md) — Full entity relationship model
- [`02-metrics-definitions.md`](docs/handoff/02-metrics-definitions.md) — Exact metric formulas and display rules
- [`03-ai-engines-and-apis.md`](docs/handoff/03-ai-engines-and-apis.md) — Which AI APIs to use and why
- [`07-gotchas-and-learnings.md`](docs/handoff/07-gotchas-and-learnings.md) — Hard-won lessons before scoping
- [`08-llm-citation-outreach.md`](docs/handoff/08-llm-citation-outreach.md) — Outreach playbook (get cited in AI answers)

