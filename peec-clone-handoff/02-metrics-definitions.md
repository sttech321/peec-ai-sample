# Metrics — Definitions, Display Rules, Benchmarks

Read this before writing a single chart. Most cloning attempts get the units wrong on day one.

## Visibility

**Definition:** Of N chats run for a prompt set, in how many did your brand get mentioned?

**Formula:** `mentions / total_chats`

**Range:** 0 to 1.

**Display:** multiply by 100, suffix `%`. So 0.34 → "34%".

**Benchmarks:**
- `> 50%` = strong
- `20-50%` = developing
- `< 20%` = weak / call out explicitly
- `0%` = critical gap, surface in red

## Share of Voice (SoV)

**Definition:** Of all brand mentions across the prompt set, what share were yours?

**Formula:** `your_mentions / sum(all_brand_mentions)`

**Range:** 0 to 1.

**Display:** multiply by 100, suffix `%`.

**Benchmarks:**
- `> 25%` = market leadership
- `10-25%` = competitive
- `< 10%` = trailing

## Sentiment

**Definition:** Average sentiment of brand mentions, scored by an LLM pass on the surrounding context.

**Range:** 0 to 100. **Already on a 0-100 scale — do NOT multiply.**

**Benchmarks:**
- `65-85` = healthy zone (most brands)
- `> 85` = unusually positive (often praise-bait prompts, audit your prompt set)
- `< 50` = problem, surface as warning
- `< 35` = crisis, surface as red

## Position

**Definition:** When the brand is mentioned, what's its average rank in the response (first mention = 1, second = 2, etc.)?

**Range:** 1 to N (lower is better). Sometimes null if not mentioned.

**Display:** show as integer or one decimal. **Lower is better — sort ascending.**

**Benchmarks:**
- `1-2` = top-of-mind
- `3-5` = mentioned but not lead
- `> 5` = "and also" territory; barely competitive

## Retrieval Rate

**Definition:** Average number of times a domain was retrieved per chat.

**Range:** 0 to N (can exceed 1.0 — a single domain can be retrieved multiple times in one response).

**Display:** show the raw number. **Do NOT multiply by 100.** This is an average, not a percentage.

If you see `retrieval_rate: 1.4` it means that domain was retrieved on average 1.4 times per chat across the prompt set. Don't render it as "140%."

## Citation Rate

**Definition:** Same as retrieval rate but for inline citations specifically.

**Range:** 0 to N (can exceed 1.0).

**Display:** raw number. Same warning — never multiply.

## Retrieved Percentage

**Definition:** Of N chats, in what fraction was this domain retrieved at least once?

**Range:** 0 to 1.

**Display:** multiply by 100, suffix `%`.

This one IS a percentage — distinguish carefully from `retrieval_rate`.

## Cheat sheet

| Metric | Range | Display |
|--------|-------|---------|
| visibility | 0-1 | × 100, `%` |
| share_of_voice | 0-1 | × 100, `%` |
| retrieved_percentage | 0-1 | × 100, `%` |
| sentiment | 0-100 | as-is |
| position | 1-N (rank) | as-is, ascending |
| retrieval_rate | 0-N (avg) | as-is, NEVER × 100 |
| citation_rate | 0-N (avg) | as-is, NEVER × 100 |

## Implementation notes

- **Store raw, derive on read.** Never store the percentage form. Store the underlying counts and divide on the way out so you can re-aggregate at any granularity.
- **Daily noise is real.** Show 7-day rolling averages by default; expose daily as a toggle. A brand can swing 5-10pp visibility day-over-day on the same prompt.
- **Engine breakdown is mandatory.** Every chart needs a "by engine" view. The aggregate-only view hides too much — a brand can be 80% in ChatGPT and 5% in Perplexity, and the aggregate hides the action.
- **Sentiment is an LLM pass.** Run sentiment scoring as a separate step on each `chat` record. Cache it — don't recompute on every dashboard load.
