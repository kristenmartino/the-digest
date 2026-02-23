# The Digest

AI-curated news aggregator powered by Claude and the Anthropic web_search tool. Surfaces the top stories across 6 categories with real-time summaries.

## Quick Start

```bash
# 1. Clone and install
git clone <your-repo-url>
cd the-digest
npm install

# 2. Configure API key
cp .env.local.example .env.local
# Edit .env.local and add your Anthropic API key

# 3. Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Architecture

```
the-digest/
├── app/
│   ├── api/news/route.ts    # Server-side API proxy (→ Anthropic)
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
  → If miss: calls Anthropic Messages API with web_search tool
  → Parses JSON from response (with fallback strategies)
  → Returns normalized Article[] to client
  → Client renders ArticleCard grid with animations
```

### Key Design Decisions

| Decision | Why |
|----------|-----|
| Server-side API proxy | API key never reaches the client |
| "Summarize" prompt framing | Model refuses rigid JSON formatting of search snippets |
| 3-strategy JSON parser | Handles clean JSON, prose-wrapped, and individual objects |
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
vercel env add ANTHROPIC_API_KEY
```

Or connect your GitHub repo to [vercel.com](https://vercel.com) for automatic deployments on push.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Your Anthropic API key |

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + CSS custom properties
- **AI:** Anthropic Claude Sonnet 4 + web_search tool
- **Testing:** Jest + React Testing Library
- **Deployment:** Vercel (recommended)
