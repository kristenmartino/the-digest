import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        heading: ["Playfair Display", "Georgia", "Times New Roman", "serif"],
        body: ["Source Sans 3", "Segoe UI", "sans-serif"],
      },
      colors: {
        digest: {
          bg: "var(--bg)",
          card: "var(--card-bg)",
          border: "var(--border)",
          accent: "var(--accent)",
          skeleton: "var(--skeleton)",
        },
        category: {
          top: "#dc2626",
          technology: "#2563eb",
          business: "#059669",
          science: "#7c3aed",
          world: "#d97706",
          health: "#db2777",
        },
      },
      keyframes: {
        shimmer: {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "0.8" },
        },
        "fade-slide-in": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        spin: {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        shimmer: "shimmer 1.8s ease-in-out infinite",
        "fade-slide-in": "fade-slide-in 0.5s ease-out both",
        "spin-slow": "spin 1s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
