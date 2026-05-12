# Data Model — Reference (Peec)

Use this as your design starting point. It's a clean separation of concerns that's worth copying.

## Core entities

### Project
The top-level container. One project per brand-being-tracked (or per customer workspace). Holds prompts, brands, topics, tags, and reports.

### Prompt
A question you track daily. Example: "Who are the best M&A advisors for tech companies?" Each prompt runs against every configured AI engine on a schedule and produces a `chat`.

- Prompts have **volume tiers** (Very High → High → Medium → Low). This is critical: an AI search prompt isn't the same as a Google keyword. You need your own volume signal (search volume of related keywords, branded clustering, manual rating, or an LLM scoring pass).
- Prompts can be tagged for cross-cutting analysis.
- Prompts belong to one **topic**.

### Topic
A grouping for prompts. Example topic: "Sell-side M&A." Used for filtering and rolling up metrics by theme.

### Tag
Cross-cuts prompts (a prompt can have many tags). Useful for slicing reports by intent type ("comparison," "how-to," "definitional"), funnel stage, or any custom dimension.

### Brand
Two flavors: **own brands** (`is_own=true`) and **competitors**. Brands are matched against AI responses by name + domain. A single brand can have multiple aliases and multiple domains (e.g., "Thrive Internet Marketing Agency" / "Thrive Agency" / "thriveagency.com").

### Chat
The actual AI response for a (prompt, engine, date) tuple. Stores the raw response text, retrieved sources, and any inline citations. **Don't aggregate too early** — you'll want to drill back to individual chats from the dashboard.

### Source
A URL the AI retrieved (i.e., the engine grounded its answer in this URL). Sources are not necessarily cited inline.

### Citation
A source that was *referenced inline* in the response. Citations and brand mentions are independent — a brand can be mentioned without its domain being cited, and a domain can be cited without the brand being mentioned by name.

## Critical relationships

```
Project (1) ─< Prompts (M)
Project (1) ─< Brands (M)  [own + competitors]
Project (1) ─< Topics (M)
Project (1) ─< Tags (M)

Prompt (1) ─< Chats (M)  [one per engine per day]
Prompt (M) ── Topic (1)
Prompt (M) ─< Tags (M)

Chat (1) ─< Sources (M)
Chat (1) ─< Citations (M)  [subset of sources, with inline ref]
Chat (1) ─< BrandMentions (M)  [which brands appeared in the response]
```

## Server-side dimensions

Reports are dimensioned by:
- `topic_id`
- `model_id` (engine — ChatGPT, Perplexity, Gemini, Claude, AI Overviews, Bing Copilot)
- `date`

**Always break down by engine, not just aggregate.** Customers will ask "how am I doing in ChatGPT specifically?" The aggregate-only view is insufficient.

## Gap analysis

The killer feature on the citation side. Filter: "show me sources where competitors are cited but my brand is not." This is what drives outreach. Implement it as a stored filter on the source/citation table — not as ad-hoc client-side filtering, because you'll need it backed by counts.

## Action recommendations

Peec exposes a `get_actions` endpoint with scopes: `overview`, `owned`, `editorial`, `reference`, `ugc`. The categorization matters:
- **Owned** — pages on the brand's own domain to update.
- **Editorial** — third-party listicles / articles to pitch.
- **Reference** — Wikipedia, directories, structured-data sources.
- **UGC** — Reddit, Quora, forum threads.

Each citation source falls into one of these buckets and the right outreach tactic differs by bucket. Build this categorization into your data model from day one — retrofitting it later is painful.

## Things Peec doesn't expose (consider adding)

- **Confidence intervals** on visibility — daily noise is real. A brand can swing 10pp day-over-day on the same prompt. 7-day trailing averages with confidence bands beat raw daily numbers.
- **Engine version tracking** — when OpenAI ships a new model, results shift. Tag every chat with the exact model snapshot used.
- **Prompt drift** — sometimes a prompt's intent shifts because the AI's interpretation changes. Cluster chats by retrieved-sources similarity over time and flag drift.
