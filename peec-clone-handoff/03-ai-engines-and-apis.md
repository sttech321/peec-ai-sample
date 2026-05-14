# AI Engines — Which to Track, Which APIs to Use

## Priority order (by AI search market share, Feb 2026)

1. **OpenAI / ChatGPT — 81%** (55.8M crawler visits in the SEJ study). Highest leverage.
2. **Anthropic / Claude — 16.6%** (23x YoY growth — fastest growing). Add early.
3. **Perplexity — 1.8%**. Small share but disproportionately weighted by tech-savvy users.
4. **Google AI Overviews — 0.6% as crawler, but huge as user-facing surface.** Track via SerpAPI scraping, not API.
5. **Gemini** — small standalone search share, but Google AI Overviews are powered by it. Track via Gemini API for "what would Gemini say standalone."
6. **Bing Copilot / ChatGPT Search index** — Bing is the index behind ChatGPT Search. Optimizing for Bing has outsized effect on ChatGPT visibility. See the `seo-bing-chatgpt` skill in this bundle.

## API choices

### ChatGPT
- **OpenAI Responses API** with `tools: [{ type: "web_search" }]` — gets you web-grounded answers. This is what you want, not the bare chat completion.
- Model: `gpt-5` (or whatever the current flagship is when reading). Track the exact snapshot per chat.
- Returns text + citation annotations. Parse citations from the annotation array, not from regex on the text.

### Claude
- **Anthropic Messages API** with the `web_search` tool enabled. Returns text + `web_search_tool_result` blocks with URLs.
- Model: `claude-sonnet-4-6` is the cost/quality sweet spot for this. Use Opus only if you're doing sentiment analysis or sophisticated brand-mention extraction.
- **Use prompt caching aggressively** — system prompts for brand extraction stay constant across thousands of chats. Cache the system + tool-definition blocks; cache hit rate should be > 90% on a daily run.

### Perplexity
- **Sonar API** (`/chat/completions` endpoint). Returns text + `citations` array.
- Model: `sonar-pro` for comprehensive citations, `sonar` for cost-efficient runs.

### Google AI Overviews
- **No official API.** You scrape via SerpAPI's Google Search endpoint with `engine=google` and parse the `ai_overview` block.
- Be aware: AI Overviews don't appear on every query, vary by location, and Google's serving them less aggressively for YMYL topics. Plan for null results.

### Gemini standalone
- **Google GenAI SDK** with grounding enabled (`tools: [{ google_search: {} }]`).
- Model: `gemini-2.5-pro` for grounded search, `gemini-2.5-flash` if cost matters more than quality.

### Bing Copilot
- No clean public API. Options:
  - Scrape via Bing Search API + chat surface (fragile).
  - Skip it and track Bing Webmaster Tools data instead — that's where you'll see ChatGPT Search citations show up since ChatGPT uses Bing's index.

## Daily prompt-run architecture

For each prompt × engine combination:
1. Make the API call. Stash the raw response.
2. Extract: response text, retrieved URLs, inline citations.
3. Run brand extraction (LLM call) against the response text using the project's brand list.
4. Run sentiment scoring (LLM call) per brand mention.
5. Persist the chat + sources + citations + brand_mentions + sentiment scores.

**Run as background jobs, not API requests.** A 100-prompt project across 5 engines = 500 chats = 500 API calls. Plus brand extraction + sentiment. That's ~1500 LLM calls per project per day. Use a queue.

## Cost estimates (rough, Q2 2026)

Per chat (one prompt × one engine), all-in:
- ChatGPT (GPT-5 + web search): ~$0.05-0.15
- Claude (Sonnet 4.6 + web search): ~$0.03-0.08
- Perplexity (sonar-pro): ~$0.01
- Gemini (2.5 Pro + grounding): ~$0.02
- AI Overviews (SerpAPI): ~$0.005

Plus brand extraction + sentiment (Claude Haiku 4.5 with prompt caching): ~$0.002 per chat after cache warmup.

**Rule of thumb:** Budget $0.10-0.20 per prompt-run-per-engine-per-day. A customer with 100 prompts on 5 engines costs you $50-100/day. Price accordingly.

## Rate limits to plan for

- OpenAI Tier 1: 500 req/min. You'll need Tier 2+ for any production load.
- Anthropic: similar — request a workspace upgrade early.
- Perplexity: stricter; queue with backoff.
- SerpAPI: paid plan dependent. Start at the $75/mo tier minimum.

Build retry logic with exponential backoff and circuit-breaker. AI APIs fail more than traditional ones — flaky results are baseline behavior, not bugs.
