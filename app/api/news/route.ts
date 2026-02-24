import { NextRequest, NextResponse } from "next/server";
import { CATEGORY_QUERIES, CACHE_TTL_MS, RATE_LIMIT_MAX } from "@/lib/constants";
import { extractJsonArray, normalizeArticle } from "@/lib/utils";
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

// ─── Prompt ─────────────────────────────────────────────

const SYSTEM_PROMPT = `You help users stay informed by summarizing news. When asked about news, search the web, then summarize what you find as a JSON array. Always respond with valid JSON only — no commentary, no markdown, no explanation before or after the JSON.`;

function buildUserPrompt(topic: string, subtopics: string[]): string {
  const subtopicList = subtopics.map((s) => `- ${s}`).join("\n");
  return `Please search for the latest news about: ${topic}

Make sure to search across these subtopics for broad coverage:
${subtopicList}

After searching, summarize the top 5 stories you found (at least one from each subtopic if possible). Format your response as a JSON array where each item has:
{"title": "the headline", "summary": "a brief 1-2 sentence summary in your own words", "source_url": "the URL if available, otherwise a best guess like https://reuters.com", "source_name": "the publication name", "published_date": null, "image_url": null}

Prioritize stories from the last 24 hours. Summarize in your own words and make reasonable guesses for any missing fields. Just give me the JSON array, nothing else.`;
}

// ─── Route Handler ──────────────────────────────────────

export async function GET(request: NextRequest) {
  // Validate category param
  const category = request.nextUrl.searchParams.get("category") as CategoryId;
  if (!category || !CATEGORY_QUERIES[category]) {
    return NextResponse.json<NewsApiError>(
      { error: "Invalid category", details: `Must be one of: ${Object.keys(CATEGORY_QUERIES).join(", ")}` },
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

  // Fetch from Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json<NewsApiError>(
      { error: "Server configuration error", details: "ANTHROPIC_API_KEY not set" },
      { status: 500 }
    );
  }

  try {
    const { topic, subtopics } = CATEGORY_QUERIES[category];

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(topic, subtopics) }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });

    if (!anthropicRes.ok) {
      const errorBody = await anthropicRes.text().catch(() => "");
      console.error(`Anthropic API error [${anthropicRes.status}]:`, errorBody.slice(0, 500));
      return NextResponse.json<NewsApiError>(
        { error: `Upstream API error (${anthropicRes.status})`, details: errorBody.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = await anthropicRes.json();

    // Extract text from response blocks
    const textBlocks = (data.content || []).filter(
      (b: { type: string }) => b.type === "text"
    );
    const fullText = textBlocks
      .map((b: { text: string }) => b.text)
      .join("\n")
      .replace(/```json|```/g, "")
      .trim();

    if (!fullText) {
      const blockTypes = (data.content || [])
        .map((b: { type: string }) => b.type)
        .join(", ");
      console.error("Empty text response. Block types:", blockTypes, "stop_reason:", data.stop_reason);
      return NextResponse.json<NewsApiError>(
        {
          error: "Empty response from AI",
          details: `stop_reason: ${data.stop_reason || "?"}, blocks: [${blockTypes}]`,
        },
        { status: 502 }
      );
    }

    // Parse articles
    const rawArticles = extractJsonArray(fullText);
    if (!rawArticles || rawArticles.length === 0) {
      console.error("Parse failure. Text:", fullText.slice(0, 300));
      return NextResponse.json<NewsApiError>(
        {
          error: "Could not parse articles from AI response",
          details: fullText.slice(0, 200),
        },
        { status: 502 }
      );
    }

    // Normalize
    const articles = rawArticles.map((raw, i) => normalizeArticle(raw, category, i));

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
