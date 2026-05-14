# Setup Instructions

This checklist picks up **after** the intro video Aaron sent you. The video covers installing Homebrew, Node, Claude Code, and signing in. Once you've done that, this doc takes you the rest of the way to "Claude Code is helping me build the tracker." ~30-60 minutes.

## 0. Verify the video setup worked

Open a terminal and run all three:

```bash
node -v          # should print v20.x or higher
git --version    # any version is fine
claude --version # should print a version string, not "command not found"
```

If any of these fail, go back to the video and re-do that step before continuing.

Then start Claude once to confirm login works:

```bash
claude
```

You should land in the Claude prompt without a login flow. If it asks you to log in, do that now.

(Recommended) Install the VS Code extension: search "Claude Code" in VS Code's Extensions panel and install. It lets you run Claude inside the editor and click file/line links from Claude's responses directly to the source.

## 1. Unpack this bundle

You should have received `peec-clone-handoff/` (folder, zip, or tarball). Drop it somewhere persistent — `~/peec-clone-handoff/` is fine.

```bash
# if it came as a zip
unzip peec-clone-handoff.zip -d ~/

# verify
ls ~/peec-clone-handoff/
# Should show: README.md, SETUP.md, 01-data-model.md ... 08-llm-citation-outreach.md, skills/
```

## 2. Install the skills

Skills live in `~/.claude/skills/` and are auto-loaded by every Claude Code session.

```bash
mkdir -p ~/.claude/skills
cp -r ~/peec-clone-handoff/skills/* ~/.claude/skills/

# verify
ls ~/.claude/skills/
# Should now include: seo-geo, seo-bing-chatgpt, seo-content, llm-citation-outreach
```

You can confirm Claude sees them by starting a session and typing `/` — the skills should appear in the slash-command list.

## 3. Create your project repo

Pick a directory and initialize git on day one. Don't skip the git step — Claude Code works best in a tracked repo.

```bash
mkdir ~/code/ai-visibility-tracker
cd ~/code/ai-visibility-tracker
git init
echo "node_modules\n.env\n.env.local\n*.log\n.next\n.vercel" > .gitignore
```

Pick your stack now (the bundle suggests Next.js + Postgres). Scaffold:

```bash
# Next.js + TypeScript + Tailwind + App Router
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
```

(Or use whatever stack you prefer — the bundle is stack-agnostic, but the suggested stack matches the gotchas doc.)

## 4. Drop the handoff bundle into the project

You want Claude to read these docs every time it works on the project. Put them in the repo:

```bash
cp -r ~/peec-clone-handoff ./docs/handoff
```

Or symlink if you'd rather keep the canonical copy elsewhere:

```bash
ln -s ~/peec-clone-handoff ./docs/handoff
```

## 5. Initialize CLAUDE.md

CLAUDE.md is the project memory — Claude reads it at the start of every session. Create one in the repo root:

```bash
claude
```

Then in the Claude prompt:

```
Read all files in docs/handoff/ — these document an AI visibility tracker product I'm building. Then run /init to scaffold a CLAUDE.md for this project. The CLAUDE.md should reference the handoff docs as the source of truth for product spec, metrics definitions, and architectural decisions.
```

Claude will produce a CLAUDE.md tailored to your stack choice. Review and commit it.

## 6. Provision API keys

You'll need accounts + keys for:

| Service | Why | Where to sign up |
|---|---|---|
| **OpenAI** | ChatGPT API + web search tool | platform.openai.com |
| **Anthropic** | Claude API (also powers brand extraction with prompt caching) | console.anthropic.com |
| **Google AI Studio** | Gemini API | aistudio.google.com/apikey |
| **Perplexity** | Sonar API | docs.perplexity.ai |
| **SerpAPI** | Google AI Overviews scraping | serpapi.com |
| **DataForSEO** *(optional)* | SERP data, keyword volumes, backlinks | dataforseo.com |
| **Hunter.io** *(later)* | Email verification for outreach | hunter.io |

Drop them in `.env.local` (gitignored):

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
PERPLEXITY_API_KEY=pplx-...
SERPAPI_KEY=...
```

**Critical:** request Tier 2+ on OpenAI and a workspace upgrade on Anthropic on day one. Default rate limits will throttle a daily prompt-run within minutes.

## 7. Set up the database

Pick one:

**Supabase** (recommended for fast start — Postgres + RLS + auth in one):
1. Sign up at supabase.com.
2. Create a project. Copy the `DATABASE_URL` and `SUPABASE_*` keys to `.env.local`.
3. The Supabase MCP server is already wired into Claude Code in this environment — Claude can run migrations and queries directly.

**Neon** (Postgres only, faster cold starts):
1. Sign up at neon.tech.
2. Create a project. Copy the connection string to `DATABASE_URL`.
3. Use Drizzle or Prisma for migrations.

Either way: design the schema with `workspace_id` on every table from day one. Multi-tenant retrofitting is the most expensive mistake you can make in this category.

## 8. Set up the job queue

Daily prompt runs are background jobs. Pick one:

- **Inngest** — easiest fit for Next.js, free tier generous.
- **Trigger.dev** — similar, slightly more code-first.
- **BullMQ + Redis** — most flexibility, more ops.

Wire up "scheduled" jobs that fan out per-workspace × per-prompt × per-engine. Don't run scans in HTTP handlers.

## 9. First Claude session — scaffold the data model

In your project root, run `claude` and prompt:

```
Read docs/handoff/01-data-model.md and docs/handoff/02-metrics-definitions.md.

Generate a Postgres schema (Drizzle ORM, multi-tenant with workspace_id on every table) for: projects, prompts, topics, tags, brands, chats, sources, citations, brand_mentions. Include indexes for the common query patterns described in the handoff. Output as a single migration file.
```

Review the output, run the migration, commit.

## 10. Verify skills work

In Claude, try each skill at least once so you know they're wired up:

```
/seo-geo
/seo-bing-chatgpt
/seo-content
/llm-citation-outreach
```

Each should print its usage and not error.

## 11. Set up deployment (when ready)

- **Vercel** — easiest for Next.js. Push to GitHub, connect repo, deploy.
- **Render** — works for any Node app. Use a `render.yaml` for IaC.
- **Railway** — good developer ergonomics, single-machine pricing.

Whichever you pick, **set spend caps on every AI provider before you ship**. A bug in the prompt-runner can blow $1k of OpenAI credit in an hour.

## 12. First feature: build the prompt-running pipeline

This is the core loop. Tell Claude:

```
Read docs/handoff/03-ai-engines-and-apis.md.

Build the prompt-running pipeline as background jobs. For each prompt × engine combination, call the engine's API with web search enabled, capture the response + citations, and write a chat record + sources + citations to the database. Use Anthropic prompt caching for the system prompt of brand extraction. Include retry with exponential backoff. Make jobs idempotent on (workspace_id, prompt_id, engine, run_date).
```

Run it for a single test prompt across all engines before scaling up.

## 13. Don't forget

- **Spend alerting from day one.** Per-workspace per-engine per-day spend tracking, hard cap at 2-3x expected.
- **Engine model snapshot tagging.** Every chat record stores the exact model snapshot (e.g., `gpt-5-2026-04-15`). When OpenAI ships a new model, this tells you why metrics shifted.
- **Read [07-gotchas-and-learnings.md](07-gotchas-and-learnings.md) before scoping any sprint.** It will save you specific mistakes.

## Help

- Claude Code docs: claude.com/claude-code
- Aaron is the human contact for anything Thrive-specific (existing scanner snippets, customer context, GEO playbook questions).
