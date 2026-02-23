# The Digest

News aggregator powered by NewsAPI.org. Surfaces the top stories across 6 categories with fast, reliable article fetching.

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo-url>
cd the-digest
npm install

# 2. Configure API keys
cp .env.local.example .env.local
# Edit .env.local and add your NewsAPI key (required)
# Get one free at https://newsapi.org/

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
the-digest/
├── app/
│   ├── api/news/route.ts    # Server-side API proxy (→ NewsAPI)
│   ├── globals.css           # Tailwind + CSS variables
│   ├── layout.tsx            # Root layout, metadata, skip-nav
│   └── page.tsx              # Home page
├── components/
│   ├── NewsAggregator.tsx    # Main orchestrator (state, layout)
│   ├── ArticleCard.tsx       # Individual article display
│   ├── CardImage.tsx         # Image with gradient fallback
│   ├── ErrorState.tsx        # Error UI with retry
│   └── SkeletonCard.tsx      # Loading placeholder
├── lib/
│   ├── constants.ts          # Categories, colors, timing, storage keys
│   ├── hooks.ts              # useNewsLoader, useBookmarks, useTheme
│   ├── types.ts              # TypeScript interfaces (single source of truth)
│   └── utils.ts              # Pure functions (hash, parse, time, domain)
└── __tests__/
    ├── utils.test.ts          # Unit tests for all utility functions
    ├── api.test.ts            # API route integration tests
    └── ErrorState.test.tsx    # Component rendering tests
```

### Data Flow

```
User clicks category
  → useNewsLoader dispatches fetch to /api/news?category=X
  → API route checks in-memory cache (5min TTL)
  → If miss: calls NewsAPI top-headlines endpoint
  → Normalizes response to Article[] format
  → Returns to client (~100-300ms)
  → Client renders ArticleCard grid with animations
```

### Key Design Decisions

| Decision | Why |
|----------|-----|
| Server-side API proxy | API keys never reach the client |
| NewsAPI over web scraping | Reliable structured data, fast responses (~100ms) |
| In-memory cache (5min TTL) | Reduces API calls, stays within free tier limits |
| Stable URL-based IDs | Bookmarks survive page refresh |
| CSS variables for theming | Dark/light toggle without class rewrite |

## Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint check
npm run test         # Run tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

## Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variable
vercel env add NEWS_API_KEY
```

Or connect your GitHub repo to [vercel.com](https://vercel.com) for automatic deployments on push.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEWS_API_KEY` | Yes | NewsAPI.org API key ([get one free](https://newsapi.org/)) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (for future AI summaries) |

## Git Workflow

```bash
main              # always deployable, Vercel auto-deploys
 └── dev          # daily work, merge to main when stable
      ├── feat/*  # new features (feat/search, feat/pull-to-refresh)
      └── fix/*   # bug fixes (fix/mobile-layout, fix/parser)
```

```bash
# Start new work
git checkout dev && git checkout -b feat/my-feature

# Finish
git checkout dev && git merge feat/my-feature && git branch -d feat/my-feature

# Ship to production
git checkout main && git merge dev && git push origin main
```

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + CSS custom properties
- **News Data:** NewsAPI.org
- **Testing:** Jest + React Testing Library
- **Deployment:** Vercel (recommended)
