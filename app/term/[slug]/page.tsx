import type { Metadata } from "next";
import { notFound } from "next/navigation";

import JsonLd from "@/components/JsonLd";
import TermDossier from "@/components/term/TermDossier";
import { mapArticleRows } from "@/lib/articleMapping";
import { getRecentArticlesByTerm, getTermBySlug, getTermCoverage, listDossierParams } from "@/lib/db";
import { dossierMetadata } from "@/lib/metadata";
import { isPublishableTerm } from "@/lib/publishFloor";
import { termJsonLd } from "@/lib/structuredData";
import type { Article } from "@/lib/types";

// ISR — 6 hours, matching the outlet dossier rather than the profile-only
// 24h. The definition half changes when a human edits the CSV; the coverage
// half moves every pipeline cycle, and as before that is the side setting the
// cadence — it just does not need re-deriving twice an hour.
export const revalidate = 21600;

/**
 * Prerender the publishable term dossiers at build time.
 *
 * These pages are crawler-facing by design — they are advertised in
 * sitemap.xml — and until this existed none of them were prebuilt, so a
 * crawler sweep across the set generated every one on demand. `dynamicParams`
 * is left at its default of true: a dossier below the publish floor is not
 * prebuilt and still renders on first request, exactly as before.
 */
export async function generateStaticParams(): Promise<
  Array<{ slug: string }>
> {
  const params = await listDossierParams("term");
  return params.map((slug) => ({ slug }));
}

interface TermRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: TermRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const term = await getTermBySlug(slug);
  if (!term) return { title: "Term not found" };

  // Coverage is still fetched for the description, but indexability is NOT
  // decided from it — `isPublishableTerm` reads the stored count (migration
  // 034), the same column the sitemap query filters on. Deciding it from a
  // freshly computed number here would let this page and the sitemap disagree
  // about the same term.
  const coverage = await getTermCoverage(term);

  return dossierMetadata({
    title: `${term.term} — Civic term`,
    // Describes what the page uniquely has. The definitional half is Cornell's
    // and unwinnable against Wikipedia; the coverage half is the reason to
    // rank this page at all, so it leads.
    description:
      coverage.articleCount > 0
        ? `What ${term.term} means, and how ${coverage.outlets.length} outlets across the political spectrum are covering it — ${coverage.articleCount} stories in Sift's index.`
        : `What ${term.term} means, with its primary source, on Sift.`,
    indexable: isPublishableTerm(term),
    ogType: "article",
  });
}

export default async function TermDossierPage({ params }: TermRouteProps) {
  const { slug } = await params;
  const term = await getTermBySlug(slug);
  if (!term) notFound();

  // Sequential after the term resolves — both queries need the row's aliases
  // to build their match patterns, so there is nothing to prefetch in
  // parallel with the lookup the way the outlet route can.
  const [coverage, recentRows] = await Promise.all([
    getTermCoverage(term),
    getRecentArticlesByTerm(term, 12),
  ]);

  // `clean: false` matches the other dossiers — these rows are rendered as a
  // plain list, not through the feed's card pipeline.
  const recentArticles: Article[] = mapArticleRows(recentRows, { clean: false });

  return (
    <>
      <JsonLd data={termJsonLd(term)} />
      <TermDossier
        term={term}
        coverage={coverage}
        recentArticles={recentArticles}
      />
    </>
  );
}
