---
name: llm-citation-outreach
description: "Build LLM citations for a brand by mining which domains AI search engines (ChatGPT, Perplexity, Gemini, Google AI Overviews) cite when answering your target prompts, then running personalized outreach from a real human inbox. Covers listicle inclusion, mention exchange, resource page additions, reply drafting, and on-site listicle generation as bait. Use when the user says 'LLM citations', 'AI search outreach', 'get listed in ChatGPT', 'mention exchange', 'listicle outreach', 'GEO outreach', 'Peec outreach', or 'cite us in AI answers'."
user-invokable: true
argument-hint: "[mine|discover|outreach|replies|listicle|full|status]"
metadata:
  author: Aaron Whittaker
  version: "1.0.0"
  category: seo-geo
---

# LLM Citation Outreach

A full pipeline for mining LLM-cited domains, verifying contact info, sending
outreach from a real inbox, drafting replies, and generating listicle pages as
bait for mention exchanges.

## When to use this

- "I want to build LLM citations for [brand]"
- "Find sites that ChatGPT cites for [topic] so we can pitch them"
- "Run our target prompts and see who's cited"
- "Send outreach from [email] asking to be added to their listicle"
- "Check the outreach inbox and draft replies"
- "Make a Best-of listicle for [topic]"

## Assumed project layout

This skill assumes the target project follows a standard WAT (Workflow / Agent / Tools) layout:

```
<project>/
├── tools/llm-citation/
│   ├── 01-mine-citations.js
│   ├── 02-discover-contacts.js
│   ├── 03-send-outreach.js
│   ├── 04-monitor-replies.js
│   ├── 05-generate-listicle.js
│   ├── run.js
│   └── lib/
├── workflows/llm-citation-outreach.md
├── data/citation-outreach/
├── credentials.json, token.json        # Gmail OAuth
└── .env                                # API keys
```

If the project doesn't have this layout, build it out following the structure above. The reference implementation Thrive uses internally can be shared separately.

## Quick reference

| Command | Purpose |
|---|---|
| `node tools/llm-citation/run.js status` | Show pipeline state |
| `node tools/llm-citation/run.js mine` | Run prompts, extract citations |
| `node tools/llm-citation/run.js discover --limit 20` | Find contact info |
| `node tools/llm-citation/run.js outreach --gmail-draft --limit 10` | Draft outreach |
| `node tools/llm-citation/run.js replies` | Draft replies in Gmail |
| `node tools/llm-citation/run.js listicle best-geo-agencies-2026 --write` | Generate listicle |
| `node tools/llm-citation/run.js full` | Run phases 1-3 in safe mode |

## Phases

### Phase 1 — Mine citations

Runs target prompts across:
- **Peec.ai** (cached citation data, if project is tracked)
- **Perplexity Sonar Pro** (native citations)
- **OpenAI GPT-4o-mini** (brand mentions from text)
- **Gemini 2.5 Flash** (brand mentions from text)

Aggregates by domain with a priority score:
`citations × (1 + 0.3 × modelOverlap) × (1 + 0.2 × promptCoverage)`

**Output:** `data/citation-outreach/citations.json` with top 30 domains highlighted.

**Cost:** ~$1 for 100 prompts × 3 models.

### Phase 2 — Discover contacts

For each ranked domain:
1. Fetches /, /contact, /contact-us, /write-for-us, /about, /team, /press, etc.
2. Extracts mailto: links, raw emails, and obfuscated emails
3. Finds contact-form URLs
4. Verifies emails via the free chain: syntax → MX lookup → disposable/free/role check → SMTP handshake
5. Scores each email 0-100

**Output:** `data/citation-outreach/contacts.json`.
**Cost:** $0.

### Phase 3 — Outreach from real inbox

Templates in `tools/llm-citation/lib/email-templates.js`:
- `mention_exchange` — "we featured you, would you feature us?"
- `add_to_listicle` — straight ask for listicle inclusion
- `resource_page` — soft value-first approach
- `media_pitch` — short punchy pitch for DA 70+ pubs

Three modes:
- `disk-draft` (default) — writes `.txt` files for local review
- `gmail-draft` — creates actual Gmail drafts in the sender's account
- `send` — fires emails via Gmail API

**Safety:** 20/day cap, 30-second gap between sends, dedupes via `outreach-log.json`, requires `credentials.json` + `token.json`.

### Phase 4 — Reply monitor + draft responses

1. Queries Gmail: `to:<sender-email> in:inbox newer_than:7d`
2. Filters to actual replies (In-Reply-To header or "Re:" subject)
3. Classifies by keyword: positive / question / negative / auto_reply / unsubscribe / not_the_right_person
4. Creates a **Gmail draft** in the same thread for the sender to review
5. Never auto-sends

### Phase 5 — Listicle generator (bait)

Generates "Best [X] 2026" HTML pages, pulling candidates from citations.json.
Brand sits at #1 by default. Includes full schema (Article, BreadcrumbList, ItemList, ProfessionalService).

Built-in specs:
- `best-geo-agencies-2026`
- `best-aeo-agencies-2026`
- `best-llm-seo-agencies-2026`
- `best-ai-search-tools-2026`
- `best-seo-agencies-financial-advisors`

## Email verification: free vs paid

**Free chain** (default): syntax → MX → disposable check → SMTP handshake. Catches ~85% of bounces.

**Paid recommendations:**
1. **Hunter.io Starter** — $49/mo — best overall, combines discovery + verify
2. **ZeroBounce** — $16/mo (2K credits) — cheapest for pure verification
3. **NeverBounce** — $0.008/verification — pay-as-you-go
4. **Emailable** — $30/mo (5K credits) — best on catch-all domains

## Safety rules

1. Never auto-send replies — drafts only, human reviews
2. Respect the 20/day cap (raising it risks Gmail spam flags)
3. Never contact the same domain twice (dedupe via log)
4. Stop immediately on unsubscribe
5. Always review drafts before using `--send`

## When things break

- **Perplexity 401** → check `PERPLEXITY_API_KEY`
- **Gmail invalid_grant** → `rm token.json && node tools/gmail-auth.js`
- **SMTP handshake hangs** → ISP blocks port 25 → use `--no-smtp`
- **Peec 403** → `--no-peec` flag
- **Gemini quota** → `--models perplexity,openai`

## Related skills

- `seo-geo` — AI crawler accessibility, llms.txt
- `seo-backlinks` — traditional backlink profile analysis
- `seo-competitor-pages` — "X vs Y" and "alternatives" pages
