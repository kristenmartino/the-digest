# Sift — Architecture Decision Register

**Last updated:** August 18, 2026
**Status:** D1–D30 settled (v1 production live); D31–D35 added for v1.5 / v2 direction (May 2026); D36–D45 added June 2026 (editorial theme, content + source quality, native + agentic scope); D46–D61 added Jul–Aug 2026 (evidence-first re-plan, IGO sourcing, infra economics, test validity, generated-prose constraints). **Prose bodies exist only for D1–D47 and D54 — the rest are table rows, and the bodies are not in numeric order.**

---

## Summary of decisions

| # | Decision | Choice | Cost | Status |
|---|----------|--------|------|--------|
| D1 | Content engine | RSS hybrid (RSS discovery + Claude Haiku summaries) | ~$4/mo | SETTLED |
| D2 | Hosting | Vercel (frontend) + Railway (Python backend) | ~$5/mo | SETTLED |
| D3 | Caching / persistence | Neon Postgres + pgvector as source of truth | $0 (free tier) | SETTLED |
| D4 | Prompt strategy | "Summarize" framing with structured subtopics | $0 | SETTLED |
| D5 | Card design | Mixed — RSS images when available, text-first accent bar when not | $0 | SETTLED |
| D6 | Content source identity | Anthropic API (not NewsAPI) — this IS the product | $0 | SETTLED |
| D7 | Content pipeline | Background pipeline — AI out of request path | $0 | SETTLED |
| D8 | Database | Vercel Postgres + pgvector | $0 (free tier) | SETTLED |
| D9 | Custom topics | Vector search + prompt rewrite fallback for misses | ~$0.003/miss | SETTLED |
| D10 | Authentication | Clerk (free to 10K MAU) | $0 | SETTLED |
| D11 | LangGraph | Build now — pipeline AND multi-source comparison | $5/mo (Railway) | SETTLED |
| D12 | Monitoring | Sentry + Vercel Analytics (both) | $0 | SETTLED |
| D13 | Streaming | Build as part of initial launch (SSE article delivery) | $0 | SETTLED |
| D14 | Embedding provider | Voyage AI (free 50M tokens/mo) | $0 | SETTLED |
| D15 | Image handling | RSS feed images only — no OG scraping, no proxy | $0 | SETTLED |
| D16 | Background refresh | Railway asyncio scheduler (every 30 min) + Vercel cron fallback | $0 | SETTLED |
| D17 | Model selection | Haiku 4.5 (upgrade to Sonnet is one-line change) | ~$4/mo | SETTLED |
| D22 | Compare source picker | Collapsed-by-default chip selector, 12 curated outlets | $0 | SETTLED |
| D23 | Compare source list | Curated outlets, not freeform input | $0 | SETTLED |
| D24 | Compare source limits | Min 2, max 5 sources per comparison | $0 | SETTLED |
| D25 | Per-source timeout | 20s timeout per source in compare workflow | $0 | SETTLED |

