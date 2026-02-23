"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { STORAGE_KEYS, SLOW_THRESHOLD_MS, API_TIMEOUT_MS } from "./constants";
import type { Article, ArticleCache, CategoryId, NewsApiResponse } from "./types";

// ─── useLocalStorage ────────────────────────────────────

function useLocalStorage<T>(key: string, initialValue: T): [T, (val: T | ((prev: T) => T)) => void] {
  const [stored, setStored] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(stored));
    } catch {}
  }, [key, stored]);

  return [stored, setStored];
}

// ─── useBookmarks ───────────────────────────────────────

export function useBookmarks() {
  const [ids, setIds] = useLocalStorage<string[]>(STORAGE_KEYS.bookmarks, []);
  const bookmarkSet = new Set(ids);

  const toggle = useCallback(
    (id: string) => {
      setIds((prev) => {
        const set = new Set(prev);
        if (set.has(id)) {
          set.delete(id);
        } else {
          set.add(id);
        }
        return [...set];
      });
    },
    [setIds]
  );

  return { bookmarks: bookmarkSet, toggle, count: ids.length };
}

// ─── useTheme ───────────────────────────────────────────

export function useTheme() {
  const [dark, setDark] = useLocalStorage(STORAGE_KEYS.theme, true);
  const toggle = useCallback(() => setDark((d) => !d), [setDark]);
  return { dark, toggle };
}

// ─── useNewsLoader ──────────────────────────────────────

interface NewsLoaderState {
  articles: ArticleCache;
  loading: boolean;
  error: string | null;
  slow: boolean;
  lastUpdated: Date | null;
}

export function useNewsLoader() {
  const [state, setState] = useState<NewsLoaderState>({
    articles: {},
    loading: false,
    error: null,
    slow: false,
    lastUpdated: null,
  });
  const fetchedRef = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);

  const loadCategory = useCallback(async (category: CategoryId, force = false) => {
    if (!force && fetchedRef.current.has(category)) return;

    // Cancel any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({ ...s, loading: true, error: null, slow: false }));

    const slowTimer = setTimeout(
      () => setState((s) => ({ ...s, slow: true })),
      SLOW_THRESHOLD_MS
    );
    const timeoutTimer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(`/api/news?category=${category}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }

      const data: NewsApiResponse = await res.json();

      if (data.articles.length === 0) {
        throw new Error("No articles returned");
      }

      setState((s) => ({
        ...s,
        articles: { ...s.articles, [category]: data.articles },
        lastUpdated: new Date(data.fetchedAt),
      }));
      fetchedRef.current.add(category);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        if (abortRef.current === controller) {
          setState((s) => ({ ...s, error: "Request timed out — try again" }));
        }
        return;
      }
      const message = err instanceof Error ? err.message : "Failed to load articles";
      setState((s) => ({ ...s, error: message }));
    } finally {
      clearTimeout(slowTimer);
      clearTimeout(timeoutTimer);
      setState((s) => ({ ...s, loading: false, slow: false }));
    }
  }, []);

  return { ...state, loadCategory };
}
