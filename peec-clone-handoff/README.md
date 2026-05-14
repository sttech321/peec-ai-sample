# Peec Clone — Claude Code Handoff Bundle

A starter kit for building an AI visibility tracking app (Peec.ai clone) with Claude Code. Distilled from Thrive's work building and operating a similar product.

## What "AI visibility" means here

Track how brands appear across AI search engines (ChatGPT, Perplexity, Gemini, Google AI Overviews, Bing Copilot). The product runs a fixed set of prompts daily, captures the AI responses, and reports:

- **Did your brand get mentioned?** (visibility)
- **How often vs. competitors?** (share of voice)
- **Was the mention positive?** (sentiment)
- **Which sources did the AI cite?** (citations / retrieval)
- **Where do competitors get cited that you don't?** (gap)

That's the whole product loop. Everything else is dashboards, prompts UX, and team/billing.

## What's in this bundle

1. [01-data-model.md](01-data-model.md) — The Peec data model, copied from their MCP instructions. Use as design reference.
2. [02-metrics-definitions.md](02-metrics-definitions.md) — Exact formulas + display rules for visibility, SoV, sentiment, position, retrieval/citation rates. **Do not get this wrong** — most teams confuse averages with percentages.
3. [03-ai-engines-and-apis.md](03-ai-engines-and-apis.md) — Which AI engines to query, which APIs to use, market share data, rate-limit gotchas.
4. [04-ai-crawler-study.md](04-ai-crawler-study.md) — Thresholds and signals from the SEJ 68M crawler study. Informs what onsite changes actually move the needle for your customers.
5. [05-existing-reference-stack.md](05-existing-reference-stack.md) — Notes on Thrive's existing AI visibility *scanner* (single-shot, single-tenant). **Don't fork it** — it's the wrong shape for a tracker product. There are 3 specific files worth borrowing once you're past initial scaffolding; the doc says which.
6. [06-skills-to-install.md](06-skills-to-install.md) — Claude Code skills worth installing on day one.
7. [07-gotchas-and-learnings.md](07-gotchas-and-learnings.md) — Hard-won lessons. Read this before scoping.
8. [08-llm-citation-outreach.md](08-llm-citation-outreach.md) — Outreach playbook. Once a customer can see who's getting cited and they aren't, the next product surface is "help me get cited too." This is the pattern.
9. [skills/](skills/) — Copies of the most directly relevant SKILL.md files (seo-geo, seo-bing-chatgpt, seo-content, llm-citation-outreach). Drop into `~/.claude/skills/` on the new machine.

## How to use this with Claude Code

**See [SETUP.md](SETUP.md) for the full step-by-step setup checklist** — installing Claude Code, dropping in the bundle, installing skills, provisioning API keys, scaffolding the data model, and running your first prompt-pipeline job. ~30-60 minutes end to end.

Short version:
1. Install Claude Code: `npm install -g @anthropic-ai/claude-code`.
2. Drop this folder into your project as `docs/handoff/` (or symlink).
3. Install the skills: `cp -r peec-clone-handoff/skills/* ~/.claude/skills/`.
4. Run `claude` and tell it: *"Read all files in docs/handoff/ then run /init to scaffold a CLAUDE.md for this project."*

## Suggested initial stack

Matches what Thrive's running today (no reason to invent):

- **Backend:** Node 20 + Express, or Next.js API routes if you want one repo.
- **DB:** Postgres (Supabase is fine). SQLite works for a prototype but will block multi-tenant.
- **Queue:** Inngest, Trigger.dev, or BullMQ — daily prompt runs are background jobs, not API calls.
- **AI calls:** OpenAI SDK (ChatGPT + GPT-5), Anthropic SDK (Claude), Google GenAI SDK (Gemini), Perplexity REST. SerpAPI for Google AI Overviews scraping. See [03-ai-engines-and-apis.md](03-ai-engines-and-apis.md).
- **Brand extraction:** LLM-based, not regex. Run after each AI response with a structured-output schema.
- **Frontend:** Next.js + Tailwind + shadcn. Charts: Recharts or Tremor.

## Critical: respect the metric semantics

The single most common mistake when cloning a tool like this is mishandling the metrics. Read [02-metrics-definitions.md](02-metrics-definitions.md) first. Specifically:

- `visibility`, `share_of_voice`, `retrieved_percentage` are **0-1 ratios** (multiply by 100 for display).
- `sentiment` is **0-100** (most healthy brands sit 65-85).
- `position` is **rank** (lower = better, never multiply).
- `retrieval_rate`, `citation_rate` are **averages, NOT percentages**. They can exceed 1.0. Display as-is. Never multiply.

If your dashboard ever shows "share of voice: 4500%" it's because someone multiplied a 0-1 ratio by 100 twice. This will happen on the first build. Catch it early.

---

Bundle assembled 2026-05-05.
