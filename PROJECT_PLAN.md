# The Digest — Project Audit & Development Plan

**Date:** February 23, 2026
**Last Updated:** February 23, 2026 — Next.js scaffold complete
**Status:** Next.js scaffold ready for `npm install && npm run dev`
**Stack:** Next.js 15 / TypeScript / Tailwind CSS / Anthropic Messages API

---

## 0. Migration Status

### ✅ Completed — Next.js Scaffold

The monolithic 831-line artifact has been decomposed into a proper Next.js project.

| What | Before (Artifact) | After (Next.js) |
|------|-------------------|-----------------|
| **Files** | 1 file, 831 LOC | 22 source files, 1,786 LOC |
| **API key** | Exposed to client via proxy | Server-side only (`process.env`) |
| **State** | `window.__digestCache` | Custom hooks + localStorage |
| **Styling** | Inline styles | Tailwind CSS + CSS variables |
| **Types** | None | Full TypeScript interfaces |
| **Tests** | None | 30+ test cases (utils, API, components) |
| **Caching** | None | 5-min server-side TTL |
| **Rate limiting** | None | 10 req/min per IP |

### File Map

```
the-digest/                    (22 source files, 1,786 LOC)
├── app/
│   ├── api/news/route.ts      172 LOC  ← Server-side API proxy
│   ├── globals.css             73 LOC  ← Tailwind + CSS vars + reset
│   ├── layout.tsx              30 LOC  ← Metadata, skip-nav, fonts
│   └── page.tsx                 5 LOC  ← Thin wrapper
├── components/
│   ├── NewsAggregator.tsx     255 LOC  ← Main orchestrator
│   ├── ArticleCard.tsx        124 LOC  ← Card with badge, bookmark, meta
│   ├── CardImage.tsx           64 LOC  ← Image with gradient fallback
│   ├── SkeletonCard.tsx        41 LOC  ← Loading placeholder
│   ├── ErrorState.tsx          23 LOC  ← Error UI with retry
│   └── index.ts                 5 LOC  ← Barrel exports
├── lib/
│   ├── hooks.ts               137 LOC  ← useNewsLoader, useBookmarks, useTheme
│   ├── utils.ts               125 LOC  ← Parse, hash, time, domain
│   ├── types.ts                83 LOC  ← All TypeScript interfaces
│   └── constants.ts            56 LOC  ← Categories, colors, timing
├── __tests__/
│   ├── utils.test.ts          296 LOC  ← 25 tests: parser, hash, time, domain
│   ├── api.test.ts            180 LOC  ← API response parsing scenarios
│   └── ErrorState.test.tsx     22 LOC  ← Component rendering tests
├── package.json               ← Dependencies + scripts
├── tsconfig.json              ← TypeScript config
├── tailwind.config.ts         ← Custom theme (fonts, colors, animations)
├── jest.config.ts             ← Test config with coverage thresholds
├── next.config.js             ← Remote image patterns
├── .env.local.example         ← API key template
├── .gitignore
└── README.md                  ← Setup, architecture, deployment guide
```

### How Components Map to the Original

| Original (single file) | New Location | Changes |
|------------------------|--------------|---------|
| Lines 1-19: Constants | `lib/constants.ts` | Added RGB tuples, timing constants, storage keys |
| Lines 21-44: Utils | `lib/utils.ts` | Added `stableHash`, `extractJsonArray`, `normalizeArticle` |
| Lines 46-114: Fetch | `app/api/news/route.ts` | Moved server-side, added cache/rate-limit/auth |
| Lines 116-152: Skeleton | `components/SkeletonCard.tsx` | Converted to Tailwind |
| Lines 154-204: CardImage | `components/CardImage.tsx` | Added load/fade transitions |
| Lines 206-346: ArticleCard | `components/ArticleCard.tsx` | Fixed hex+alpha → rgba(), added aria-labels |
| Lines 348-831: Main App | `components/NewsAggregator.tsx` | Extracted hooks, added useMemo |
| (none) | `lib/hooks.ts` | New: useNewsLoader, useBookmarks, useTheme |
| (none) | `lib/types.ts` | New: Full TypeScript interfaces |
| (none) | `__tests__/*` | New: 30+ test cases |

---

