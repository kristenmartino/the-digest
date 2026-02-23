import type { RawArticle, Article, CategoryId } from "./types";

/**
 * Estimate reading time in minutes from text content.
 * Handles empty/whitespace-only strings correctly.
 */
export function estimateReadTime(text: string | undefined | null): number {
  if (!text || !text.trim()) return 1;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

/**
 * Format a date string as relative time (e.g., "5m ago", "2h ago").
 */
export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Recently";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (isNaN(diff) || diff < 0) return "Recently";
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Extract a display-friendly domain name from a URL.
 * "https://www.reuters.com/article/123" → "Reuters"
 */
export function extractSourceDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace("www.", "");
    const name = hostname.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "News";
  }
}

/**
 * Generate a stable hash from a string.
 * Used for deterministic article IDs that survive refresh.
 */
export function stableHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Robustly extract a JSON array from potentially messy API text.
 *
 * Strategy 1: Direct JSON.parse
 * Strategy 2: Find outermost [...] with string-aware bracket matching
 * Strategy 3: Collect individual {...} objects with a title key
 */
export function extractJsonArray(text: string): RawArticle[] | null {
  if (!text) return null;

  // Strategy 1: Direct parse
  try {
    const r = JSON.parse(text.trim());
    if (Array.isArray(r)) return r;
  } catch {}

  // Strategy 2: String-aware bracket matching
  const start = text.indexOf("[");
  if (start !== -1) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\") { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "[") depth++;
      else if (ch === "]") {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(text.slice(start, i + 1)); } catch { break; }
        }
      }
    }
  }

  // Strategy 3: Collect individual objects
  const objects: RawArticle[] = [];
  const objRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
  let match;
  while ((match = objRegex.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (obj.title) objects.push(obj);
    } catch {}
  }
  if (objects.length > 0) return objects;

  return null;
}

/**
 * Normalize a raw API article into our domain Article type.
 */
export function normalizeArticle(
  raw: RawArticle,
  category: CategoryId,
  index: number
): Article {
  const sourceUrl = raw.source_url || "";
  return {
    id: sourceUrl ? stableHash(sourceUrl) : `${category}-${index}-${Date.now()}`,
    title: raw.title || "Untitled",
    summary: raw.summary || "",
    sourceUrl,
    sourceName: raw.source_name || extractSourceDomain(sourceUrl),
    publishedDate: raw.published_date || null,
    imageUrl: raw.image_url || null,
    category,
    readTime: estimateReadTime(raw.summary),
  };
}
