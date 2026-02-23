import {
  estimateReadTime,
  timeAgo,
  extractSourceDomain,
  stableHash,
  extractJsonArray,
  normalizeArticle,
} from "@/lib/utils";

// ─── estimateReadTime ───────────────────────────────────

describe("estimateReadTime", () => {
  it("returns 1 for empty string", () => {
    expect(estimateReadTime("")).toBe(1);
  });

  it("returns 1 for null/undefined", () => {
    expect(estimateReadTime(null)).toBe(1);
    expect(estimateReadTime(undefined)).toBe(1);
  });

  it("returns 1 for whitespace-only string", () => {
    expect(estimateReadTime("   \n\t  ")).toBe(1);
  });

  it("returns 1 for short text", () => {
    expect(estimateReadTime("Hello world")).toBe(1);
  });

  it("returns 2 for 400 words", () => {
    const text = "word ".repeat(400);
    expect(estimateReadTime(text)).toBe(2);
  });

  it("rounds up correctly", () => {
    const text = "word ".repeat(201);
    expect(estimateReadTime(text)).toBe(2); // 201/200 = 1.005 → ceil = 2
  });
});

// ─── timeAgo ────────────────────────────────────────────

describe("timeAgo", () => {
  it('returns "Recently" for null', () => {
    expect(timeAgo(null)).toBe("Recently");
  });

  it('returns "Recently" for invalid date', () => {
    expect(timeAgo("not-a-date")).toBe("Recently");
  });

  it('returns "Just now" for current time', () => {
    expect(timeAgo(new Date().toISOString())).toBe("Just now");
  });

  it("returns minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(timeAgo(fiveMinAgo)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago", () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe("2d ago");
  });

  it('returns "Recently" for future dates', () => {
    const future = new Date(Date.now() + 100000).toISOString();
    expect(timeAgo(future)).toBe("Recently");
  });
});

// ─── extractSourceDomain ────────────────────────────────

describe("extractSourceDomain", () => {
  it("extracts capitalized domain name", () => {
    expect(extractSourceDomain("https://www.reuters.com/article/123")).toBe("Reuters");
  });

  it("strips www prefix", () => {
    expect(extractSourceDomain("https://www.nytimes.com/2024/article")).toBe("Nytimes");
  });

  it("handles URLs without www", () => {
    expect(extractSourceDomain("https://bbc.co.uk/news")).toBe("Bbc");
  });

  it('returns "News" for invalid URLs', () => {
    expect(extractSourceDomain("not-a-url")).toBe("News");
  });

  it('returns "News" for empty string', () => {
    expect(extractSourceDomain("")).toBe("News");
  });
});

// ─── stableHash ─────────────────────────────────────────

describe("stableHash", () => {
  it("returns same hash for same input", () => {
    const url = "https://reuters.com/article/123";
    expect(stableHash(url)).toBe(stableHash(url));
  });

  it("returns different hash for different input", () => {
    expect(stableHash("https://a.com")).not.toBe(stableHash("https://b.com"));
  });

  it("returns a non-empty string", () => {
    const hash = stableHash("test");
    expect(hash.length).toBeGreaterThan(0);
    expect(typeof hash).toBe("string");
  });

  it("handles empty string", () => {
    expect(stableHash("")).toBe("0");
  });
});

// ─── extractJsonArray ───────────────────────────────────
// This function caused 6 debugging iterations. Test extensively.

