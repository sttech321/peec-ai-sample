# CLAUDE.md - AI Visibility Tracker

## Overview
This is a Next.js (App Router) + TypeScript + Tailwind project backed by PostgreSQL (Drizzle ORM).
It is an AI Visibility Tracker, tracking brands' mentions and citations across AI engines like ChatGPT, Claude, Perplexity, Gemini, and Google AI Overviews.

## Architecture
- **Data Model**: Multi-tenant with `workspace_id` on every table. Entities include `projects`, `prompts`, `topics`, `tags`, `brands`, `chats`, `sources`, `citations`, and `brand_mentions`.
- **Jobs Engine**: Inngest is used to handle daily scheduled background jobs to call AI APIs and parse results. Scans should NEVER run synchronously in HTTP handlers.
- **Reporting**: Metrics include Visibility (%), Share of Voice (%), Sentiment (0-100), Position (rank), Retrieval Rate (avg), Citation Rate (avg).
- **Core Loop**: Prompt × Engine API calls -> Store response -> Extract citations -> LLM Brand Extraction -> LLM Sentiment -> Persist to DB.

## Source of Truth
Read from `docs/handoff/` for detailed definitions:
- `01-data-model.md`: Data structure and entity relationships.
- `02-metrics-definitions.md`: Exact formulas for visibility, sentiment, and SOV. Do not mix percentage/average display.
- `03-ai-engines-and-apis.md`: Which APIs to use for each engine (e.g. prompt caching for Claude).
- `07-gotchas-and-learnings.md`: Critical lessons like "Show CIs", "Always break down by engine", "Engine model snapshots shift results".
- `08-llm-citation-outreach.md`: The playbook for the outreach feature.

## Commands
- Run dev server: `npm run dev`
- Database migrations: `npx drizzle-kit push`
