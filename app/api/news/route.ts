import { NextRequest, NextResponse } from "next/server";
import { NEWSAPI_CATEGORIES, CATEGORY_QUERIES, CACHE_TTL_MS, RATE_LIMIT_MAX } from "@/lib/constants";
import type { CategoryId, Article, NewsApiResponse, NewsApiError } from "@/lib/types";

// ─── In-Memory Cache ────────────────────────────────────
// In production, replace with Redis/KV store

interface CacheEntry {
  articles: Article[];
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

// ─── Rate Limiter ───────────────────────────────────────
// Simple sliding window per IP. In production, use Redis.

const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const window = 60_000; // 1 minute
  const timestamps = rateLimitMap.get(ip) || [];
  const recent = timestamps.filter((t) => now - t < window);
  rateLimitMap.set(ip, recent);

  if (recent.length >= RATE_LIMIT_MAX) return true;
  recent.push(now);
  return false;
}

// ─── NewsAPI Types ──────────────────────────────────────

interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
  code?: string;
  message?: string;
}

// ─── Article Normalizer ─────────────────────────────────

function normalizeNewsAPIArticle(article: NewsAPIArticle, category: CategoryId, index: number): Article {
  const summary = article.description || article.content?.slice(0, 200) || "No description available.";
  // Estimate read time: ~200 words per minute, avg 5 chars per word
  const wordCount = summary.length / 5;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  return {
    id: `${category}-${index}-${Date.now()}`,
    title: article.title || "Untitled",
    summary,
    sourceUrl: article.url,
    sourceName: article.source?.name || "Unknown",
    publishedDate: article.publishedAt || null,
    imageUrl: article.urlToImage || null,
    category,
    readTime,
  };
}

// ─── Helper: Build query from topic + subtopics ─────────

function buildSearchQuery(category: CategoryId): string {
  const { topic, subtopics } = CATEGORY_QUERIES[category];
  // Combine topic with first 2 subtopics for broader but focused results
  const keywords = [topic, ...subtopics.slice(0, 2)].join(" OR ");
  return keywords;
}

// ─── Route Handler ──────────────────────────────────────

export async function GET(request: NextRequest) {
  // Validate category param
  const category = request.nextUrl.searchParams.get("category") as CategoryId;
  if (!category || !(category in NEWSAPI_CATEGORIES)) {
    return NextResponse.json<NewsApiError>(
      { error: "Invalid category", details: `Must be one of: ${Object.keys(NEWSAPI_CATEGORIES).join(", ")}` },
      { status: 400 }
    );
  }

  // Rate limiting
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  if (isRateLimited(ip)) {
    return NextResponse.json<NewsApiError>(
      { error: "Too many requests. Try again in a minute." },
      { status: 429 }
    );
  }

  // Check cache
  const cached = cache.get(category);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json<NewsApiResponse>({
      articles: cached.articles,
      cached: true,
      fetchedAt: new Date(cached.fetchedAt).toISOString(),
    });
  }

  // Fetch from NewsAPI
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return NextResponse.json<NewsApiError>(
      { error: "Server configuration error", details: "NEWS_API_KEY not set" },
      { status: 500 }
    );
  }

  try {
    const newsCategory = NEWSAPI_CATEGORIES[category];

    // Build URL based on category type
    const params = new URLSearchParams({
      apiKey,
      pageSize: "10",
    });

    let url: string;

    if (newsCategory === null) {
      // Categories without direct NewsAPI mapping use "everything" endpoint
      params.set("q", buildSearchQuery(category));
      params.set("language", "en");
      params.set("sortBy", "publishedAt");
      url = `https://newsapi.org/v2/everything?${params}`;
    } else if (category === "world") {
      // For world news, don't specify country to get international results
      params.set("category", "general");
      params.set("language", "en");
      url = `https://newsapi.org/v2/top-headlines?${params}`;
    } else {
      // For other categories, use US top headlines
      params.set("country", "us");
      params.set("category", newsCategory);
      url = `https://newsapi.org/v2/top-headlines?${params}`;
    }

    const newsRes = await fetch(url, {
      headers: { "User-Agent": "TheDigest/1.0" },
    });

    const data: NewsAPIResponse = await newsRes.json();

    if (data.status !== "ok") {
      console.error(`NewsAPI error [${data.code}]:`, data.message);
      return NextResponse.json<NewsApiError>(
        { error: `NewsAPI error: ${data.code}`, details: data.message || "Unknown error" },
        { status: 502 }
      );
    }

    if (!data.articles || data.articles.length === 0) {
      return NextResponse.json<NewsApiError>(
        { error: "No articles found", details: `No news available for category: ${category}` },
        { status: 404 }
      );
    }

    // Filter out articles with "[Removed]" title (NewsAPI returns these for deleted articles)
    const validArticles = data.articles.filter(
      (a) => a.title && a.title !== "[Removed]"
    );

    // Normalize articles
    const articles = validArticles.map((raw, i) => normalizeNewsAPIArticle(raw, category, i));

    // Cache
    const fetchedAt = Date.now();
    cache.set(category, { articles, fetchedAt });

    return NextResponse.json<NewsApiResponse>({
      articles,
      cached: false,
      fetchedAt: new Date(fetchedAt).toISOString(),
    });
  } catch (err) {
    console.error("News fetch error:", err);
    return NextResponse.json<NewsApiError>(
      { error: "Internal server error", details: String(err) },
      { status: 500 }
    );
  }
}