describe("extractJsonArray", () => {
  const VALID_ARTICLE = {
    title: "Test",
    summary: "A test article",
    source_url: "https://test.com",
    source_name: "Test",
    published_date: null,
    image_url: null,
  };

  it("parses a clean JSON array", () => {
    const input = JSON.stringify([VALID_ARTICLE]);
    const result = extractJsonArray(input);
    expect(result).toHaveLength(1);
    expect(result![0].title).toBe("Test");
  });

  it("parses array wrapped in markdown code fences", () => {
    const input = "```json\n" + JSON.stringify([VALID_ARTICLE]) + "\n```";
    // Note: fences are stripped before calling extractJsonArray in the real code,
    // but the function should still handle residual brackets
    const cleaned = input.replace(/```json|```/g, "").trim();
    const result = extractJsonArray(cleaned);
    expect(result).toHaveLength(1);
  });

  it("parses array preceded by prose", () => {
    const input =
      "Here are the latest news articles:\n\n" +
      JSON.stringify([VALID_ARTICLE, VALID_ARTICLE]);
    const result = extractJsonArray(input);
    expect(result).toHaveLength(2);
  });

  it("parses array followed by prose", () => {
    const input =
      JSON.stringify([VALID_ARTICLE]) +
      "\n\nI hope these articles are helpful!";
    const result = extractJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it("parses array with prose both before and after", () => {
    const input =
      "Sure, here are 5 articles:\n" +
      JSON.stringify([VALID_ARTICLE]) +
      "\nLet me know if you need more.";
    const result = extractJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it("handles escaped quotes inside strings", () => {
    const article = { ...VALID_ARTICLE, title: 'He said "hello"' };
    const input = JSON.stringify([article]);
    const result = extractJsonArray(input);
    expect(result).toHaveLength(1);
    expect(result![0].title).toBe('He said "hello"');
  });

  it("returns null for empty string", () => {
    expect(extractJsonArray("")).toBeNull();
  });

  it("returns null for null/undefined", () => {
    expect(extractJsonArray(null as unknown as string)).toBeNull();
  });

  it("returns null for model refusal text with no JSON", () => {
    const refusal =
      "I cannot provide the response in the exact format requested. " +
      "The search results show news headlines but they don't contain structured data.";
    expect(extractJsonArray(refusal)).toBeNull();
  });

  it("returns null for truncated JSON (missing closing bracket)", () => {
    const input = '[{"title":"Test","summary":"text"';
    expect(extractJsonArray(input)).toBeNull();
  });

  it("collects individual objects when array wrapper is missing", () => {
    const input =
      'Here is one: {"title":"A","summary":"","source_url":"https://a.com"}\n' +
      'And another: {"title":"B","summary":"","source_url":"https://b.com"}';
    const result = extractJsonArray(input);
    expect(result).toHaveLength(2);
    expect(result![0].title).toBe("A");
    expect(result![1].title).toBe("B");
  });

  it("handles nested brackets in strings", () => {
    const article = { ...VALID_ARTICLE, summary: "Array [1,2,3] found in {data}" };
    const input = JSON.stringify([article]);
    const result = extractJsonArray(input);
    expect(result).toHaveLength(1);
    expect(result![0].summary).toBe("Array [1,2,3] found in {data}");
  });

  it("handles multiline JSON", () => {
    const input = JSON.stringify([VALID_ARTICLE], null, 2);
    const result = extractJsonArray(input);
    expect(result).toHaveLength(1);
  });

  it("returns null for HTML error page", () => {
    const input = '<!DOCTYPE html><html><body>500 Internal Server Error</body></html>';
    expect(extractJsonArray(input)).toBeNull();
  });

  it("parses 5 articles correctly", () => {
    const articles = Array.from({ length: 5 }, (_, i) => ({
      ...VALID_ARTICLE,
      title: `Article ${i + 1}`,
    }));
    const result = extractJsonArray(JSON.stringify(articles));
    expect(result).toHaveLength(5);
    expect(result![4].title).toBe("Article 5");
  });
});

// ─── normalizeArticle ───────────────────────────────────

describe("normalizeArticle", () => {
  const RAW = {
    title: "Test Title",
    summary: "A summary.",
    source_url: "https://reuters.com/article",
    source_name: "Reuters",
    published_date: "2025-01-15T10:00:00Z",
    image_url: "https://img.reuters.com/photo.jpg",
  };

  it("maps all fields correctly", () => {
    const article = normalizeArticle(RAW, "technology", 0);
    expect(article.title).toBe("Test Title");
    expect(article.summary).toBe("A summary.");
    expect(article.sourceUrl).toBe("https://reuters.com/article");
    expect(article.sourceName).toBe("Reuters");
    expect(article.publishedDate).toBe("2025-01-15T10:00:00Z");
    expect(article.imageUrl).toBe("https://img.reuters.com/photo.jpg");
    expect(article.category).toBe("technology");
    expect(article.readTime).toBe(1);
  });

  it("generates stable ID from source_url", () => {
    const a = normalizeArticle(RAW, "top", 0);
    const b = normalizeArticle(RAW, "top", 1);
    expect(a.id).toBe(b.id); // Same URL → same ID
  });

  it("handles missing optional fields", () => {
    const minimal = { title: "Min", summary: "", source_url: "" };
    const article = normalizeArticle(minimal as any, "science", 0);
    expect(article.title).toBe("Min");
    expect(article.sourceName).toBe("News");
    expect(article.publishedDate).toBeNull();
    expect(article.imageUrl).toBeNull();
  });

  it("falls back to 'Untitled' for missing title", () => {
    const noTitle = { ...RAW, title: undefined };
    const article = normalizeArticle(noTitle as any, "top", 0);
    expect(article.title).toBe("Untitled");
  });

  it("extracts domain when source_name is missing", () => {
    const noName = { ...RAW, source_name: undefined };
    const article = normalizeArticle(noName as any, "top", 0);
    expect(article.sourceName).toBe("Reuters");
  });
});
