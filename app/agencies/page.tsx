import type { Metadata } from "next";

import AgenciesGovernance from "@/components/agencies/AgenciesGovernance";
import { listAllOrgsLite, listCitedAgencies } from "@/lib/db";

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
const TITLE = "Who controls a federal agency";
const TITLE_UNFURL = `${TITLE} — Sift`;
const DESC =
  "Appointment, terms, and the partisan-balance limits Congress wrote into statute. Every line cited to the section it came from. No AI-generated text.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: "/agencies" },
  openGraph: { title: TITLE_UNFURL, description: DESC, type: "website" },
  twitter: { card: "summary_large_image", title: TITLE_UNFURL, description: DESC },
};

export default async function AgenciesPage() {
  const [agencies, allOrgs] = await Promise.all([
    listCitedAgencies(),
    listAllOrgsLite(),
  ]);

  // Total agency dossiers held, cited or not. Drives the "what is missing"
  // note — the page says out loud that most agencies are omitted rather than
  // quietly showing only the flattering subset.
  const totalAgencies = allOrgs.filter((o) => o.type === "agency").length;

  return (
    <AgenciesGovernance agencies={agencies} totalAgencies={totalAgencies} />
  );
}
