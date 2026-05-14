# Claude Code Skills Worth Installing on Day One

This bundle includes copies of the most directly relevant skills under [skills/](skills/). Drop them into `~/.claude/skills/` on the new machine:

```bash
cp -r peec-clone-handoff/skills/* ~/.claude/skills/
```

## Included in this bundle

### `seo-geo`
Generative Engine Optimization analysis. Covers AI Overviews, ChatGPT, Perplexity, Bing Copilot. Includes:
- AI crawler accessibility checks (robots.txt, llms.txt compliance).
- Passage-level citability scoring — how "liftable" each passage is.
- Brand mention signal analysis.
- Platform-specific tactical guidance.

**When to use:** Whenever a customer asks "why am I not getting cited" or you're auditing a domain against the AI search visibility ruleset.

### `seo-bing-chatgpt`
Bing + ChatGPT Search optimization. ChatGPT Search uses Bing as its primary index, so Bing is the highest-leverage path to ChatGPT visibility. Covers:
- Bing Webmaster Tools setup.
- OAI-SearchBot configuration.
- IndexNow protocol implementation.
- Bing-specific content format preferences (modular chunks, exact-match signals).
- Off-site signals Bing weights heavily (LinkedIn, X, Reddit, G2).
- The "Bing Path vs Google Path" framework.

**When to use:** When a customer's ChatGPT visibility is low. Before optimizing for OpenAI's crawler directly, fix Bing.

### `seo-content`
Content quality + E-E-A-T analysis with AI citation readiness. Covers:
- E-E-A-T signal evaluation.
- Readability + content depth.
- AI citation readiness scoring (passage-level).
- Thin content detection.

**When to use:** Audits of content surfaces. Pairs naturally with `seo-geo`.

### `llm-citation-outreach`
The outreach playbook for getting cited in AI answers. Mines which domains AI engines cite for your prompts, discovers contacts, sends personalized outreach, drafts replies, generates listicle bait. Reusable pattern, not a single product feature.

**When to use:** Once your tool surfaces "competitors are cited here, you aren't" — the next product surface is "help me get cited too." This is that playbook.

## Other skills already in `~/.claude/skills/` that are useful

These aren't in this bundle (they're general-purpose), but if your coworker's machine already has them they're worth knowing about:

- `seo-schema` — generate + validate JSON-LD structured data. Critical for the "fix your schema" recommendations panel.
- `seo-technical` — full technical audit (crawlability, indexability, mobile, CWV, security headers).
- `seo-google` — Search Console + PageSpeed + CrUX + GA4 integrations. Useful if you offer a "connect your Google accounts" feature.
- `seo-dataforseo` — DataForSEO MCP integration for live SERP, keyword volumes, backlinks. Replaces several individual paid APIs.
- `seo-page` — deep single-URL audit. Useful as a "scan this page" tool inside the product.
- `seo-audit` — full-site audit orchestrator with parallel subagents. Can be run as a one-shot scan.

## How to invoke a skill

```
/seo-geo
/seo-bing-chatgpt
/llm-citation-outreach
```

Or in conversation: "use the seo-geo skill to audit this domain."

## Skills the coworker should NOT install

`new-client-onboarding` and `qa-flow-tester` are highly Aaron/Thrive-specific. Same with `render-deploy` (assumes specific Render service IDs). Skip these and let your coworker build their own equivalents once their stack is decided.
