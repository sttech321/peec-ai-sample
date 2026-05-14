# Gotchas and Learnings

What we wish we'd known before starting. Read this before scoping a sprint.

## On metrics and dashboards

### Don't mix percentages and averages in the same chart
The biggest UX bug in this category. `share_of_voice` is 0-1 (display × 100). `retrieval_rate` is 0-N average (display as-is). If your "metrics by domain" table shows both side by side without unit suffixes, customers will misread it. Always suffix `%` on percentages and explicitly label "avg" on rates.

### 7-day rolling beats daily
Daily numbers are noisy. A brand that's truly on 35% visibility will show daily reads anywhere from 20% to 50%. Default the dashboard to 7-day trailing. Expose daily as a drill-down, not a default.

### Always break down by engine
Aggregate visibility hides the action. A brand can be 80% visible in ChatGPT and 5% in Perplexity. The aggregate is meaningless; the breakdown is the insight.

### Show CIs or trend bands, not just point estimates
With 7-day rolling and ~5-7 chats per prompt per engine per day, you have small-n statistics. Adding even a simple ± band (e.g., 1 standard error) communicates uncertainty and stops customers from over-reacting to single-day swings.

## On AI engines

### Engine model snapshots shift results
When OpenAI ships a new GPT model, your customers' visibility numbers move overnight — and not because of anything they did. Tag every chat with the exact model snapshot. Surface this in the UI: "OpenAI shipped gpt-5.1 on March 12 — your Sentiment dropped 8 points coinciding with the model change."

### Citations and brand mentions are independent
A brand can be mentioned in the response without its domain being cited. A domain can be cited without the brand name appearing. Track both as separate signals — and explain the difference clearly in the UI, because customers conflate them.

### AI Overviews are flaky
Google AI Overviews don't appear on every query, vary by location, and Google frequently throttles them on YMYL topics. Plan for ~20-50% null results on tracked prompts. Don't treat null as zero visibility — it's "no AIO served," which is different.

### Web search is slow
A grounded chat call can take 15-45 seconds. Don't run them inline in API requests. Always queue. Show progress per-chat in the UI ("12 of 100 prompts complete").

## On brand extraction

### LLM extraction beats regex by a wide margin
Regex on `(brand_name|alias_1|alias_2)` misses paraphrases ("the agency Thrive runs") and false-positives on substring matches ("ThriveMart" matching "Thrive"). Use a structured-output LLM call with the brand list as input.

### Cache the system prompt
The system prompt for brand extraction is constant across thousands of chats per day. Use Anthropic prompt caching — `cache_control: { type: "ephemeral" }` on the system block. Cache hit rate should be > 90% on a daily run, cutting per-call cost by ~10x.

### Extract with confidence scores
Don't return `["Brand A", "Brand B"]`. Return `[{name: "Brand A", confidence: 0.95, mention_text: "..."}]`. Filter confidence < 0.7 in production. Surface borderline cases in a "review queue" so customers can teach the model their brand aliases.

## On prompts

### AI search prompts ≠ Google keywords
You cannot just import an Ahrefs keyword list as your prompt set. AI search queries are conversational, longer, and shaped differently ("who's the best X for Y?" not "best X"). Generate prompts via LLM from a keyword + intent description, then have a human curate. Volume tiers come from a separate signal — keyword volume of related terms, manual rating, or LLM scoring.

### Prompt drift is real
Sometimes a prompt's intent shifts because the AI's interpretation evolves. A prompt that used to surface "directory pages" now surfaces "individual provider pages." Cluster chats by retrieved-sources cosine-similarity over time and flag drift. This becomes a "your tracked prompt 'X' has shifted intent on March 2 — review or replace" alert.

### Prompts have lifecycle
Every quarter, audit which prompts are still producing useful signal. Some will degrade to "useless" (model now refuses to answer) or "saturated" (everyone scores 100%). Replace them.

## On product surfaces

### "Why?" is the killer feature
Showing a customer they have 12% visibility is the easy part. Telling them *why* and *what to do about it* is the product. Every visibility number should have a "why is this number" drill-down: which prompts, which engines, which competitors are winning, which sources are being cited that you're not.

### Recommendations need to be specific
"Improve your content" is useless. "Your competitor X is cited on 14 listicles for prompt Y; you're cited on 2. Here are the 12 outlet contacts to pitch." is the product. Categorize recommended actions: owned (your site), editorial (third-party listicles), reference (Wikipedia/directories), UGC (Reddit/Quora). Each category has a different tactical playbook.

### Outreach is the next product
Once a customer sees "competitors are cited here, you're not" — they will ask "can you help me get cited too." That's the second product surface. See [08-llm-citation-outreach.md](08-llm-citation-outreach.md) for the playbook.

## On engineering

### Multi-tenant from day one
`workspace_id` on every table. RLS in Postgres. Don't retrofit — Thrive's existing scanner is single-tenant SQLite and porting it would be a full rewrite.

### Background jobs from day one
Daily prompt runs are jobs, not requests. Use Inngest, Trigger.dev, or BullMQ. Don't run scans in HTTP handlers — you'll hit timeouts and lose state on every retry.

### Idempotency matters
Daily prompt runs will fail mid-batch. The resume should be idempotent — by `(workspace_id, prompt_id, engine, run_date)`. If a job is retried, it should not double-charge AI APIs.

### Spend alerting from day one
A bug in the prompt-runner can blow $1k of OpenAI credit in an hour. Instrument per-engine spend per workspace per day and hard-cap at a multiple of expected. Most teams skip this and learn the hard way.

### Observability before scale
Per-engine latency, success rate, brand-extraction confidence distribution, sentiment distribution. These tell you when an engine has shipped a model change before customers notice. Track from day one, not retrofitted at 100 customers.

## On pricing

A customer with 100 prompts × 5 engines × daily runs costs you ~$50-100/day in AI APIs. Plus brand extraction, sentiment, SerpAPI. **Don't price below $500/mo** for that volume — Peec's been moving up-market for a reason. Sub-$500/mo customers will break your unit economics.

Tier by prompt count and engine coverage. Premium tier = more prompts, all engines, weekly outreach support, white-label reports.

## On positioning vs Peec

Peec is well-known and growing. Don't try to out-feature them on day one. Pick a wedge:
- Vertical-specific (e.g., legal, healthcare, B2B SaaS) with prompt libraries already curated.
- Outreach-integrated (their visibility tool tells you the gap; yours tells you and runs the campaign to close it).
- Self-serve free tier with a "get listed in ChatGPT" lead magnet.
- White-label for agencies — Thrive could be customer #1.

Cloning Peec feature-for-feature with a worse brand is a losing game.
