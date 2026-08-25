import type { Metadata } from "next";

import TermIndex from "@/components/term/TermIndex";
import { countDefinedTerms, listPublishedTerms } from "@/lib/db";

// ISR — 24 hours, traced to this page's own declared `changeFrequency` in
// app/sitemap.ts (weekly or monthly). A 30-minute entry asserted a cadence
// several orders of magnitude faster than the one we advertise to crawlers.
export const revalidate = 86400;

// The page title carries NO brand: app/layout.tsx sets
// `template: "%s | Sift"`, so hardcoding "— Sift" here rendered
// "... — Sift | Sift" — live on /agencies and /think-tanks until 2026-08-17.
// Wasted characters matter on a page built for search: Google truncates
// around 60. The unfurl title keeps the brand, because openGraph/twitter get
// no template — the same split `dossierMetadata` already makes for /outlet
// and friends.
const TITLE = "The words the news assumes you already know";
const TITLE_UNFURL = `${TITLE} — Sift`;
const DESC =
  "Civic terms defined from the primary record — statute, constitutional clause, regulation — and shown as they are actually being covered. Roughly one story in five turns on a term the coverage never names.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/glossary" },
  openGraph: { title: TITLE_UNFURL, description: DESC, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE_UNFURL, description: DESC },
};

export default async function GlossaryPage() {
  const [terms, definedCount] = await Promise.all([
    listPublishedTerms(),
    countDefinedTerms(),
  ]);

  // Terms defined but below the floor. Clamped at 0 because the two queries
  // are independent: a term seeded between them would otherwise render as a
  // negative count in the gap note.
  const heldCount = Math.max(0, definedCount - terms.length);

  return <TermIndex terms={terms} heldCount={heldCount} />;
}
