"use client";

import { useState } from "react";
import { CATEGORIES, CATEGORY_COLORS } from "@/lib/constants";
import { timeAgo } from "@/lib/utils";
import CardImage from "./CardImage";
import type { ArticleCardProps } from "@/lib/types";

export default function ArticleCard({
  article,
  featured,
  onBookmark,
  isBookmarked,
  index,
}: ArticleCardProps) {
  const [hovered, setHovered] = useState(false);
  const cat = CATEGORIES.find((c) => c.id === article.category) || CATEGORIES[0];
  const color = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.top;

  return (
    <article
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`
        bg-[var(--card-bg)] rounded-[14px] overflow-hidden cursor-pointer
        border border-[var(--border)] animate-fade-slide-in
        ${featured ? "col-span-full grid grid-cols-1 md:grid-cols-2" : ""}
      `}
      style={{
        transition: "transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s cubic-bezier(0.16,1,0.3,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 20px 60px var(--shadow-hover)"
          : "0 2px 16px var(--shadow)",
        animationDelay: `${index * 60}ms`,
      }}
      onClick={() =>
        article.sourceUrl && window.open(article.sourceUrl, "_blank", "noopener")
      }
    >
      <CardImage
        src={article.imageUrl}
        alt={article.title}
        featured={featured}
        category={article.category}
      />

      <div
        className={`flex flex-col gap-3 ${
          featured ? "p-7 md:p-8" : "p-5"
        }`}
        style={{ minHeight: featured ? undefined : 160 }}
      >
        {/* Category badge + bookmark */}
        <div className="flex justify-between items-center">
          <span
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide"
            style={{
              background: `rgba(${color.rgb}, 0.08)`,
              color: color.hex,
              border: `1px solid rgba(${color.rgb}, 0.15)`,
            }}
          >
            {cat.icon} {cat.label}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onBookmark(article.id);
            }}
            aria-label={isBookmarked ? "Remove bookmark" : "Add bookmark"}
            className="bg-transparent border-none cursor-pointer text-lg p-1 transition-all duration-200"
            style={{
              color: isBookmarked ? "#f59e0b" : "var(--text-muted)",
              transform: isBookmarked ? "scale(1.15)" : "scale(1)",
            }}
          >
            {isBookmarked ? "★" : "☆"}
          </button>
        </div>

        {/* Title */}
        <h3
          className="font-heading font-bold leading-snug text-[var(--text)] tracking-tight"
          style={{
            fontSize: featured ? 24 : 17,
            display: "-webkit-box",
            WebkitLineClamp: featured ? 3 : 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {article.title}
        </h3>

        {/* Summary */}
        <p
          className="text-[var(--text-secondary)] leading-relaxed"
          style={{
            fontSize: featured ? 15 : 13.5,
            display: "-webkit-box",
            WebkitLineClamp: featured ? 4 : 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            flex: 1,
          }}
        >
          {article.summary}
        </p>

        {/* Meta */}
        <div className="flex items-center gap-3 mt-auto pt-2 text-xs text-[var(--text-muted)] font-medium flex-wrap">
          <span className="font-bold text-[var(--text-secondary)]">
            {article.sourceName}
          </span>
          <span className="opacity-30">·</span>
          <span>{timeAgo(article.publishedDate)}</span>
          <span className="opacity-30">·</span>
          <span>{article.readTime} min read</span>
        </div>
      </div>
    </article>
  );
}
