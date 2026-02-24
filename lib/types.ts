// ─── Domain Types ───────────────────────────────────────

export type CategoryId =
  | "top"
  | "technology"
  | "business"
  | "science"
  | "energy"
  | "world"
  | "health";

export interface Category {
  id: CategoryId;
  label: string;
  icon: string;
}

export interface Article {
  id: string;
  title: string;
  summary: string;
  sourceUrl: string;
  sourceName: string;
  publishedDate: string | null;
  imageUrl: string | null;
  category: CategoryId;
  readTime: number;
}

// ─── API Types ──────────────────────────────────────────

/** Raw article shape from the Anthropic API before normalization */
export interface RawArticle {
  title: string;
  summary: string;
  source_url: string;
  source_name?: string;
  published_date?: string | null;
  image_url?: string | null;
}

/** Shape of /api/news response */
export interface NewsApiResponse {
  articles: Article[];
  cached: boolean;
  fetchedAt: string;
}

export interface NewsApiError {
  error: string;
  details?: string;
}

// ─── Component Props ────────────────────────────────────

export interface ArticleCardProps {
  article: Article;
  featured?: boolean;
  onBookmark: (id: string) => void;
  isBookmarked: boolean;
  index: number;
}

export interface CardImageProps {
  src: string | null;
  alt: string;
  featured?: boolean;
  category: CategoryId;
}

export interface SkeletonCardProps {
  featured?: boolean;
}

export interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

// ─── State Types ────────────────────────────────────────

export interface ArticleCache {
  [key: string]: Article[];
}
