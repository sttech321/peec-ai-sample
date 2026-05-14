# LLM Citation Outreach — Pattern Documentation

Once your tool surfaces "competitor X is cited on these 12 listicles, you're cited on 2," the customer will ask: "can you help me get cited too?" This is the second product surface. Most Peec customers eventually want this; some build it themselves, some use Thrive or another agency to run it.

This doc describes the pipeline pattern. The full skill (`llm-citation-outreach`) is in [skills/](skills/).

## Pipeline phases

### Phase 1: Mine citations
Run the customer's tracked prompts across Perplexity / OpenAI / Gemini (and ideally store-and-replay from your own visibility scans — same data). Aggregate retrieved + cited URLs into a domain-level table:

```
domain | times_cited | times_retrieved | priority_score | category
```

Rank by priority. Priority weighting we've found works:
- **Direct competitor cited there but customer is not** = highest priority.
- **Listicles** ("best X 2026") = high priority — they include 5-15 brands per page, easier inclusion.
- **Editorial articles** = medium priority — single-author pieces, harder to influence.
- **Reference pages** (Wikipedia, directories) = medium priority — different tactic (structured edits, not pitches).
- **UGC** (Reddit, Quora threads) = low priority but high authenticity — different tactic (organic participation, not outreach).

### Phase 2: Discover contacts
For each priority domain:
1. Scrape contact pages, about pages, author bylines.
2. Extract email patterns + author names.
3. Verify via Hunter.io (or free MX + SMTP handshake for low-volume).
4. Cross-reference LinkedIn for editorial roles (`Editor`, `Contributor`, `Senior Writer` for the relevant beat).

Store with confidence score. Don't pitch unverified emails — bounce rate destroys deliverability.

### Phase 3: Send outreach
Personalized pitches, sent from a real human inbox (not `noreply@`). Templates we've found convert:

- **Mention exchange.** "Saw you covered X. We have a piece on Y that complements yours — would you consider linking? Happy to link to your piece in our next post too."
- **Add to listicle.** "Your 'Best X 2026' list is great. We're a relevant addition because A, B, C — here's a 50-word blurb if you want to include us. No worries if not."
- **Resource page.** "Your resources page lists 12 tools in our category. We'd be relevant — here's why."
- **Media pitch.** "I noticed you write about X. We're running a study/data set on Y — happy to share the embargoed data if you want first look."

**Caps that matter:**
- 20 sends/day per inbox max. More = spam classifier.
- 30-60 second gap between sends.
- All sends are drafts in a real human's Gmail until they hit `send`.
- Templates are starting points — personalize per pitch with the article's actual content. Generic templates get 1-3% reply rate; personalized get 15-25%.

### Phase 4: Monitor + reply
Watch the inbox. Classify replies:
- `positive` — yes, we'll include / link / discuss.
- `question` — needs more info before deciding.
- `negative` — explicit no.
- `auto_reply` — out-of-office, ignore for 1 week.
- `unsubscribe` — flag domain as do-not-contact, hard.
- `not_the_right_person` — re-route to whoever they suggested.

Draft replies for each. **Never auto-send.** A human approves every outbound message.

### Phase 5: Listicle generation (bait)
Generate "Best X 2026" listicles on the customer's own domain that include them at #1, plus 8-12 legitimate competitors. This serves two purposes:
- Direct ranking play — "best X" is a high-intent query.
- **Mention-exchange bait** — when a competitor's PR team finds your listicle and emails asking to be included, you're now in a conversation with them where you can ask for inclusion in *their* listicle in return.

The listicle has to be honest. Fake rankings tank trust and don't perform. Include real pros/cons; rank by something defensible.

## Tooling layout (rough — adapt to your stack)

```
tools/llm-citation/
  01-mine-citations.js     # Phase 1
  02-discover-contacts.js  # Phase 2
  03-send-outreach.js      # Phase 3 (modes: disk-draft, gmail-draft, send)
  04-monitor-replies.js    # Phase 4
  05-generate-listicle.js  # Phase 5
  run.js                   # Orchestrator
```

## Things we've learned the hard way

- **Don't auto-send.** Every send goes through a human inbox approval. Customer's reputation is on the line.
- **Free email verification first.** MX + SMTP handshake catches 80% of bad addresses. Hunter.io paid is worth it above ~50 sends/week.
- **Daily caps are non-negotiable.** 20/day per inbox. More = spam folder permanently.
- **Templates need fresh personalization fields per pitch.** Reference the specific article, the specific list, the specific data point.
- **Reply classification needs human review for the first ~50 replies.** The classifier learns the customer's voice. After that, accuracy is ~95%.
- **Mention-exchange has the highest conversion.** "We'll link to you, you link to us" beats every other template.
- **Your customer's listicle pages need to be good.** If your listicle is at #1 because your client is hosting it, the page still needs to load fast, look legit, and be useful. Otherwise it's just a transparent SEO play and outreach replies dry up.

## Why this is a separate product surface

The visibility scanner shows the gap. The outreach pipeline closes it. They're complementary but distinct:
- Scanner is read-only, fully automated, daily.
- Outreach is write-action, human-in-the-loop, daily-ish.

Some customers want only the scanner ("we'll handle outreach internally"). Some want both as one product. Some want the scanner from you and the outreach as a managed service. Plan your pricing tiers accordingly.
