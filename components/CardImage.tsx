"use client";

import { useState, useEffect } from "react";
import { CATEGORIES, GRADIENTS } from "@/lib/constants";
import type { CardImageProps } from "@/lib/types";

export default function CardImage({ src, alt, featured, category }: CardImageProps) {
  const [status, setStatus] = useState<"loading" | "loaded" | "fallback">(
    src ? "loading" : "fallback"
  );
  const cat = CATEGORIES.find((c) => c.id === category) || CATEGORIES[0];

  useEffect(() => {
    setStatus(src ? "loading" : "fallback");
  }, [src]);

  return (
    <div
      className="relative overflow-hidden"
      style={{
        height: featured ? "100%" : 170,
        minHeight: featured ? 280 : undefined,
        background: GRADIENTS[category] || GRADIENTS.top,
      }}
    >
      {/* Fallback: gradient + icon */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity duration-500"
        style={{ opacity: status === "loaded" ? 0 : 1 }}
      >
        <span
          className="select-none drop-shadow-lg"
          style={{ fontSize: featured ? 64 : 40, opacity: 0.3 }}
        >
          {cat.icon}
        </span>
      </div>

      {/* Real image */}
      {src && status !== "fallback" && (
        <img
          src={src}
          alt={alt || ""}
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setStatus("loaded")}
          onError={() => setStatus("fallback")}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          style={{ opacity: status === "loaded" ? 1 : 0 }}
        />
      )}

      {/* Vignette overlay for loaded images */}
      {status === "loaded" && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0,0,0,0.3) 0%, transparent 40%)",
          }}
        />
      )}
    </div>
  );
}
