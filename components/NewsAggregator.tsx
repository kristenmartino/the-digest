"use client";

import { useEffect, useMemo } from "react";
import { CATEGORIES } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import { useNewsLoader, useBookmarks, useTheme } from "@/lib/hooks";
import ArticleCard from "./ArticleCard";
import SkeletonCard from "./SkeletonCard";
import ErrorState from "./ErrorState";
import type { CategoryId } from "@/lib/types";
import { useState } from "react";

// ─── Theme CSS Variables ────────────────────────────────

const DARK_VARS = {
  "--bg": "#0a0a0f",
  "--card-bg": "#16161f",
  "--text": "#eeeef0",
  "--text-secondary": "#9d9daa",
  "--text-muted": "#5a5a6e",
  "--border": "#222233",
  "--shadow": "rgba(0,0,0,0.4)",
  "--shadow-hover": "rgba(0,0,0,0.6)",
  "--skeleton": "#1e1e2a",
  "--accent": "#6366f1",
  "--nav-bg": "rgba(14,14,22,0.92)",
  "--pill-active": "#6366f1",
  "--pill-text": "#eeeef0",
} as React.CSSProperties;

const LIGHT_VARS = {
  "--bg": "#f5f3f0",
  "--card-bg": "#ffffff",
  "--text": "#1a1a1a",
  "--text-secondary": "#555566",
  "--text-muted": "#8888a0",
  "--border": "#e0ddd8",
  "--shadow": "rgba(0,0,0,0.06)",
  "--shadow-hover": "rgba(0,0,0,0.12)",
  "--skeleton": "#e8e5e0",
  "--accent": "#4f46e5",
  "--nav-bg": "rgba(245,243,240,0.92)",
  "--pill-active": "#1a1a1a",
  "--pill-text": "#ffffff",
} as React.CSSProperties;

// ─── Component ──────────────────────────────────────────