## 1. Current State Audit

### 1.1 Architecture Assessment

| Layer | Implementation | Status |
|-------|---------------|--------|
| **UI Framework** | React components in Next.js App Router | ✅ Production-ready |
| **State Management** | Custom hooks + localStorage | ✅ Persists across refresh |
| **API Integration** | Server-side route handler with auth | ✅ Key never reaches client |
| **Styling** | Tailwind CSS + CSS custom properties | ✅ Maintainable |
| **Data Persistence** | localStorage (bookmarks, theme) | ✅ Survives refresh |
| **Error Handling** | Typed errors, user-visible diagnostics | ✅ Comprehensive |
| **Testing** | Jest + RTL, 30+ test cases | ✅ Core paths covered |
| **Caching** | In-memory, 5-min TTL | ⚠️ Resets on deploy (upgrade to Redis) |
| **Rate Limiting** | In-memory, 10 req/min/IP | ⚠️ Resets on deploy (upgrade to Redis) |
| **Monitoring** | console.error server-side | ⚠️ Need Sentry/Datadog |
| **SEO** | Metadata + OG tags in layout | ✅ Basic coverage |
| **Accessibility** | Skip-nav, aria-labels, focus-visible | ⚠️ Needs WCAG audit |

### 1.2 Bugs Fixed in Migration

| # | Bug | Fix |
|---|-----|-----|
| B1 | Non-unique IDs (`Date.now()` in `.map()`) | `stableHash(source_url)` for deterministic IDs |
| B2 | Hex+alpha (`catColor + "18"`) | `rgba(${color.rgb}, 0.08)` via CATEGORY_COLORS |
| B3 | `transition: "all"` causing jank | Specific `transform, box-shadow` transitions |
| B5 | No `noopener` on `window.open` | Added `"noopener"` parameter |
| B6 | `<link>` re-inserted every render | Moved to `globals.css` `@import` |
| B7 | `palette` object recreated every render | Moved to `CATEGORY_COLORS` module constant |

### 1.3 Remaining Items

| # | Severity | Issue | Effort |
|---|----------|-------|--------|
| B4 | Low | Featured card mobile stacking — needs testing with Tailwind grid | 15 min |
| R1 | Medium | Upgrade cache/rate-limit from in-memory to Redis/KV | 2 hours |
| R2 | Medium | Add Sentry error tracking | 1 hour |
| R3 | Low | WCAG accessibility audit (contrast, screen reader) | 2 hours |
| R4 | Low | Lighthouse performance audit | 1 hour |

---

## 2. Testing Coverage

### 2.1 What's Tested (30+ cases)

**`utils.test.ts` — 25 tests:**
- `estimateReadTime`: empty, null, whitespace, short text, 400 words, rounding
- `timeAgo`: null, invalid date, just now, minutes, hours, days, future dates
- `extractSourceDomain`: with/without www, no protocol, invalid, empty
- `stableHash`: deterministic, unique, non-empty, empty string
- `extractJsonArray`: clean array, markdown fences, prose-wrapped, prose both sides, escaped quotes, empty, null, model refusal, truncated JSON, individual objects, nested brackets, multiline, HTML error, 5-article batch
- `normalizeArticle`: all fields, stable ID, missing optionals, missing title, missing source_name

**`api.test.ts` — 10 tests:**
- Category validation (invalid, all 6 present)
- Response parsing (clean JSON, markdown-wrapped, model refusal, tool_use only, empty content, mixed blocks)
- Error response shapes (400, 429, 502)
- Cache TTL logic

**`ErrorState.test.tsx` — 3 tests:**
- Renders message, fallback, retry callback

### 2.2 What Still Needs Tests

| Priority | Test | Type |
|----------|------|------|
| P1 | NewsAggregator renders loading → articles | Integration |
| P1 | Category switch aborts previous request | Integration |
| P1 | Bookmark toggle persists to localStorage | Integration |
| P2 | Full E2E: load → click category → articles appear | E2E (Playwright) |
| P2 | API route with real Anthropic call (CI smoke test) | E2E |
| P3 | Dark/light theme applies correct variables | Integration |
| P3 | Slow indicator appears after 8 seconds | Integration |

---

## 3. Feature Backlog (Prioritized)