| D26 | Story threading architecture | 4-node LangGraph workflow (not 5) | ~~~$52/mo~~ see body | SUPERSEDED 2026-08-10 |
| D27 | Clustering method | LLM-as-judge (not embedding similarity) | $0 (batched) | SETTLED — measured 2026-08-13 |
| D28 | Entity extraction visibility | Entity tags visible in UI on StoryCard | $0 | SETTLED |
| D29 | Story ID stability | SHA256 hash of sorted article IDs | $0 | SETTLED |
| D30 | Pipeline-time vs request-time | Pipeline-time — zero user-facing latency | $0 | SETTLED |
| D31 | Project state mgmt scaffolding | STATUS.md + CLAUDE.md per repo; V0–V4 milestone tiers | $0 | SETTLED (May 2026) |
| D32 | iOS plan v1 status | Under review — parity-shaped scope, premature canonical API, missing KPIs | $0 | OPEN (May 2026) |
| D33 | Canonical /v1/* mobile API in sift-api | Deferred — reuse Next.js routes for now, collapse later | $0 | DEFERRED (May 2026) |
| D34 | github-projects MCP server | Installed via .mcp.json + .claude/settings.json (Projects v2 tools for future sessions) | $0 | SETTLED (May 2026) |
| D35 | Topic-search AI ownership | Move AI calls + DB writes to `sift-api`, phased; current Next.js route grandfathered | $0 | SETTLED (May 2026) |
| D36 | App-wide editorial theme | Un-scope `.sift-landing` to one global token layer (both themes); delete stone/indigo — not fork | $0 | SETTLED; 2E QA left (Jun 2026) |
| D37 | Rating treatments (§3) | Neutral + sourced: lean by position, party by letter, factual by neutral meter — never hue; reject MBFC credibility/bias-scale | $0 | SETTLED rule (Jun 2026) |
| D38 | "Every word is gold" | Fix copy at generation (rubric + LLM-judge, sift-api#90); reject the frontend overlap-suppressor on the evidence | $0 | SETTLED; gate in flight (Jun 2026) |
| D39 | Outlet count | Derive live from `outlet_profiles`; say "curated," drop the number on a DB miss | $0 | SETTLED (Jun 2026) |
| D40 | Outlet-data integrity | Prune drifted prod rows; seed CSV is no longer prod's source of truth → authoritative seeder | $0 | SETTLED; seeder open #93 (Jun 2026) |
| D41 | sift-mcp → sift-api | Merge into one service, two transports (REST + MCP), shared handlers | $0 | DECIDED, phased (May 2026) |
| D42 | Mobile protocol | REST/SSE only; agent loop server-side, MCP internal; hosted MCP deferred | $0 | SETTLED (May 2026) |
| D43 | Agentic surfaces | Refined Compare (`lens`) + Ask Sift in v1.5 (web + Android); depends on D41 | $0 to decide | SETTLED scope; **build PAUSED by D46** (Jul 2026) |
| D44 | Source expansion | Grow ~50 → ~200 by empirical set-cover; "curated AND rated," factual floor + resolvable/ingestable gates | $0 to decide; expansion priced Aug 2026 | DECIDED; **PAUSED by D46** — it is building, not evidence (Jul 2026). D46's blanket feature-work pause lifted 2026-08-05; whether *this* is un-paused has not been decided |
| D45 | Rank by civic impact | Rank by civic impact + reader accessibility (paywall) signal, not coverage volume; validate empirically. Signal model + staged v2 plan: [`RANKING_SIGNALS.md`](./RANKING_SIGNALS.md) | $0 to decide | **IMPLEMENTED Aug 2026** — v2 stages 1–7 live (D48–D52), scored by blind pairs; paywall half still unbuilt (sift#160) |
| D46 | Android paused; launch re-planned around evidence | Pause Android v1 for 90 days; replace the feature roadmap with a ~10-hr week-one evidence test; re-baseline budget to 6 hrs/wk | $0 to decide | SETTLED (Jul 2026); **feature-work pause LIFTED 2026-08-05** — Android stays paused, the week-one test stays the next action, but building is no longer prohibited |
| D47 | Q8 closed: global civic content | Sift covers non-US civic institutions. Entry point is IGOs sourced to founding treaties, not more foreign heads of state | $0 to decide | SETTLED (Aug 2026) |
| D48 | Feed balance: cap and dampen, never hide | One outlet caps at 6 of the 50-article pool; low-importance grim items (tone=grim, importance ≤3) rank ×0.6 (≈12h older); importance 4–5 somber news ranks untouched. Answer to the doom-stacked 'top' feed (NYP held 23/50) | ~$0.05/day (tone tag rides the existing Haiku call) | SETTLED (Aug 2026); fully live 2026-08-10 — cap, dampener, non-grim hero, tone backfilled (sift#211/#212, sift-api#186/#187/#188) |
| D49 | Opinion is not news ranking | Outlet-declared opinion (URL/title markers, deterministic) ranks ×0.6 at any importance, never takes the hero, and doesn't count toward the cross-spectrum bonus. Evidence: first labeled ranking eval (sift-api#200) — half the overrules rejected op-eds ranked as news | $0 (no LLM) | SETTLED (Aug 2026) |
| D50 | Roundup containers are not stories | Program episodes and daily briefs (title-pattern detected, deterministic) rank ×0.4 and never take the hero — they inherit importance from events they only mention. Evidence: labeled eval session 2 (sift-api#204) | $0 (no LLM) | SETTLED (Aug 2026) |
| D51 | The front page is for news | 'top' holds a higher bar than topical tabs: importance ≤2 ranks ×0.35 there (0 = hard floor), and non-news genres (feature/soft, LLM-tagged on the existing call) rank ×0.5 as standalone articles. Story ranking untouched — corroborated coverage keeps tabloid members visible under "how this was covered" | ~$0 (fourth key on an existing call) | SETTLED (Aug 2026) |
| D52 | Corroboration multiplies significance | A story's base is the mean importance of its members ÷ 2.5 (the observed mean), not a constant — outlet count scales significance instead of standing in for it. Evidence: an 18-outlet local drowning scored 1.05× a 169-death earthquake. Centered to hold the story/article mix #231 tuned: +89 reordering units, share unchanged | $0 (existing data) | SETTLED (Aug 2026) |
| D53 | A degrade must be reported, and tolerance is keyed to SQLSTATE | Every deliberate degrade path calls `reportError` (console + Sentry, tagged by call site) instead of swallowing. The "deploy before the migration lands" tolerance matches Postgres SQLSTATE 42P01/42703 and the named relation, not `String(err).includes("does not exist")` — which also matched `role "sift" does not exist`, so bad credentials rendered as an empty site instead of a 500 | $0 (Sentry already wired, inert without a DSN) | SETTLED (Aug 2026) |
| D54 | The Neon compute is allowed to sleep | The polling that prevented scale-to-zero removed; cold starts accepted at current traffic. The compute ran 26 days unbroken **with scale-to-zero already enabled** — because the batch poller queried `api_batches` every 60s and `/health` queried twice every 30 min, inside every 5-min window. No console setting needed changing | −~$15/mo (60% of sift's compute); revisit at real traffic | SETTLED (Aug 2026) |
| D55 | A term page must cover, not just define | `/term/<slug>` publishes only with a sourced definition **and** ≥8 corpus articles (`TERM_MIN_ARTICLES`). Definitional search is unwinnable — measured Wikipedia pageviews: 145,241/mo Strait of Hormuz, 4,001 TPS — and Cornell LII writes the definition better. The defensible half is which outlets are covering the term now and where they sit on the spectrum, which is built from the corpus Sift already has. `prior-restraint` is the live counter-case: cited, real, 0 articles, noindexed | $0 (no LLM; read-time query on a GIN index) | SETTLED (Aug 2026) |
| D56 | A definition is a claim; coverage is reportage | The two halves of a term page are held to different bars on purpose. The definition never renders without its source (`lib/term.ts` nulls the pair, as `lib/org.ts` does the budget triple), because the ~11,900 primer definitions already in the corpus all carry `source: null` and publishing one as a standalone page states a legal definition on Sift's own authority — the defect 013 and 015 each removed. The coverage half needs no citation beyond the articles it links: it counts Sift's own index rather than claiming anything about the world, and the copy scopes it that way | $0 | SETTLED (Aug 2026) |
| D57 | The primer counts as coverage; it still cannot define | `/term/<slug>` counts an article when the term is in the title/summary **or** when the article's own context primer defined it. The title-only signal missed the terms most worth a page — prior restraint 0 headline matches against 128 primer definitions, certiorari 5 vs 83, cloture 0 vs 45 — because those are what a journalist writes in paragraph nine. Both halves are reportage about Sift's own index, and the primer is the higher-precision one: its generator read the article, the regex only sees a string (#40 argues for it, not against). It still cannot supply a definition — all 72,689 primer terms carry `source: null` | $0 (GIN index on an IMMUTABLE function, 2.6 MB, 0.2 ms) | SETTLED (Aug 2026) |
| D58 | A collection page leads with a finding | `/glossary` opens with the measured fact that ~1 story in 5 turns on a term the coverage never names, before the list — following `/agencies`, on the reasoning that a reader who stops after the first screen should still leave with the thing worth sending on. Computed live, never hardcoded, so the sentence cannot drift from the corpus it describes | $0 | SETTLED (Aug 2026) |
| D59 | A test that cannot fail is not a test | Test suites are audited on whether a realistic bug turns them red, not on coverage — and every fix is proved by mutation first (break the source, confirm green, rewrite, confirm red). Two standing guards enforce it rather than relying on review: `__tests__/meta.test.ts` here and the hardened `tests/test_meta_suite.py` in `sift-api` reject assertion-free bodies, self-comparisons (`expect(f(x)).toBe(f(x))` — the original form of the `stable_hash` defect, which no lint rule sees) and tests defined where the runner will not collect them; Stryker (`npm run mutate`) and mutmut run by hand over a narrow set of pure, high-consequence modules, never in CI. The motivating case: `/api/compare` mocked its own rate limiter and CSRF gate and asserted on the mocks, so deleting the limiter outright left the suite green | $0 (dev-only; mutation runs are manual, ~80s scoped) | SETTLED (Aug 2026) |
| D60 | CI that does not gate is documentation | A green check nothing depends on is advisory. Both repos' workflows were built for branch-protection semantics — path-filtered jobs post green when skipped, precisely so they can be required — but no `required_status_checks` rule was ever configured in either, so a red suite blocked no merge and `sift-api` accepted direct pushes to `main`. The rule is that a suite worth writing is worth making load-bearing; the settings change itself is the owner's to make | $0 | **SETTLED (Aug 2026)** — rulesets active on both repos 2026-08-18: `Type Check & Test` required in `sift`, `Lint & Test` in `sift-api`, no bypass actors. `sift` also gained the `Lint` step it never had |
| D61 | The living-persons rule binds generated prose, not just dossiers | `OPERATING_CONTEXT.md` §5 said "no **dossier** claim about a living person without a citation to the primary record" — the pre-reversal framing. `LAUNCH_DECISION_MEMO.md` §2.2(b) inverted that ranking 2026-07-27 (hand-seeded dossier tables vs a summarizer emitting unreviewed prose about named people across 59 feeds every 30 min), and its B2 put the constraint into all three generators the same week — so the rule was enforced in code on a surface its own text did not cover. §5 now names summaries, primers, context and synthesis explicitly. Measured, half-clean: **0 of 38** legal-matter summaries escalate a charge into guilt (judge calibrated 12/12), while the reverse failure — dropping the source's "alleged" — is **unmeasured**, the judge scoring 0/5 on it. Evidence: sift-api#243/#264 | $0 | SETTLED (Aug 2026); the measurement half OPEN |

**Total estimated monthly cost: ~$30-50/mo**

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL PRO ($20/mo)                   │
│                                                         │
│  ┌──────────┐    ┌──────────────────────┐               │
│  │  Next.js  │───▶│  /api/news           │──▶ Postgres   │
│  │  React    │    │  (DB read only)      │   (pgvector)  │
│  │  Frontend │    │  <50ms response      │               │
│  │          │    └──────────────────────┘               │
│  │          │    ┌──────────────────────┐               │
│  │          │───▶│  /api/compare         │──▶ Railway     │
│  │          │    │  (proxy to Python)    │   Python svc   │
│  └──────────┘    └──────────────────────┘               │
│                                                         │
│  ┌──────────────────────────────────────┐               │
│  │  Vercel Cron (every 10-15 min)       │               │
│  │  Triggers pipeline refresh           │───▶ Railway    │
│  └──────────────────────────────────────┘               │
│                                                         │
│  Clerk (auth) · Sentry (errors) · Analytics (usage)     │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                  RAILWAY ($5/mo)                         │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  FastAPI + LangGraph                              │   │
│  │                                                   │   │
│  │  POST /pipeline/refresh                           │   │
│  │    → Fetch RSS feeds (instant)                    │   │
│  │    → Claude Haiku summarize (2-3s per batch)      │   │
│  │    → Voyage AI embed (< 1s)                       │   │
│  │    → Upsert into Postgres                         │   │
│  │    → Story threading per category:                │   │
│  │        Entity extract → LLM cluster → Synthesize  │   │
│  │                                                   │   │
│  │  POST /analyze/compare                            │   │
│  │    → LangGraph: fan-out search 3 outlets          │   │
│  │    → Extract claims                               │   │
│  │    → Compare & synthesize                         │   │
│  │    → Return comparison                            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              VERCEL POSTGRES / NEON (free tier)          │
│                                                         │
│  articles: id, title, summary, source_url, source_name, │
│            image_url, category, published_date,         │
│            embedding (vector), story_id, entities,      │
│            created_at                                   │
│                                                         │
│  stories: id, headline, summary, category, framings,    │
│           entities, article_count, published_date,      │
│           synthesis_status                              │
│                                                         │
│  users: managed by Clerk (external)                     │
│  custom_topics: user_id, name, query, embedding         │
│  bookmarks: user_id, article_id                         │
└─────────────────────────────────────────────────────────┘
```

---

## Detailed decisions

### D1. Content engine
**Decision:** RSS hybrid — RSS feeds for article discovery, Claude Haiku for AI summaries
**Changed from:** Claude doing both search AND summary in one call

**How it works:**
1. Background pipeline fetches RSS feeds from major publishers (instant, free)
2. Claude Haiku receives article titles/URLs and generates AI summaries (2-3s per batch)
3. Articles + summaries stored in Postgres
4. User requests are pure database reads (<50ms)

**Why this is better than the previous approach:**
- RSS is instant and free (vs 10-20s Claude web_search)
- RSS provides reliable image URLs, publication dates, source attribution
- Claude focuses only on summarization (what it's best at) rather than search + summarize
- AI summaries are the differentiator — RSS is just the discovery mechanism
- Fallback: if RSS misses a category (e.g., niche Energy topics), fall back to Claude web_search for that category

**RSS feed sources (initial set):**
- Reuters, AP, BBC, CNN, NPR (general news)
- TechCrunch, Ars Technica, The Verge, Wired (technology)
- Bloomberg, CNBC, Financial Times (business)
- Nature, Science, New Scientist (science)
- Utility Dive, E&E News, Solar Power World (energy)
- Al Jazeera, The Guardian, DW (world)
- STAT News, Health Affairs, WebMD (health)

---

### D2. Hosting
**Decision:** Vercel Pro ($20/mo) for Next.js frontend + Railway ($5/mo) for Python/LangGraph backend
**Changed from:** Railway only

**Why the split:**
- With background pipeline + Postgres, API routes are just DB reads — cold starts don't matter (~20ms query, not 15s Claude call)
- Vercel Pro gives us: Cron (pipeline triggers), Analytics (usage visibility), preview deploys (PR review), auto-SSL, CDN
- Railway hosts the Python FastAPI + LangGraph service as a persistent process (LangGraph workflows need long-running processes)
- This is the hybrid architecture from ARCHITECTURE.md, executed for real

---

### D3. Caching / persistence
**Decision:** Vercel Postgres (Neon) + pgvector as the single source of truth
**Changed from:** In-memory cache + disk persistence

**Why:**
- Articles persist across deploys, crashes, and cold starts
- pgvector enables semantic search for custom topics
- No Redis needed — Postgres handles both structured queries and vector similarity
- Free tier: 256MB storage (thousands of articles)
- In-memory cache can still be used as a hot layer in the Next.js API route for frequently accessed categories

---

### D4. Prompt strategy
**Decision:** "Summarize" framing with structured subtopics
**Unchanged from original**

Now applied specifically to the summary step: Claude receives article titles and URLs from RSS, and writes summaries. Not searching anymore.

---

### D5. Card design
**Decision:** Mixed — RSS images when available, text-first cards with category accent bar when not

**Implementation:**
- If RSS feed provides an image URL → show image card (image top, content below)
- If no image → show text-first card with thin category color bar at top, no image area
- No gradient fallbacks, no OG scraping, no placeholder icons
- Cards with and without images coexist in the grid (like NYT homepage)
- Featured card (first article) uses larger typography whether or not it has an image

---

### D6. Content source identity
**Decision:** Anthropic API — this IS the product
**Unchanged.** The RSS hybrid still uses Claude for summaries. "AI-Curated" still means something.

---

### D7. Content pipeline
**Decision:** Background pipeline — AI runs on a schedule, never in the user's request path

**Flow:**
```
Vercel Cron (every 10-15 min)
  → POST /pipeline/refresh to Railway
  → LangGraph pipeline:
      1. Fetch RSS feeds for all 10 categories
      2. Deduplicate against existing articles in Postgres
      3. Batch new articles → Claude Haiku for summaries
      4. Batch new articles → Voyage AI for embeddings
      5. Upsert into Postgres with category tags
  → User requests: SELECT from Postgres, <50ms
```

**Key insight (from Claude Code):** "The difference between a toy and a product is where the AI runs."

---

### D8. Database
**Decision:** Vercel Postgres + pgvector

**Schema:**
```sql
articles:
  id TEXT PRIMARY KEY
  title TEXT NOT NULL
  summary TEXT
  source_url TEXT UNIQUE
  source_name TEXT
  image_url TEXT
  category TEXT NOT NULL
  published_date TIMESTAMPTZ
  embedding VECTOR(1024)  -- Voyage AI dimensions
  created_at TIMESTAMPTZ DEFAULT NOW()

  INDEX idx_category_created (category, created_at DESC)
  -- FTS index on (title, summary) for keyword search

custom_topics:
  id TEXT PRIMARY KEY
  user_id TEXT NOT NULL  -- Clerk user ID
  name TEXT NOT NULL
  query TEXT NOT NULL
  embedding VECTOR(1024)
  created_at TIMESTAMPTZ DEFAULT NOW()

bookmarks:
  user_id TEXT NOT NULL
  article_id TEXT NOT NULL
  created_at TIMESTAMPTZ DEFAULT NOW()
  PRIMARY KEY (user_id, article_id)
```

---

### D9. Custom topics
**Decision:** Vector search over pre-built article index + Claude web_search fallback for misses

**How it works:**
1. User types "AI policy in European healthcare"
2. Embed query with Voyage AI (<50ms)
3. Vector similarity search against article embeddings in Postgres
4. If ≥3 good matches (similarity > threshold) → return results instantly
5. If <3 matches → fall back to Claude web_search for that specific query, then cache results

**Why combo:** Instant results 90% of the time (broad article pool covers most topics). Claude fallback catches niche/emerging topics the index hasn't seen yet.

---

### D10. Authentication
**Decision:** Clerk (free to 10K MAU)

**Why:** 5-minute setup, polished UI out of the box, free at portfolio scale. Manages user state for custom topics and cross-device bookmark sync. If costs become an issue at scale, migration to NextAuth is moderate effort.

---

### D11. LangGraph
**Decision:** Build now — both pipeline orchestration AND multi-source comparison

**Two LangGraph workflows:**

**Pipeline workflow (runs on cron):**
```
START → fetch_rss → deduplicate → summarize_batch → embed_batch → store → END
```
Sequential, but LangGraph gives error handling, retry, and state management.

**Comparison workflow (on-demand, user-triggered):**
```
START → fan_out_search (3 outlets parallel) → extract_claims → compare_synthesize → format → END
```
This is the portfolio centerpiece — genuine multi-step AI orchestration with fan-out/merge.

**Service:** Python FastAPI on Railway ($5/mo). Connects to same Vercel Postgres instance.

---

### D12. Monitoring
**Decision:** Sentry (error tracking) + Vercel Analytics (usage/performance)

Both free. Set up at deploy time. ~30 minutes total.

---

### D13. Streaming
**Decision:** Build SSE streaming for article delivery as part of initial launch

When a user loads a category for the first time (or custom topic with Claude fallback), articles stream in one by one via server-sent events rather than waiting for all results. Cached reads are still instant.

---

### D14. Embedding provider
**Decision:** Voyage AI (free 50M tokens/mo)

High-quality retrieval embeddings. Free tier covers thousands of articles. No second AI vendor cost. Switching providers is a one-function change if needed later.

---

### D15. Image handling
**Decision:** RSS feed images only — no OG scraping, no proxy, no SSRF concerns

RSS feeds include image URLs via `enclosure`, `media:content`, or `media:thumbnail` tags. Use them when present. When absent, show text-first card (D5). Entire OG scraping pipeline can be removed from codebase.

---

### D16. Background refresh
**Decision:** Railway asyncio scheduler (primary) + Vercel cron route (fallback)
**Changed from:** Vercel Cron (requires Pro plan)

Railway's FastAPI service runs an asyncio background task that refreshes every 30 minutes in production. A Vercel cron route also exists as a manual fallback. This avoids the $20/mo Vercel Pro requirement.

---

### D17. Model selection
**Decision:** Haiku 4.5 for summaries (upgrade to Sonnet is one-line change)

With the RSS hybrid, Claude is only summarizing, not searching. Haiku is sufficient for news summaries. Upgrade path: change model string in the pipeline's summarize step.

---

## Cost summary (actual, March 2026 — SUPERSEDED, kept for the record)

> **Every line of this table is wrong as of 2026-08-14, and it was wrong for
> months before anyone checked.** It is left here because the way it went wrong
> is the useful part: each figure was true when written, none had an owner, and
> nothing re-derived them. Model spend was ~$300/mo while `STATUS.md` said
> "~$15/mo" (see `sift-api/scripts/verify_cost_baseline.py`); Neon was on
> Launch, not the free tier, and had never once suspended its compute.
>
> **Current figures live where they can be re-derived, not written down:**
> `sift-api/scripts/verify_cost_baseline.py` (model spend) and
> `sift-api/scripts/verify_neon_idle.py` (Neon compute + storage). Run those.

| Component | Monthly cost (March 2026, stale) |
|-----------|-------------|
| Vercel (Hobby plan) | $0 |
| Railway (Python service) | ~$5 |
| Neon Postgres (free tier) | $0 — **wrong: Launch, $19 base + overage; see D54** |
| Claude Haiku 4.5 API (~10 cats x 6 refreshes/hr) | ~$4 — **wrong by ~50x at peak** |
| Voyage AI embeddings (free tier) | $0 |
| Clerk auth (free to 10K MAU) | $0 |
| Domain (subdomain of kristenmartino.ai) | $0 |
| **Total** | **~$9/mo — not a current number** |

---

## Build sequence (actual)

All phases complete. Production live at siftnews.kristenmartino.ai as of March 31, 2026.

```
Phase 1:  Postgres schema + Python FastAPI + LangGraph pipeline     ✓
          RSS feed integration (100+ feeds, 10 categories)          ✓
          Claude Haiku summaries + Voyage AI embeddings              ✓

Phase 2:  Next.js API routes rewrite (Postgres reads)               ✓
          Card redesign (text-first + RSS images)                    ✓
          Clerk auth + bookmarks sync                                ✓
          SSE streaming for topic search                             ✓
          3 new categories (politics, sports, entertainment)         ✓

Phase 3:  LangGraph comparison workflow (web search fan-out)        ✓
          Topic search (vector + web search fallback)               ✓
          Landing page + OG image + favicon                         ✓
          Dark/light themes (Newsprint / Late Edition)              ✓

Phase 4:  Deploy to production (Vercel + Railway + Neon)            ✓
          CI/CD (GitHub Actions on both repos)                      ✓
          DNS (siftnews.kristenmartino.ai)                          ✓
          Brand identity (SiftLogo diamond mark, color story)       ✓

Phase 5:  Cross-source story threading (4-node LangGraph)          ✓
          Entity extraction + LLM clustering + synthesis            ✓
          StoryCard component with entity tags + framings           ✓
          FeedItem rendering (stories + articles merged)            ✓
```

---

## What gets removed from current codebase

| Item | Why |
|------|-----|
| OG image scraping (enrichWithOgImages, SSRF checks) | Replaced by RSS feed images |
| In-memory cache (Map + stale-while-revalidate) | Replaced by Postgres |
| Disk cache (/tmp/sift-cache/) | Replaced by Postgres |
| Direct Anthropic API call in route.ts | Moved to Python pipeline |
| NEWSAPI_CATEGORIES in constants.ts | Vestigial from NewsAPI swap |
| saveCacheToDisk() (and the 4x bug) | No longer needed |

---

## Decision dependencies (resolved)

```
D7 (Pipeline) ──→ D8 (Postgres) ──→ D9 (Custom topics)
     │                                      │
     └──→ D16 (Vercel Cron)          D10 (Clerk auth)
     │                                      │
     └──→ D14 (Voyage embeddings)    D11 (LangGraph on Railway)
                                            │
                                     D2 (Vercel + Railway split)

All dependencies resolved. No blockers.
```

---

### D18. Database provider
**Decision:** Neon free tier (standalone) instead of Vercel Postgres
**Changed from:** Vercel Postgres (which is Neon under the hood)

Standalone Neon gives more control: 0.5 GiB storage, pgvector native, connection pooling, auto-suspend. Both Vercel (pooled) and Railway (direct) connect to the same Neon instance. Pooled connection for serverless functions, direct for long-running Railway service.

> **Corrections, 2026-08-14.** Three claims in the paragraph above did not survive contact with the running system.
>
> - **Not the free tier, and not 0.5 GiB.** The project is on **Launch**, which bills compute and storage by usage with no free allowance ($0.35/GB-month storage; ~$0.106/CU-hour compute as observed 2026-08-14). Nothing records when or why it moved. Actual size: 2.11 GB → $0.38/month.
> - **"Auto-suspend" was a reason to choose Neon and was never verified.** The compute had never suspended once in 26 days. See D54.
> - **"Pooled connection for serverless functions" is aspirational.** No client in any repo uses a `-pooler` endpoint; every `DATABASE_URL` inspected points at the direct endpoint. `sift-api/STATUS.md` separately records that `max=5` "starts queuing requests visibly" — which is the symptom this claim was meant to prevent. Worth doing; not yet done.

---

### D19. Domain
**Decision:** siftnews.kristenmartino.ai (subdomain) instead of siftnews.ai
**Changed from:** siftnews.ai (separate domain)

Uses existing portfolio domain via CNAME to Vercel. Zero cost, consistent branding under the portfolio umbrella.

---

### D20. Categories — expanded to 10
**Decision:** Added Politics, Sports, Entertainment to the original 7

Each category has 8-11 RSS feeds. Expanded total from ~56 feeds to 100+ feeds. Category colors have semantic meaning (e.g., energy = teal for sustainability, politics = indigo for authority).

---

### D21. Brand identity
**Decision:** Named theme palettes + SVG diamond brand mark

- Themes: "Late Edition" (dark, warm stone tones) and "Newsprint" (light, warm paper)
- Brand mark: SVG diamond rendered at all sizes via SiftLogo component with full/compact/mark/wordmark variants
- Category colors: each chosen for semantic meaning, not decoration

### D22. Compare source picker — collapsed by default
**Decision:** Add a chip selector UI for choosing which outlets to compare, collapsed behind a "Comparing: Reuters, BBC, AP — Change" toggle.

- Default 3 sources (Reuters, BBC, AP) preserves current behavior — zero friction for quick comparisons
- Expanded state shows 12 curated outlets as toggleable chips
- Alternative considered: always-visible source grid. Rejected because it clutters the compare form for the common case (most users accept defaults)
- Alternative considered: freeform text input. Rejected because Claude web_search reliability varies with arbitrary outlet names

### D23. Compare source list — curated, not freeform
**Decision:** 12 pre-selected outlets spanning wire services (Reuters, AP), broadcast (BBC, CNN, Al Jazeera, NPR), print (Guardian, NYT, Washington Post, Economist, FT), and digital-native (Axios).

- Each outlet tested against Claude's `web_search` tool for reliable results
- Geographic and editorial diversity: US, UK, Middle East, wire services
- Matches sources already in the RSS feed list for consistency
- Labels are abbreviated for chip display (NYT, AP, Wash. Post, FT, Economist)

### D24. Compare source limits — min 2, max 5
**Decision:** Minimum 2 sources (comparison needs at least 2), maximum 5 (caps latency and cost).

- Each source triggers a Claude web_search call (~$0.004 each)
- 5 sources run in parallel but Claude rate limits may serialize them
- Backend already validates `len(sources) > 5` → 400 error
- Frontend disables unselected chips when 5 are selected, disables submit when < 2

### D25. Per-source timeout — 20 seconds
**Decision:** Wrap each source's Claude API call in `asyncio.wait_for(_, timeout=20)`.

- Without per-source timeout, one slow/stuck source blocks the entire comparison
- 20s is generous for a single web_search + summary call (typically 5-12s)
- On timeout, source returns empty and is logged as an error — remaining sources still produce results
- Graceful degradation: 3/5 sources succeeding is better than 0/5 from a global timeout

---

### D26. Story threading architecture — 4-node LangGraph workflow
**Decision:** 4-node pipeline: Fetch -> Entity Extract -> LLM Cluster -> Synthesize+Store
**Changed from:** 5-node (with separate ranking node)

We considered three approaches:

1. **Simple embedding cosine similarity** (~90% accuracy distinguishing same-event vs same-topic — ⚠️ unmeasured estimate, see the retraction in D27). Low cost, but fails on cases like "EU AI Act vote" vs "US AI executive order" which embed similarly but are different events.

2. **Full 5-node LangGraph workflow** with a separate ranking node. The ranking node would sort stories by importance — but this is just SQL `ORDER BY article_count DESC, published_date DESC`. An LLM call for ranking is over-engineering.

3. **4-node workflow** (chosen). Drops the ranking node. Each remaining node earns its place:
   - Node 1 (Fetch): DB query, not an LLM call — pulls 48h articles per category
   - Node 2 (Entity Extract): Extracts people/orgs/locations. **Only justified because entities are visible in the UI** as tags on StoryCard
   - Node 3 (LLM Cluster): The core differentiator — LLM-as-judge distinguishes same-event from same-topic (accuracy measured 2026-08-13 at **ARI 0.538**, see D27 — and read the caveat there before quoting it)
   - Node 4 (Synthesize+Store): Unified headline, merged summary, per-source framing analysis with tone

**Cost:** ⚠️ **Corrected 2026-07-30.** This section previously claimed "all prompts batched (one call per category per node, not per article), ~$0.012 per pipeline run, ~$1.73/day, ~$52/month." Both halves were wrong:

- **Not everything is batched.** `sift-api/services/entity_linker_llm.py:390` `link_articles_llm` makes **one realtime call per article**, re-sending a ~6,500-token entity catalog as a cached system block each time. That is the per-article pattern this entry claims to have avoided.
- **Actual spend is ~$10/day (~$300/mo)**, roughly 6x the figure above, on a Sift-dedicated API key.

~~The per-operation breakdown is not yet known: `services/usage_tracker.py:111` `_record_to_ledger` short-circuits unless `ai_cost_guard_enabled` is true, and it defaults to `False` — so the `ai_usage_daily` ledger has never been populated. Attribution is the prerequisite for any cost work.~~

**Attribution landed 2026-08-05, and the cost work it gated landed after it.** Five clean days of `ai_usage_daily` put spend at **$8.99/day**: `entity_linker_llm.link_text` 46.2% ($4.15), `story_synthesizer.synthesize` 26.3%, `story_clusterer.cluster` 17.1%, `summarizer.batch` 10.3%, Voyage 0.02%. Threading (clusterer + synthesizer) was **43.4%** — this entry's own code comment guessed 39%, which was close by luck rather than by method, since nothing had checked it.

The root cause of the linker line was a volume assumption, not pricing: `services/entity_linker_llm.py` documents its economics as "~100 new articles/day" against an actual ingest of ~2,000. Two changes followed, both verified against the ledger rather than asserted — incremental threading (below) and roster narrowing on the linker. Measured per 1,000 articles, all in: **$3.88 → $2.69, roughly $204/mo → $141/mo**. *(Re-read against the ledger 2026-08-20: the realized figure settled at **~$2.29/1k**, better than the $2.69 recorded here. The $2.69 stands as what was measurable when this entry was written.)* Always re-baseline from `sift-api/scripts/verify_cost_baseline.py`, and read the per-1k figure rather than the daily one, which moves with the news.

**Why this matters for a portfolio:** Good judgment > raw complexity. A hiring manager who sees a 5-node workflow where one node is a SQL ORDER BY will question your engineering taste. Four nodes where each earns its place shows you know when to reach for an LLM and when not to.

⚠️ **Superseded 2026-08-10 — this workflow is no longer the live path.** The four nodes were sound; the loop around them was not. Each run cleared `story_id` across a category's window and re-clustered from scratch, and because the window query ends in `LIMIT 50 ORDER BY published_date DESC`, the nominal 48 hours was really about **3.3 hours** in politics and 3.7 in sports — same-event articles filed hours apart never met. Story identity compounded it: an id derived from the sorted member set meant gaining an outlet *replaced* a story rather than updating it, leaving **58,259 of 58,557 rows (99.5%) with no members**.

The replacement, `sift-api/workflows/incremental_threading.py`, consumes a queue instead of rescanning a window: a free pgvector nearest-neighbour query proposes candidates, one `story_confirmer.confirm` call per run decides attach / create / neither, and an id is derived once from the seed and never changes. Synthesis now fires only when a story's *outlet set* changes. Measured after cutover: grouping **4.8% → 35.5%**, `story_clusterer.cluster` to **$0.00**, threading **$2.34 → $1.11 per 1k articles (−52.5%)**, marginal orphan rate **0** — after which 60,020 orphaned rows were safe to prune.

Two things worth keeping rather than tidying away. It shipped dark and cleared a 90-run shadow bar, and its worst defect — new stories hollowed out to zero members by a later decision in the same pass — still appeared in the first minute of live traffic, because a shadow that cannot write cannot find write bugs. And the bar it cleared does not test everything: attach candidates are confirmed at **93%** against **53%** for creates, which looks like rubber-stamping on the one path that mutates existing stories, and all three cutover verdicts would have passed regardless.

---

### D27. Clustering method — LLM-as-judge, not embedding similarity
**Decision:** Use Claude Haiku as a clustering judge rather than vector cosine similarity.

**The problem:** Embedding similarity catches same-topic (~90%) but struggles with same-event. Two articles about "EU AI regulation" embed very similarly even if one is about the EU AI Act vote and the other is about a US executive order. These are the same broad topic but different specific events.

**LLM-as-judge approach:** The prompt explicitly instructs Claude to distinguish same-event from same-topic:
> "same event" means the same specific occurrence -- not just the same broad topic. "EU votes on AI Act" and "US issues AI executive order" are DIFFERENT events.

⚠️ **Accuracy claim retracted 2026-07-30.** This entry previously stated "This achieves ~97% accuracy on event-level clustering," and the ~90% figure for embedding similarity above carries the same caveat. **Both were estimates with no backing eval set.** There was no labeled corpus, no metric, and until 2026-07-30 no test of `services/story_clusterer.py` at all. Neither number should be cited.

~~A real measurement is in progress~~ **Measured 2026-08-13, as this entry promised.** The corpus at `sift-api/data/eval/clustering_corpus.jsonl` (300 articles, 90 carrying an `event_id`) scored by `sift-api/services/cluster_metrics.py` over 15 repeats:

| metric | value |
|---|---:|
| Adjusted Rand Index | **0.538** |
| pairwise F1 | 0.779 |
| multi-outlet precision | 0.607 |

**Against a retracted claim of ~97%, the real number is nowhere near it** — which is the argument for having retracted it rather than defended it. ARI is the headline because it is chance-corrected: an all-singletons prediction, this system's actual failure mode, scores about 0.0 rather than looking respectable. Purity would score that same failure 1.0, so it is deliberately not a gate. `multi_outlet_precision` applies the ≥2-outlet gate to both partitions, i.e. it scores what readers actually see.

⚠️ **The caveat travels with the number.** The corpus labels have never been human-validated: `sift-api/data/eval/review_pairs.csv` holds 40 blind pairs with **zero verdicts filled**, and the corpus records no annotator provenance. So this measures agreement with the labels, not agreement with the truth — an LLM-labeled corpus scored by an LLM judge is measuring family resemblance, and it cannot yet adjudicate a cross-vendor comparison. Cohen's kappa on those 40 pairs is roughly 20 minutes of hand labeling and is what would settle it. Quote the number with this sentence attached or do not quote it.

Run at `--repeats 15` deliberately: n=5 could not estimate a standard deviation (two consecutive 5-run sets differed by more than the tolerance either produced). Clustering at temperature 1.0 is far noisier than the linker's 97.3% self-agreement, so an A/B on it needs many repeats or a large effect.

The enrichment from entity extraction (Node 2) helps in principle — shared people, organizations, and locations are strong signals — but that too is unmeasured.

**Alternative considered:** Two-pass hybrid (embedding pre-filter + LLM refinement). Rejected on the grounds that "the article volume per category (max 50) is small enough that a single LLM call handles it."

⚠️ **That premise turned out to rest on a bug.** The "max 50" is `LIMIT 50` in `sift-api/workflows/story_workflow.py:54`, applied to an already-filtered 48h window. It is not a natural ceiling — in a busy category, articles beyond rank 50 are **never candidates for threading at all**, silently and invisibly in logs. A second, related bug compounded it: `story_clusterer.py` sent up to 50 articles with a fixed `max_tokens=1024`, so an overflowing response truncated to invalid JSON and the category produced **zero stories with no error logged** (fixed 2026-07-30).

The hybrid is therefore being reconsidered — but on **correctness and scale** grounds (it is what makes raising the 50-article cap tractable), not on the cost grounds usually cited for it. Note that clustering here is a *single listwise call per category*, not pairwise, so vector pre-filtering does not eliminate an O(n²) call pattern; splitting a window into many small pools re-pays the fixed prompt per pool and can cost *more*. Embeddings would serve as a candidate **generator**, with the LLM retained as the **decider** — a refinement of this decision, not a reversal of it.

✅ **The hybrid shipped on 2026-08-10, in exactly that shape.** `services/story_matcher.py` generates candidates from pgvector neighbours (`SIMILARITY_THRESHOLD = 0.60`, `TOP_K = 10`) and `services/story_confirmer.py` decides — embeddings as generator, LLM as decider. It went in on the correctness-and-scale grounds this paragraph names, not on cost, and the `LIMIT 50` premise-bug above is what it removes: there is no window to be truncated, because there is no rescan. See the supersession note in D26 for the measured outcome. **This decision is not reversed** — the LLM is still the judge of same-event, which is what D27 is about.

---

### D28. Entity extraction visibility — tags shown on StoryCard
**Decision:** Entity tags (people, organizations, locations) are displayed as pill-shaped tags directly on the StoryCard component.

Entity extraction (Node 2) is only justified if it produces user-visible value. Without the tags, Node 2 would be a hidden intermediate step — technically impressive but invisible to users. Showing the tags:
- Gives users at-a-glance context (who/where/what org is involved)
- Makes the multi-step AI pipeline tangible — users can see the extracted data
- Helps with the LLM clustering step (enriched articles cluster more accurately)

Tags are limited to 6 visible per card with a "+N" overflow indicator.

---

### D29. Story ID stability — SHA256 of sorted article IDs
**Decision:** `story_id = SHA256(sorted_article_ids.join("|"))[:16]`

**Why hashed:** If the same cluster of articles is re-processed, the story ID stays the same. This enables `ON CONFLICT (id) DO UPDATE` for upserts — re-running the pipeline updates existing stories rather than creating duplicates.

**Why sorted:** Article order in a cluster is non-deterministic (LLM output varies). Sorting the article IDs before hashing ensures the same set of articles always produces the same story ID regardless of cluster order.

**Re-clustering handling:** At the start of each synthesis run, all `story_id` assignments for the category are cleared (`SET story_id = NULL`), then re-assigned. This handles cases where articles move between clusters across runs.

---

### D30. Pipeline-time processing, not request-time
**Decision:** Story threading runs as part of the background pipeline, triggered after the store node completes. Users never wait for clustering/synthesis.

**Flow:**
```
Pipeline store_node completes
  -> For each category with new articles:
     -> run_story_threading(category)
        -> Fetch -> Extract -> Cluster -> Synthesize+Store
```

**Why not request-time:** The 4-node workflow takes 5-15 seconds (three Claude Haiku calls). Adding that to a user page load would make the app feel sluggish. By running at pipeline-time, the API route is a pure DB read:
- `GET /api/news?category=top` returns pre-computed `stories[]` alongside standalone `articles[]`
- Frontend merges them into a `FeedItem[]` sorted by date
- StoryCards render inline with ArticleCards — stories surface naturally

**Graceful degradation:** If a category has no multi-source coverage, the API returns an empty `stories[]` array and the UI shows only ArticleCards. No special handling needed.

---

## v1.5 / v2 direction (May 2026 onward)

The next four decisions are added after the v1 production launch. They steer v1.5 (civic-literacy pivot, in flight) and v2 (native clients, planned). Some are settled and net-additive (D31, D34); some are open or actively deferred (D32, D33).

---

### D31. Project state management — STATUS.md + CLAUDE.md per repo, V0–V4 milestone tiers
**Decision:** Adopt per-repo `STATUS.md` (repo root) for active state + `CLAUDE.md` (repo root) for agent orientation. Roadmap tiers labeled `tier-v1` / `tier-v1.5` / `tier-v2` / `tier-v3` / `tier-v4`. Plus a SessionStart hook that auto-loads `STATUS.md` into the agent context.

**Why:**
- High velocity (10+ PRs/week sustained) means context loss between sessions is real. `STATUS.md` is the always-fresh "Active focus / Open question / Next 3 / Blocked-on / Recent decisions" surface.
- Per-repo `CLAUDE.md` codifies the pre-session ritual + end-of-PR doc-impact check. Standardizes what agents do on session start and PR close.
- V1–V4 milestone tiers fit Sift's lifecycle better than OKRs at this stage: v1 shipped, v1.5 civic-literacy pivot in flight, v2 native clients, v3+ speculative.
- SessionStart hook (`.claude/settings.json`) injects `STATUS.md` content into every new session — eliminates "stale context" failures.

**Where it lands:** root-level `STATUS.md` + `CLAUDE.md` in both `sift` and `sift-api`. GitHub Issues stay actionable units; user-level Project ("Kristen Portfolio" — `users/kristenmartino/projects/3`) visualizes status across repos. Labels: `effort-{day,week,weeks}` + `tier-v{1,1.5,2,3,4}`.

**Cost:** $0 — pure docs + hook config.

---

### D32. iOS plan v1 status — under review (parity-shaped scope critique)
**Decision (status: OPEN):** Mark the original iOS app plan as **"under review"** pending revision. Don't start native implementation against the current v1 plan.

**The plan as drafted:** native Swift / SwiftUI, focused reader MVP, single canonical `/v1/*` API in `sift-api`, four iOS-native features (push, widget, share extension, offline cache), 8-week TestFlight timeline. See [`docs/IOS_APP_PLAN.md`](./IOS_APP_PLAN.md) for the full plan as written.

**The critique (cross-functional, 12 voices):** Full text in [`docs/IOS_APP_ASSESSMENT.md`](./IOS_APP_ASSESSMENT.md). Key findings:

1. **Scope is parity-shaped, not MVP-shaped.** Four iOS-native features + a full reader + a new API surface + auth + bookmarks sync in 8 weeks is a parity build with extra steps.
2. **Canonical `/v1/*` API is premature.** "What mature publishers do" is correct in steady state, wrong for pre-PMF (see D33).
3. **KPIs and monetization missing.** Health metrics (crash-free rate, p95 latency) are present; success metrics (D30 retention, push CTR, share-extension WAU) are absent.
4. **Design work isn't started.** No screens, flows, or wireframes referenced — the civic-literacy primer doesn't translate to iPhone-sized progressive disclosure as-is.
5. **Apple Developer enrollment lead time isn't budgeted.** Can take 4–8 weeks for new entities; iOS work would slip silently.
6. **Civic-literacy pivot (v1.5) is in flight.** Shipping iOS now means shipping a snapshot of an in-flight product.

**Direction (still open):** Revise toward either (a) **share-extension-only MVP** (4 weeks, one feature, validates the "what's the actual story?" gesture) or (b) **defer native entirely** until web civic-literacy pivot is shipped (Q3 2026+). Final call dependent on D34 (platform-first call — see [`docs/IOS_VS_ANDROID.md`](./IOS_VS_ANDROID.md)).

---

### D33. Canonical `/v1/*` mobile API in `sift-api` — deferred
**Decision (status: DEFERRED):** Don't build the `/v1/feed`, `/v1/topic`, `/v1/articles/:id`, `/v1/widget/today` endpoints proposed in the iOS plan. Native clients (when built) read from existing Next.js routes; add Edge caching if cold starts hurt.

**Why:**
- "Real companies have one canonical API" is true at maturity, not at pre-PMF. With one client (web) and one API (Next.js routes), building a second API runs two read paths in parallel for months.
- The Next.js routes can be migrated to a canonical surface later, after a second client validates the need.
- Net-new endpoints required for actual *new* functionality in v2: `POST /v1/devices/register`, `POST /v1/share/sift-this`, `GET /v1/widget/today`. Those land in `sift-api` when the native client work begins — not before.

**Reconsider when:** web is being migrated to read from `sift-api` regardless, OR a third client (e.g., Android, watchOS) is in flight. At that point, the dedup math flips and one canonical API surface is worth the migration cost.

**Cost (avoided):** ~2 weeks of net-new Python endpoints that would have been pure rename of existing TypeScript handlers.

---

### D34. github-projects MCP server — installed for Claude Code sessions
**Decision:** Add `.mcp.json` + `.claude/settings.json` enabling the official `github-mcp-server` (HTTP variant at `https://api.githubcopilot.com/mcp/`) as a project-scoped MCP server in both `sift` and `sift-api`.

**Why:**
- The default Claude Code web harness exposes a useful subset of GitHub tools (`mcp__github__*`) — files, issues, PRs, branches, labels — but lacks **Projects v2 mutations** (`addProjectV2ItemById`, `updateProjectV2ItemFieldValue`).
- Future sessions in either repo now have full Projects v2 + broader official tool surface (releases, advanced search, workflow dispatch, etc.).
- Repeats per repo because MCP server configs are repo-scoped via `.mcp.json`.

**Auth:** Bearer token from env var `GITHUB_PROJECTS_TOKEN` (set once in Claude Code web env vars, applies to both repos). PAT scopes: classic `project` (full) + `repo` — *or* fine-grained `Contents/Issues/PRs: Read+write` + `Projects: Read+write` (account-level).

**Cost:** $0 — uses GitHub Copilot API quota (free for personal accounts within reasonable limits).

**Naming:** server named `github-projects` (not `github`) to coexist with the existing harness server without name collision.

---

### D35. Topic-search AI ownership — AI + writes move to `sift-api` (phased)
**Decision (status: SETTLED, May 2026):** Topic-search AI (Claude web-search fallback, Voyage embedding/classification) and the DB writes it performs move into `sift-api`, **phased**. `sift` keeps presentation/SSE streaming and the Postgres *read* (vector search) until the full search API exists. The current `sift/app/api/news/topic/route.ts` is **grandfathered, not the target architecture** — no new AI / search / write work goes in the frontend.

**Why:**
- The route violates the documented split (D2, D7, D30): the Next.js frontend holds both AI keys (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`), calls Claude + Voyage on the request path, and **writes articles to Postgres** (`insertArticle`) — the write path `sift-api` owns.
- **Android v1 + Ask Sift** (sift-api#63, approved v1.5) ship native; a native client can't run Next.js route handlers, so AI-in-the-frontend forces Android to couple to the web deployment or duplicate the logic. A `sift-api` search API serves web *and* Android.
- **Cost ceiling** (sift-api#70) instruments one place instead of the backend pipeline plus two frontend AI routes.
- Moving AI off Vercel shrinks the secret surface and removes the latent Vercel `maxDuration` trap from the AI path.

**Phasing:**
- **Slice 1 — sift-api#79:** `POST /v1/search/fallback` — Claude fallback + embed/classify + article writes move to `sift-api`; the frontend route relays. Removes `ANTHROPIC_API_KEY` + all DB writes from `sift`. Fixes the `published_date: new Date()` freshness bug as part of the move.
- **Slice 2 — sift-api#80:** full `POST /v1/search` (query embedding + vector search) when Android / Ask Sift needs a clean API; frontend becomes a thin SSE relay. Removes `VOYAGE_API_KEY` from `sift`. Gated; likely post-Sprint-2.
- **Not the migration:** the `/api/news/topic` `maxDuration` Vercel-timeout fix (sift#124) is an immediate, independent frontend bug — ship it now.

**Related:** `sift/app/api/topics/generate/route.ts` is a second frontend-AI route (custom-topic generation via Claude) — revisit under this same principle when its slice comes up. `sift-api`'s own README/CLAUDE split wording reconciles when the code moves (Slice 1).

**Reconsider when:** never for "keep AI in the frontend"; the only open variable is the *timing* of Slice 2, gated on native-client work.

**Cost:** $0 to decide. Slices ~1 effort-week each.

---

## v1.5 — content, theme & native batch (May–June 2026)

D36–D45 record ~2 weeks of cross-repo decisions (2026-05-20 through 2026-06-03) that previously lived only in the `sift` / `sift-api` `STATUS.md` files. Two threads run through them: the **native + agentic** architecture calls (D41–D43, settled 2026-05-20) and the **editorial-theme + content/source-quality** work on the web (D36–D40, D44–D45, early June). The STATUS files now point here instead of duplicating these.

---

### D36. App-wide editorial theme — un-scope to a global token layer (not fork)
**Decision (status: SETTLED, June 2026):** Promote the homepage reskin's editorial design tokens out of their `.sift-landing` scope into a single **global semantic token layer** — two full maps (light + warm-dark) under `[data-theme]` — migrate every surface onto it, and delete the legacy stone/indigo palette. One system, one source of truth.

**Changed from:** the Phase-1 homepage reskin (2026-05-31), which deliberately scoped the editorial palette under `.sift-landing` so it wouldn't leak while shipping one page safely. That scoping was right for shipping one page; it's the wrong long-term structure.

**Considered and rejected:**
- **(B) Keep both palettes; migrate only some surfaces.** Leaves Sift permanently two-toned and doubles maintenance.

**How it shipped (sub-phased, with a review gate between each):**
- **2A** — promote tokens to the global layer + build the §3 neutral primitives, then re-point the homepage at the global names with **zero visual change** (pixel-parity verified first). [#144]
- **2B** — the `/news` reader; warm dark (`#15120C`, not pure black) preserved for long reading. [#144]
- **2C** — civic index + dossiers. [#145]
- **2D** — retire **all** legacy stone/indigo tokens (the global layer is now the only source of truth) + migrate methodology / colophon / legal + the shared masthead. [#146]
- **2E** — QA (AA contrast in both themes, neutrality audit, reduced-motion, responsive) — **remaining**.

A Tailwind v3→v4 cascade-layer regression was fixed in the same work: the universal reset `* { margin:0; padding:0 }` was unlayered and, under v4's native cascade layers, beat every layered utility regardless of specificity — silently killing `/news` spacing. Moved into `@layer base`.

**Source:** `SIFT_THEME_MIGRATION.md` §1–§2, §7; sift #144 / #145 / #146; STATUS 2026-06-01.
**Cost:** $0 — design tokens + migration.

---

### D37. Rating treatments are neutral and sourced (the §3 brand rule)
**Decision (status: SETTLED rule, June 2026):** Sift cites AllSides / MBFC verbatim, links the source, and never editorializes about which side is more or less reliable — applied **symmetrically** — and the UI must encode that:
- **Political lean is never hue-coded.** AllSides buckets and party tags (R / D / I) render in neutral ink; lean is shown by **position** (a 5-tick glyph), party by a neutral letter chip. No red/blue.
- **Factual-reporting tier is a neutral fill-level meter**, not green-good / red-bad.
- **Every rating chip cites + links its source** (AllSides / MBFC) with a last-verified date.
- Built as shared primitives — `OutletChip`, `LeanGlyph`, `FactualChip`, `PartyTag` — so the reader, the comparison view, and all dossiers share one neutral, sourced treatment, bound onto clustered-story sources so provenance reads identically on Top Stories and `/news` [#147].

**Considered and rejected** (each re-introduces the good/bad, lean-as-value framing §3 exists to remove):
- **MBFC credibility score** — folds political lean into the number (~30% weight) plus traffic + country; penalizes left/right outlets.
- **MBFC's own bias scale** (Extreme Left → Extreme Right / "Least Biased") and the **"Questionable" flag** (a one-sided negative badge).
- Keep **AllSides** for bias.

**Shipping now (no new data):** plain-language `Bias rating:` / `Factual Reporting:` labels with the source named on hover + link [#147]; a `/methodology` "how we rate sources" section filed.

**Open tail (→ OQ5):** MBFC **country + press-freedom** ratings (RSF / Freedom House) are the §3-clean expansion — environmental, symmetric across the spectrum, cited, most valuable for international sources. "Pursue when prioritized" (likely a paid MBFC license + ToS review); lives on the outlet dossier, **never** folded into a composite score.

**Source:** `SIFT_THEME_MIGRATION.md` §3; STATUS 2026-06-01 (the theme entry + the rating-system question); sift #144 / #147.
**Cost:** $0 to decide.

---

### D38. "Every word is gold" — fix copy at generation, not with a frontend overlap-suppressor
**Decision (status: SETTLED principle; generation gate in flight, June 2026):** Every AI line (summary / "why it matters" / the "What you should know first" primer) and every static string must be **specific, verifiable, neutral, and mission-aligned** — never trite or a headline restatement. Each card element must answer a *different* question or be cut; rendering nothing beats rendering filler.

**The method (empirical, not vibes):** audited 500 live articles, measuring how much `whyItMatters` / `contextPrimer.background` restate vs. add to title + summary (a lexical-novelty proxy). Findings: `whyItMatters` is inconsistent but **not** wholesale-trite (~3/5 land a real stake; ~20% restate; ~17% lean on vague-significance clichés) and fails in **two** directions — restating **and** editorializing; `contextPrimer.background` validated (93% add real context).

**Considered and rejected:**
- **A frontend overlap-suppressor** (a client-side lexical-overlap check that hides near-duplicate lines). Rejected **on the evidence**: lexical overlap can't catch the dominant editorial-fluff failure or paraphrased restatement.

**Instead:** keep `whyItMatters` + `contextPrimer`; **fix quality at generation time** via a two-sided rubric ("must add information not already in the headline/summary; specific, verifiable, neutral; else return null") + an LLM-judge eval → **sift-api#90**.

**Static-copy slice:** dropped the dead `landing.*` block (0 use, superseded by `landingReskin`) [#154]. The same audit surfaced the stale outlet count (→ D39) and outlet-table drift (→ D40).

**Source:** STATUS 2026-06-01 (a) + 2026-06-02; sift #150 (issue) / #154; sift-api #90.
**Cost:** $0 to decide.

---

### D39. Outlet count is derived live ("curated," not "reads from N")
**Decision (status: SETTLED, June 2026):** Replace the hardcoded "~50 outlets" copy (it had drifted into **28 places** while the curated set grew to ~77) with a single **live count** computed from `outlet_profiles` — the same source as the public outlet list — so it can't drift again.

**Truthfulness:** `outlet_profiles` has no active/ingested field, so it proves a **curated** set, not a *read* one — copy says **"curated outlets,"** not "reads from N sources." On a DB miss (`n ≤ 0`) the copy **drops the number** rather than printing "0".

**How:** `lib/outletStats.ts` (pure, client-safe) + a graceful `getOutletStats()` server helper; centralized phrasing in `lib/copy.ts`; landing / `/methodology` / `/colophon` derive from already-fetched data (no new fetches); page metadata reworded count-free. [#155]

**Source:** STATUS 2026-06-02; sift #153 (issue) / #155 (PR).
**Cost:** $0.

---

### D40. Outlet-data integrity — prune drift; the seed CSV is no longer prod's source of truth
**Decision (status: SETTLED cleanup; authoritative seeder OPEN, June 2026):** Treat prod `outlet_profiles` as drift-prone and reconcile it.
- **Cleanup (shipped):** pruned 5 rows that had drifted into prod but were never in the seed CSV (the seeder is upsert-only and never prunes): deduped `bbc` → canonical `bbc-news` and `bloomberg-news` → `bloomberg` (aliases + `articles.entity_links` repointed to the canonical first), and dropped the 3 excluded Yahoo verticals (`yahoo-news` / `-finance` / `-sports`, which contradicted `/methodology`'s aggregator exclusion). 77 → 72, via an idempotent, transactional, dry-run-first script. This makes sift's live outlet count (D39) self-correct on the next ISR revalidate.
- **Process finding (→ sift-api#93):** prod has ~15 legit outlets (al-jazeera, espn, le-monde…) **not** in the seed CSV, and `seed_outlet_profiles.py` is upsert-only, so the CSV is no longer prod's source of truth. An **authoritative seeder** is the foundation for the deliberate source expansion (D44).

**Source:** sift-api STATUS 2026-06-03; sift-api #91 (issue) / #94 (PR) / #93 (follow-up); surfaced by sift #153.
**Cost:** $0.

---

### D41. `sift-mcp` merges into `sift-api` — one service, two transports
**Decision (status: DECIDED, phased — Phase 0 pending; May 2026):** Consolidate `sift-mcp` into `sift-api` as a single Python service exposing **two transports** — REST (HTTP) and MCP (stdio + optional HTTP/SSE) — backed by shared, transport-agnostic handlers. Resolves the standing "should `sift-mcp` merge into `sift-api`?" open question (sift-mcp strategic-Q #2 / sift-api strategic-Q #3) in favor of merging.

**Why:**
- Real (not theoretical) duplication: the web compare path (`app/api/compare/route.ts` → sift-api `/analyze/compare`) and sift-mcp's `compare_outlets` already drift.
- The agentic surfaces (D43) want the tool handlers in one place rather than duplicated or reached via an internal MCP client.
- Merging collapses sift-mcp #4's hosting work into a route mount — no new Railway service, subdomain, env-var set, or DNS.
- Net effort ~7–10 days vs ~2 weeks for the two-service path, plus ongoing duplication-tax savings.

**Phases** (full spec in `sift-api/docs/MERGE_MCP_INTO_API.md`):
- **Phase 0** — merge source via `git subtree` (preserve history), wire the MCP transport mount into FastAPI, add a stdio entrypoint; confirm all 5 tools work via both transports. One PR.
- **Phase 1** — cost-cap primitives in a shared `app/caps.py` (closes sift-mcp #2); both transports benefit.
- **Phase 2** — Bearer auth on the `/mcp` mount + tokens table (supersedes sift-mcp #4), only if external MCP traffic is real.
- **Cleanup** — archive `sift-mcp` with a redirect README (preserves issue history); update Claude Desktop / Code wiring to the new entrypoint.

**Prerequisites:** land sift-api #54 (DMCA audit) before any public MCP transport; a ~30-min spike to confirm the `mcp` Python SDK mounts cleanly as an ASGI sub-app.

**Reconsider when:** MCP traffic ever needs to scale independently of REST (theoretical at current volume) — the handler-module split keeps re-extraction cheap.

**Source:** `sift-api/docs/MERGE_MCP_INTO_API.md`; sift-api #62; STATUS 2026-05-20.
**Cost:** $0 to decide; net ~3–5 days saved on v0.5.

---

### D42. Mobile is REST-only — hosted MCP deferred indefinitely
**Decision (status: SETTLED, May 2026):** Every mobile data/AI feature calls **REST/SSE** on `sift-api`. Even the agentic surfaces (Ask Sift, Refined Compare) run the agent loop **server-side**, with MCP as internal plumbing — there is **no MCP transport on the device**. The hosted HTTP/SSE MCP (sift-mcp #4) is deferred indefinitely.

**Why:** the per-feature protocol worksheet in `sift-api/docs/MOBILE_PROTOCOL_DECISION.md` yields **zero** "MCP (public)" features — pre-computed content → REST; server-side LLM → REST + internal MCP; on-device LLM → the native Anthropic SDK with a tool-handler hitting REST, not an embedded MCP client. Getting this wrong would cost 1–2 weeks of misplaced hosting/auth infrastructure.

**Consequence:** this is *why* D41's public-transport phase (Phase 2) is gated on real external demand rather than on the mobile launch — mobile doesn't need it.

**Source:** `sift-api/docs/MOBILE_PROTOCOL_DECISION.md`; STATUS 2026-05-20; reinforced by sift-api #62 / #63.
**Cost:** $0 (avoids ~1–2 weeks of misplaced infra).

---

### D43. Refined Compare + Ask Sift — agentic surfaces in v1.5 (web + Android)
**Decision (status: SETTLED scope; build in flight; May 2026):** Ship two specialized **server-side agent loops** over the shared 5-tool surface (post-D41):
- **Refined Compare** — `POST /api/compare` with a `lens` parameter (SSE), returning structured per-outlet framings. Same endpoint as the deterministic compare; the backend routes on `lens` presence.
- **Ask Sift** — `POST /api/ask` (SSE), open-ended conversational chat with citations.

Both share tool handlers, the cost-cap pool, the Anthropic SDK pattern, and SSE; they differ in system prompt and output schema.

**Scope call (retiered v1.6 → v1.5, 2026-05-20):** these ship in **Android v1**, not as a v1.1 add-on. Rationale: without Ask Sift, native mobile is a polished reader competing with Apple News / Artifact; **with** it, mobile is a civic-literacy agent on the phone — the wedge that justifies building native at all. Timeline impact ~10 → ~12 weeks.

**Depends on:** D41 (merge — hard prereq, so the loops don't duplicate the 5 tools), D42 (REST/SSE transport). Cost caps: per-turn $0.50 hard / per-user-day $5 signed–$2 anon / global $50/day (alarm at $30); a kill-switch env var disables both agent paths.

**Source:** sift-api #63 (the live spec); STATUS 2026-05-20 (the Refined Compare, Ask Sift, and REST-only entries). *Note: `docs/ASK_SIFT_PLAN.md` / `docs/REFINED_COMPARE_PLAN.md`, referenced from #63 and the STATUS files, are not present on `sift-api` main (tracked: sift-api#96) — issue #63 is the authoritative spec.*
**Cost:** $0 to decide; build ~2 wk backend + ~1 wk web + ~1 wk Android.

---

### D44. Source expansion to ~200 — empirical selection, "curated AND rated"
**Decision (status: DECIDED, in design; June 2026):** Grow the curated outlet set from ~50 → ~200, choosing outlets **data-drivenly** (a reproducible scoring + selection procedure) rather than by hand. The set stays **"curated AND rated,"** not AllSides-scale breadth. (Execution is `sift-api` / data — `outlet_profiles`, `source_name_aliases`, ingestion; tracked at sift#151.)

**Candidate universe:** AllSides + MBFC's already-rated outlets, so every candidate ships with a bias + factual rating.

**Hard gates (deterministic):** an MBFC **factual floor** (exclude Low / Very-Low / Questionable); **resolvable + ingestable** — AllSides + MBFC ratings, a correct `source_name_aliases` entry, and a working feed (per the NYT non-resolution bug, a source with no alias renders cards with no ratings).

**Empirical scoring + selection:** reach / authority (Similarweb traffic), spectrum-balance contribution (move the L/C/R distribution toward symmetric per §3 / D37), category-coverage contribution, international / press-freedom diversity, marginal novelty (de-prioritize pure syndication overlap), and feed reliability — combined by a **greedy set-cover** that maximizes the weighted objective under a spectrum-symmetry constraint until ~200. Validated by re-running a coverage-gap analysis.

**Depends on:** the authoritative seeder (D40 / sift-api#93) as the data foundation; pairs with the civic-impact ranking eval (D45).

**Source:** STATUS 2026-06-01 (b); sift #151.
**Cost:** $0 to decide.

---

**Update 2026-08-18 — the economics were measured, and two of the blockers moved.** No expansion has been executed; the outlet set is still 56, ingested through 59 feeds. What changed is that the cost of doing it is no longer a guess: [`sift-api/docs/SOURCE_SCALING.md`](https://github.com/kristenmartino/sift-api/blob/main/docs/SOURCE_SCALING.md) (2026-08-11) prices expansion from measured per-stage tokens rather than from estimates. **These figures are now conservative:** realized spend settled at ~$2.29/1k by 2026-08-20, below the $2.69 the table is keyed on, so each column overstates.

| expansion | at $2.69/1k (as of 2026-08-18) | at $3.88/1k (pre-narrowing) |
|---|---:|---:|
| +50 outlets | $173–224/mo | $197/mo |
| +100 outlets | $212–324/mo | $252–322/mo |
| +1000 outlets | $1,000–2,971/mo | $1,384–3,747/mo |

That doc named two changes that should precede any expansion, and **both have since shipped**: make the entity linker cheaper — by roster narrowing, explicitly *not* by batching, which was built and rejected on recall — and rank on **distinct outlets** rather than article rows. Roster narrowing alone **paid for roughly the first 50 outlets**: +50 now costs less per month than the status quo did before it landed.

So the shape of this decision has changed. It was gated on cost and on the seeder; it is now gated on the seeder alone (D40 / sift-api#93), with one ceiling likely to bind before economics do — `MAX_ENTRIES_PER_FEED`, which caps what each feed contributes regardless of how many feeds there are. Threading queue load is the other constraint worth watching: +1000 outlets models at 227% of it.

---

### D45. Rank by civic impact — including reader accessibility (paywall) — not coverage volume
**Decision (status: DECIDED, in design; June 2026):** Rank the feed by **civic impact**, not by coverage volume (which would magnify mainstream bias — the trap raw clicks fall into). Evaluate empirically rather than by gut:
- a **human importance gold-set** (rank ↔ importance correlation + a high-importance / low-volume "burial" rate),
- **depth-engagement** signals (compare / dossier / bookmark opens — **not** raw clicks),
- a **Sift-native impact proxy** (stories tied to a bill / policy / dossier).

**Reader accessibility / paywall signal (added 2026-06-03):** include whether a story's sources are **freely reachable** as a ranking input — when a high-impact story is available from a non-paywalled source, prefer surfacing that source so readers can actually reach the reporting instead of hitting a paywall at every turn. This needs a per-outlet **access field** (e.g. free / metered / hard paywall), which does not exist today — capture it alongside the outlet-schema / authoritative-seeder work (D40 / sift-api#93). Tracked at sift#160. It also answers the previously-noted "paywalled outlets in the feed" open question from the iOS plan.

**Pairs with:** D44 (both want a labeled / measured baseline) and D37 (accessibility and neutrality are both "serve the reader" signals, not editorial value judgments).

**Source:** STATUS 2026-06-01 (d); the accessibility / paywall extension is a 2026-06-03 decision recorded here.
**Cost:** $0 to decide.

---

⚠️ **Status correction 2026-08-18 — this shipped, and the entry still said "in design."** Ranking v2 was implemented in seven stages on 2026-08-10/11 and registered as **D48–D52**, but nothing connected those back here, so the parent decision read as unbuilt for a week while its own implementation sat four rows above it in the index.

The feed is now ranked on seven factors multiplying one core, all in `sift/lib/db.ts` with the evidence for each constant in the comment above it — see [`RANKING_SIGNALS.md`](./RANKING_SIGNALS.md). Coverage volume is *not* one of them, which is what this decision asked for: corroboration enters only through a saturating `ln` on **distinct outlets**, multiplied by member importance, so wire pickup cannot outrank consequence.

**Of the three empirical asks above, one shipped, one shipped in a different form, one did not:**

| asked for | state |
|---|---|
| Sift-native impact proxy (stories tied to a bill / policy / dossier) | **built** — the civic-density boost, weighting bill and politician links 1.0 and org 0.5, capped at +30% |
| human importance gold-set | **partly** — `sift-api/scripts/eval_ranking_pairs.py` scores blind hand-labeled *pairs*, which is a preference test rather than the rank↔importance correlation named here. **Burial rate is still not measured.** |
| depth-engagement signals (compare / dossier / bookmark opens) | **not built.** No engagement signal feeds ranking. |

**The eval found something the decision did not anticipate.** Against 22 blind pairs, the current formula agrees with the labeler 14/22 (64%) against pre-v2's 10/22 — but on the 9 *control* pairs, where all three formulas agree, all three scored 4/9, **below chance**. Nothing shipped that day touched `importance × decay`, so the first evidence to come out of this decision's own validation harness is that the shared core it was built on top of is the weak part. Worth stating plainly, because this entry's premise is that ranking should be evaluated empirically rather than by gut, and the first empirical result was unflattering.

**The paywall half is still unbuilt and that is deliberate** — it needs a curated `outlet_profiles.paywall` field that does not exist, which is cheap once curated and pointless before. Still tracked at sift#160, still gated on the authoritative seeder (D40 / sift-api#93).

---

### D47. Q8 closed — global civic content, entered through treaties rather than people

**Decided 2026-08-05.** `OPERATING_CONTEXT.md` §6 had held Q8 open to week 12 with the note that US-only "makes the dossier moat deeper and the compliance surface smaller". Both halves of that are still true. The decision is to accept the wider surface.

**What decided the entry point was evidence, not preference.** The same day, an attempt to source all 46 `foreign-executive` politician rows returned **13**. The other 33 failed for reasons that do not yield to effort: 6 official sites return hard 403s to any non-browser client, 3 render their content in JS, and the formers have no official archive at all — an office page names the incumbent, so publishing a former head of government from one would assert they still hold it.

Worse, the 13 that *did* verify **decay**. Their only evidence of incumbency is a page that names them today. `gov.uk` records that Keir Starmer was Prime Minister "from 5 July 2024 to 20 July 2026" — he had left office three weeks before Sift's own prose was corrected, and nothing detected it. Migration 017 now expires those rows after 90 days, which bounds the risk but does not remove it.

**Intergovernmental organizations invert every one of those properties.** A founding treaty is a fixed document at a stable URL: the UN Charter will say the same thing in ten years. Nothing decays, so no expiry is needed. And an IGO is an institution rather than a living person, which keeps §5's sharpest constraint — no claim about a living person without a citation to the primary record — largely out of scope.

They also cost almost nothing to add. `org_profiles` already carries `governance_structure` + `governance_source`, the sitemap's org rule is type-independent, and `/civic` groups by type — so a new `igo` value in `OrgType` is the whole frontend change. `/agencies` deliberately keeps filtering `type = 'agency'`: the UN is not a federal agency and must not be labelled one.

**First tranche: 7 rows** — UN, NATO, IMF, WHO, WTO, European Commission, ILO. Each `governance_structure` is a paraphrase in the register the 93 agency rows already use, backed by phrases quoted from the treaty that `scripts/verify_igo_sources.py` requires on the cited page. 25 phrases checked, 0 failures — but only after the check rejected four first attempts: the WHO claim overreached a landing page that is not the constitution's full text, the TEU says "completely independent" rather than "complete independence", the ILO URL 404'd, and the IAEA statute is reachable only as a PDF and was **dropped rather than cited unverified**.

**What this does not decide.** Not global *news sources* — AllSides and MBFC rate US outlets almost exclusively, so the ratings layer that makes `/outlet` pages work has no equivalent, and that remains gated on Q4. Not the 33 withheld politician rows, which stay open as `sift-api`#166. And it does not lower the sourcing bar: the reason IGOs went first is precisely that they clear the existing bar without one.

### D46. Android v1 paused; the launch is re-planned around evidence, not features

> **Amended 2026-08-05 — the feature-work pause is lifted.** The three parts of D46 are separable and only one is withdrawn.
>
> **Still in force:** Android v1 stays paused; the ~10-hour week-one test is still the next action and is still unrun; the 6 hrs/week budget re-baseline stands.
>
> **Withdrawn:** the blanket prohibition on feature work. It did what it was built for — it stopped a fourth quarter of building against zero validated demand and it forced the launch memo — but it had begun to read as a bar on work that was *fixing correctness*, not adding surface. The 2026-08-05 dossier-sourcing work (migrations 015/016: 111 rows of uncited claims about living people removed, 67 dossiers published behind a sourcing gate) was required by `OPERATING_CONTEXT.md` §5 regardless of what any evidence test returns, and could not honestly be classified as "building".
>
> The replacement rule is a judgement rather than a prohibition: **work that makes an existing claim defensible is not gated on the evidence test; work that adds a new surface still is.** The "Deliberately not next" list in `STATUS.md` is unchanged.

**Context.** `docs/GROWTH_STRATEGY.md` (2026-07-27) proposed a 90-day plan to take Sift from "launched, not adopted" to an asset with revenue. It was run through the six role agents in `.claude/agents/` as an independent panel, then the reconciled result was run through `red-team`. Full record — including where the roles disagreed and how it was resolved — in [`LAUNCH_DECISION_MEMO.md`](./LAUNCH_DECISION_MEMO.md).

**Decision (status: SETTLED; July 2026):**

1. **Android v1 is paused for 90 days.** `GROWTH_STRATEGY.md` §9 supersedes the previous committed Next-3 in `STATUS.md`. `sift-android` reached Phase 2 (nav host, feed, article detail, Custom Tabs); that work is preserved, not deleted. Twelve weeks of build against zero validated demand was the largest resource question on the board. The buyer's read: a Phase-2 Android repo with zero users was never a transferable asset, so the pause is costless on the sale ledger. The **interview** cost is real, and is recovered only if the user conversations actually happen — without them the pause reads as abandonment; with them, as judgment.

2. **The feature roadmap is replaced by a ~10-hour week-one evidence test.** Publish the 25 org dossiers as one static page; send it to ~40 librarians and ~20 policy staffers with one question; count replies. It tests Q1, Q2, and Q3 simultaneously, and it carries no Art. 50(4) exposure, no ratings-licensing dependency, no signup wall, and no news-avoidance problem — the org dossiers are reference, not news.

3. **The time budget is re-baselined to 6 hrs/week.** The prior plans assumed 10–15. Observed velocity over the preceding six weeks was **zero commits in both repos** (last commit 2026-06-17), while `STATUS.md` advertised "High (10+ PRs / week)." Cut by name: Bluesky, the domain migration (deferred, with a recorded dissent from the acquirer view — buy the name now, migrate when there is evidence), the dossier SEO pass, and Show HN.

**Why this is a decision and not a plan.** The test any future proposal must pass: *does it add a row to the asset the strategy says is being sold?* The superseded 12-week sequence added none. Verified dataset composition at the time of this decision — `interest_group_ratings` empty on all 536 politician rows, PAC figures from the 2022 cycle (OpenSecrets API discontinued Apr 2025), 25 orgs against migration 007's planned ~200, one bill, no refresh job.

**Pairs with:** D32 (iOS under review — now moot for the same reason), D44 (source expansion — also paused; it is building, not evidence).

**Source:** `LAUNCH_DECISION_MEMO.md` §4, §6, §7 (2026-07-27).
**Cost:** $0 to decide.

---

### D54. The Neon compute is allowed to sleep

**Decided 2026-08-14.** Neon's compute scales to zero after 300s without a query. Sift's never had — measured `pg_postmaster_start_time()`: **26 days of unbroken uptime**.

**The console needed no changes, and that is the strongest evidence in this entry.** Checked the same day: autoscale was already `.25 ↔ 2 CU`, **scale-to-zero was already enabled** at 5 minutes, history retention 6 hours, one branch and one endpoint. With suspension enabled and the compute still up for 26 days unbroken, a query must have arrived inside every single 5-minute window. Nothing else explains it.

**On the money.** Launch bills compute **from the first hour** — there is no included-CU-hour allowance, so savings are linear rather than a cliff to get under. Aug 1–14: **312.8 CU-h → $33.08** org-wide (~$0.106/CU-h) against $0.38 of storage. And the CU-hours are **shared across all four projects in the org**, where `sift` (139 CU-h) was not even the largest — `cratedigger` was (~161). A sibling project, `tenancy`, sits Idle at ~$3/month on the same plan, which is what `sift` should look like.

Of sift's 10.0 CU-h/day, **6.0 is the 0.25 CU floor running 24 hours** and 4.0 is real pipeline work — so this buys back roughly $15/month, not the $45 first estimated off a misremembered pricing model.

**The diagnosis was wrong the first time, in the direction that feels right.** The obvious suspect was `asyncpg.create_pool(min_size=2)` in `sift-api/app/db.py` — a pool that "pins connections open" so the compute can't idle out. Both halves of that are false. asyncpg's `min_size` is only the number of connections opened at init; `_minsize` is read in `Pool._initialize` and a getter and nowhere else, and `_deactivate_inactive_connection` terminates idle connections with no `min_size` check. And Neon suspends on absence of *queries*, not connections. The pool was never the problem.

**The actual cause was one timer.** `services/batch_poller.py` looped every 60 seconds unconditionally, and `poll_pending_batches` *opened* with a `SELECT` against `api_batches` before checking whether there was anything to do — 1,440 queries a day, each landing inside the 300s window and resetting it. `/health` added two more every 30 minutes, from a GitHub Actions heartbeat that exists because Vercel Cron on Hobby is capped at once/day.

Both were asking Postgres a question the process already knew the answer to. Every batch submitter runs in the same process as the poller, so the in-flight set is in-memory; the pipeline is the sole writer of `pipeline_state.last_refreshed_at`, so the last-run timestamp is too. Both now read from memory, with a single DB read at startup for crash recovery.

**What is accepted:** the first request after an idle period pays a Neon cold start. `sift-api/STATUS.md` records a 2,374 ms feed-query regression where cold heap reads dominated, so this is not free. It is acceptable because there is no traffic to feel it (`search_queries`: 0 rows in 8 days) — and because the alternative was paying for an idle database around the clock. **Revisit when traffic is real**: the fallback is the autoscale floor, not re-pinning the compute.

**Storage is explicitly not the lever here.** 2.11 GB at $0.35/GB-month is **$0.38/month** — 1% of the bill. `sift-api/docs/NEON_RETENTION.md` is a careful piece of work about a bill that storage was not driving; reclaiming a full gigabyte would save 35 cents.

**The generalizable finding:** the whole class of defect is "a background loop that asks a question it could have remembered". It is invisible in every dimension a normal review looks at — no error, no latency, no failing test, no user impact — and shows up only on an invoice nobody re-derives. Hence `sift-api/scripts/verify_neon_idle.py`, in the shape of `verify_cost_baseline.py`: the fix for a stale number is not a better number, it is making re-derivation a one-liner.

**Pairs with:** D18 (which claimed auto-suspend as a reason to choose Neon, and was never verified).
**Cost:** −~$45/mo overage; target is a flat $19.

---

## Open questions (May 2026)

Tracked here so they don't get lost between session restarts. Promoted to settled decisions when resolved.

| # | Question | Where to decide |
|---|----------|-----------------|
| OQ1 | Native platform first — iOS vs Android vs PWA-only? | Lean: Android-first while iOS enrollment processes. See [`docs/IOS_VS_ANDROID.md`](./IOS_VS_ANDROID.md). |
| OQ2 | DMCA fair-use posture for AI summarization on Railway | Audit + methodology update in flight (sift-api#54) |
| OQ3 | Monetization — when, what, and at what tier | Not until v1.5 KPIs validate D30 ≥ 20% |
| OQ4 | Cross-platform vs native-per-platform if both ship | Decide after platform-first is settled |
| OQ5 | Outlet ratings beyond AllSides bias + MBFC factual — how far? | MBFC country + press-freedom (RSF / Freedom House) is the §3-clean next step; pursue when prioritized (paid license + ToS). See D37. |


---

### D61. The living-persons rule binds generated prose, not just dossiers
**Decision (status: SETTLED, Aug 2026; the measurement half OPEN):** `OPERATING_CONTEXT.md` §5's living-persons constraint covers **every surface where Sift generates prose about a named living person** — summaries, primers, context and synthesis — not only the dossier layer its text used to name.

**The gap was between the doc and the code, and the code was right.** [`LAUNCH_DECISION_MEMO.md`](./LAUNCH_DECISION_MEMO.md) §2.2(b) read the actual prompts on 2026-07-27 and inverted [`GROWTH_STRATEGY.md`](./GROWTH_STRATEGY.md) §4(d)'s ranking: the dossier tables are hand-seeded, sparse, and mostly render database fields, whereas the summarizer emits unreviewed sentences about real people across 59 feeds every 30 minutes. Its item B2 put the constraint block into `summarizer`, `story_synthesizer` and `context_generator` that same week, and `sift-api/tests/test_generation_constraints.py` has asserted its presence in all three since. **§5's own text was never updated to match**, so for three weeks the sharper of the two risks was the one the non-negotiable did not mention.

**What is now measured, and what is not** (sift-api [#243](https://github.com/kristenmartino/sift-api/issues/243) / [#264](https://github.com/kristenmartino/sift-api/pull/264)):
- **Escalation — clean.** Across 38 production summaries carrying a legal matter, **zero** turn a charge into guilt. The instrument is calibrated at **12/12** on that exact failure, unanimously, so the zero means something.
- **Deletion — unmeasured, and it is the likelier failure.** A summary that drops the source's "alleged" is invisible to the three-axis judge: **0/5**, unanimous, and 0/6 under all three readings of the `legal_safe` axis. A narrower per-claim question reaches 3/5 with 0/38 false positives and **refuses to report a rate** until `sift-api/data/eval/legal_review.csv` is adjudicated by hand.

**Why the second bullet is in a decision log at all.** #240 made `parse_feed` read `content:encoded`, which was a clear quality win and simultaneously raised how often the summarizer makes concrete claims about named individuals. The rules governing those claims did not change when their frequency did. Recording "we checked and found nothing" without recording "and we could not check the other half" would reproduce the retracted 0.288 — a confident number from an instrument nobody had shown could fail. See D59.

**Considered and rejected:** rewriting `_build_prompt` to require verbatim hedge carry-through, which would make compliance mechanically checkable. Deferred to sift-api#265 rather than done, because it changes what Sift publishes in order to mitigate a risk that has not yet been shown to occur, and the ~20 minutes of labelling that would settle that has not been spent.

**Source:** `sift-api` #243 / #264 / #265; `LAUNCH_DECISION_MEMO.md` §2.2(b), B2; `GROWTH_STRATEGY.md` §4(d), corrected in the same change.
**Cost:** $0 to decide.

### D62. Dossiers are prebuilt, and middleware runs only where a session is read
**Decision (status: SETTLED, Aug 2026):** the ~650 sitemap-advertised dossier URLs are prerendered at deploy time via `generateStaticParams`, their ISR TTLs are sized to the crawl interval rather than to the content, and `clerkMiddleware()` matches only the seven paths that actually read a session.

**What prompted it.** Vercel warned that the free Hobby team had used **75% of its 4-hour Fluid Active CPU allowance**. A 24h sample of the project's runtime logs on 2026-08-25 found **822 middleware invocations and 816 function invocations**, all HTTP 200, against **10 cache entries** — near-total `cache=MISS`. By route: 641 `/politician/[bioguide]`, 111 `/org/[slug]`, 23 `/bill/[id]`, spread across **783 distinct paths at roughly one hit each**. That is a crawler walking the sitemap, which is the traffic the sitemap was built to attract.

**Why ISR was already there and already losing.** Every dossier route carried `revalidate = 1800`, sized honestly to its content. The access pattern defeated it three ways, and only the third is obvious in hindsight:
1. **Nothing was prebuilt.** No route had `generateStaticParams`, so all ~650 URLs were generated on demand.
2. **Each URL is its own cache entry.** A 30-minute TTL only pays off when the *same* path is hit twice inside the window; a crawl that visits each URL once per sweep finds every entry cold.
3. **Middleware is billed whether or not the page cache hits.** The old negative matcher (`everything that is not a static asset`) ran Clerk on all ~650 dossier pages, none of which read a session. Middleware ≈ function in the counts above because *both* ran on nearly every request — so half the bill sat where no amount of caching could reach it.

**The floor is reused, not re-expressed.** `generateStaticParams` derives from `listSitemapEntries` via `listDossierParams` rather than querying directly. The publish floor already has exactly two implementations under a "change one, change the other" invariant; a third would make that a trio. This also aligns two questions that should agree: the URLs advertised to crawlers are exactly the URLs prebuilt for them. `dynamicParams` is left at its default, so a sub-floor dossier still renders on demand — it just is not prebuilt.

**Considered and rejected: blocking the crawlers.** A firewall rule or `crawlDelay` would have cut the same traffic in an afternoon. The sitemap exists deliberately (`GROWTH_STRATEGY.md`); the crawl is the growth plan working. Prerendering keeps the indexing and stops paying SSR for it.

**What is measured and what is inferred.** The traffic counts are measured. **Per-project CPU attribution is inferred, not read** — no API exposes the usage meter, so the dashboard Usage page is the instrument that would confirm it. Vercel Hobby runtime-log retention is ~1 day (verified: a 7-day query returned 821/815 against the 24h 822/816, the same rows), so "the other 15 projects were idle" is a claim about 24 hours, not about the billing cycle.

**Cost:** $0. Prevents the Hobby overage that would otherwise pause every project on the team.