export default function NewsAggregator() {
  const [activeCategory, setActiveCategory] = useState<CategoryId>("top");
  const [showBookmarks, setShowBookmarks] = useState(false);

  const { articles, loading, error, slow, lastUpdated, loadCategory } = useNewsLoader();
  const { bookmarks, toggle: toggleBookmark, count: bookmarkCount } = useBookmarks();
  const { dark: darkMode, toggle: toggleDark } = useTheme();

  useEffect(() => {
    loadCategory(activeCategory);
  }, [activeCategory, loadCategory]);

  const currentArticles = useMemo(() => {
    if (showBookmarks) {
      return Object.values(articles).flat().filter((a) => bookmarks.has(a.id));
    }
    return articles[activeCategory] || [];
  }, [articles, activeCategory, showBookmarks, bookmarks]);

  const hasData = currentArticles.length > 0;
  const activeCatLabel = CATEGORIES.find((c) => c.id === activeCategory)?.label;

  return (
    <div
      className="min-h-screen font-body"
      style={{
        ...(darkMode ? DARK_VARS : LIGHT_VARS),
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      {/* ── Header ──────────────────────────────────── */}
      <header
        className="sticky top-0 z-50 border-b border-[var(--border)]"
        style={{
          background: "var(--nav-bg)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}
      >
        <div className="max-w-[1200px] mx-auto px-6 py-3.5 flex items-center justify-between">
          <div
            className="flex items-baseline gap-3 cursor-pointer"
            onClick={() => { setShowBookmarks(false); setActiveCategory("top"); }}
          >
            <h1 className="font-heading text-[28px] font-extrabold tracking-tight text-[var(--text)] leading-none">
              The Digest
            </h1>
            <span className="text-[10px] font-bold tracking-widest uppercase text-[var(--accent)] opacity-80">
              AI-Curated
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBookmarks(!showBookmarks)}
              aria-label="Bookmarks"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-semibold cursor-pointer transition-all duration-200 font-body"
              style={{
                background: showBookmarks ? "var(--accent)" : "transparent",
                border: `1px solid ${showBookmarks ? "var(--accent)" : "var(--border)"}`,
                color: showBookmarks ? "#fff" : "var(--text-secondary)",
              }}
            >
              ★ {bookmarkCount}
            </button>

            <button
              onClick={() => loadCategory(activeCategory, true)}
              disabled={loading}
              aria-label="Refresh"
              className="flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] bg-transparent text-[var(--text-secondary)] text-base transition-all duration-200"
              style={{ cursor: loading ? "wait" : "pointer", opacity: loading ? 0.5 : 1 }}
            >
              <span className={loading ? "animate-spin-slow inline-block" : "inline-block"}>
                ↻
              </span>
            </button>

            <button
              onClick={toggleDark}
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              className="flex items-center justify-center w-9 h-9 rounded-full border border-[var(--border)] bg-transparent text-[var(--text-secondary)] text-base cursor-pointer transition-all duration-200"
            >
              {darkMode ? "☀" : "◑"}
            </button>
          </div>
        </div>

        {/* Category pills */}
        {!showBookmarks && (
          <div className="max-w-[1200px] mx-auto px-6 pb-3 flex gap-1.5 overflow-x-auto">
            {CATEGORIES.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[13px] whitespace-nowrap cursor-pointer transition-all duration-200 font-body"
                  style={{
                    background: active ? "var(--pill-active)" : "transparent",
                    color: active ? "var(--pill-text)" : "var(--text-muted)",
                    border: "1px solid transparent",
                    fontWeight: active ? 700 : 500,
                  }}
                >
                  <span className="text-[10px]">{cat.icon}</span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ── Main ────────────────────────────────────── */}
      <main className="max-w-[1200px] mx-auto px-6 pt-7 pb-20">
        {/* Section header */}
        <div className="flex justify-between items-baseline mb-7">
          <div>
            <h2 className="font-heading text-[22px] font-bold text-[var(--text)] tracking-tight">
              {showBookmarks ? "Saved Articles" : activeCatLabel}
            </h2>
            {lastUpdated && !showBookmarks && (
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Updated {timeAgo(lastUpdated.toISOString())}
              </p>
            )}
          </div>
          {hasData && (
            <span className="text-xs text-[var(--text-muted)] font-medium">
              {currentArticles.length} article{currentArticles.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Loading skeleton */}
        {loading && !hasData && !error && (
          <div>
            <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
              <SkeletonCard featured />
              {[1, 2, 3, 4].map((i) => (
                <SkeletonCard key={i} />
              ))}
            </div>
            {slow && (
              <p className="text-center mt-6 text-sm text-[var(--text-muted)] animate-fade-slide-in">
                Still searching… this can take up to 30 seconds
              </p>
            )}
          </div>
        )}

        {/* Error */}
        {error && !loading && !hasData && (
          <ErrorState
            message={error}
            onRetry={() => loadCategory(activeCategory, true)}
          />
        )}

        {/* Empty bookmarks */}
        {showBookmarks && !hasData && !loading && (
          <div className="text-center py-20 px-5 text-[var(--text-muted)]">
            <div className="text-5xl mb-4 opacity-30">☆</div>
            <p className="text-base font-semibold text-[var(--text-secondary)]">
              No saved articles yet
            </p>
            <p className="text-sm mt-2">
              Click the star on any article to save it for later
            </p>
          </div>
        )}

        {/* Articles grid */}
        {hasData && (
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
            {currentArticles.map((article, i) => (
              <ArticleCard
                key={article.id}
                article={article}
                featured={i === 0 && !showBookmarks}
                onBookmark={toggleBookmark}
                isBookmarked={bookmarks.has(article.id)}
                index={i}
              />
            ))}
          </div>
        )}

        {/* Loading toast for refresh */}
        {loading && hasData && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-[var(--card-bg)] border border-[var(--border)] rounded-full px-6 py-2.5 text-sm font-semibold text-[var(--text-secondary)] flex items-center gap-2.5 shadow-lg z-50 animate-fade-slide-in">
            <span className="animate-spin-slow inline-block">↻</span>
            Fetching latest stories…
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-[var(--border)] py-6 px-6 text-center text-xs text-[var(--text-muted)] max-w-[1200px] mx-auto">
        <span className="font-heading font-semibold">The Digest</span>
        {" — "}AI-curated news powered by Claude. Articles link to original sources.
      </footer>
    </div>
  );
}