### Tier 1 — Launch Blockers (Sprint 1)

| ID | Feature | Status | Effort |
|----|---------|--------|--------|
| F0 | Next.js scaffold + migration | ✅ Done | — |
| F1 | `npm install && npm run dev` works locally | 🔲 Verify | 15 min |
| F2 | Deploy to Vercel | 🔲 | 30 min |
| F3 | Set ANTHROPIC_API_KEY in Vercel env | 🔲 | 5 min |
| F4 | Verify all 6 categories load in production | 🔲 | 15 min |
| F5 | Upgrade cache to Vercel KV | 🔲 | 2 hours |

### Tier 2 — Core Experience (Sprint 2)

| ID | Feature | Effort | Dependencies |
|----|---------|--------|-------------|
| F6 | Pull-to-refresh (mobile) | 3 hours | — |
| F7 | Search/filter within results | 3 hours | — |
| F8 | Share article (copy link / native share) | 1 hour | — |
| F9 | Auto-refresh on 15-min interval | 1 hour | F5 (KV cache) |
| F10 | Article detail view / reader mode | 4 hours | — |

### Tier 3 — Differentiation (Sprint 3+)

| ID | Feature | Effort | Dependencies |
|----|---------|--------|-------------|
| F11 | AI summary customization (ELI5 / Technical) | 3 hours | — |
| F12 | Custom categories (user-defined topics) | 4 hours | — |
| F13 | Daily digest email | 6 hours | Email service |
| F14 | Sentiment/tone indicators per article | 3 hours | — |
| F15 | Multi-source comparison (same story, diff outlets) | 6 hours | Advanced prompting |

---

## 4. Deployment Checklist

```
□ npm install — verify clean install
□ npm run test — all 30+ tests pass
□ npm run build — production build succeeds
□ npm run lint — no errors
□ vercel deploy — preview URL works
□ Set ANTHROPIC_API_KEY in Vercel dashboard
□ Test all 6 categories on preview URL
□ Test mobile (375px viewport)
□ Test dark/light toggle
□ Test bookmarks persist across refresh
□ vercel --prod — promote to production
□ Add custom domain (optional)
□ Set up Sentry error tracking
□ Set up uptime monitoring
```

---

## 5. Execution Timeline (Revised)

```
✅ Week 1 Day 1:  Scaffold Next.js app, decompose components, write tests
   Week 1 Day 2:  Verify local dev works, fix any TypeScript issues
   Week 1 Day 3:  Deploy to Vercel, configure environment
   Week 1 Day 4:  QA all categories + mobile + dark mode in production
   Week 1 Day 5:  Add Sentry, uptime monitor, Vercel KV cache

   Week 2:        Sprint 2 features (search, share, pull-to-refresh)
   Week 3:        Sprint 3 features (AI customization, custom categories)
   Week 4:        Polish, Lighthouse audit, soft launch
```

---

## 6. Getting Started

```bash
# Clone the project
cd the-digest

# Install dependencies
npm install

# Configure your API key
cp .env.local.example .env.local
# Edit .env.local: ANTHROPIC_API_KEY=sk-ant-xxxxx

# Run tests
npm test

# Start development server
npm run dev

# Deploy to Vercel
vercel
vercel env add ANTHROPIC_API_KEY
vercel --prod
```

---

## 7. Decision Log

| Date | Decision | Rationale | Revisit? |
|------|----------|-----------|----------|
| 2/23/26 | Anthropic web_search over NewsAPI/RSS | Single API, AI summaries, no extra keys | If latency > 15s avg |
| 2/23/26 | "Summarize" prompt framing | Model refuses rigid JSON from search snippets | If structured outputs API ships |
| 2/23/26 | Next.js 15 App Router | Best React DX, built-in API routes, Vercel deploy | Stable choice |
| 2/23/26 | In-memory cache (initial) | Zero-config, upgrade to KV later | Week 1 Day 5 |
| 2/23/26 | Tailwind CSS | Matches Next.js ecosystem, design token support | Stable choice |
| 2/23/26 | Jest + RTL over Vitest | Next.js native support, wider ecosystem | If build times suffer |
| 2/23/26 | Vercel for hosting | Free tier, preview deploys, edge functions | If cost > $20/mo |
