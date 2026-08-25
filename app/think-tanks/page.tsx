import type { Metadata } from "next";

import SelfDescriptions from "@/components/thinkTanks/SelfDescriptions";
import { listSelfDescribedOrgs } from "@/lib/db";

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
const TITLE = "How policy organizations describe themselves";
const TITLE_UNFURL = `${TITLE} — Sift`;
const DESC =
  "Think tanks and advocacy organizations quoted from their own sites — not summarized, not rated, not characterized. Every quote linked to its source. No AI-generated text.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/think-tanks" },
  openGraph: { title: TITLE_UNFURL, description: DESC, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE_UNFURL, description: DESC },
};

export default async function ThinkTanksPage() {
  const orgs = await listSelfDescribedOrgs();
  return <SelfDescriptions orgs={orgs} />;
}
