import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Digest — AI-Curated News",
  description:
    "Stay informed with AI-curated news summaries across technology, business, science, world affairs, and health.",
  openGraph: {
    title: "The Digest",
    description: "AI-curated news powered by Claude",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-nav">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
