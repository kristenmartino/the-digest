import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PoliticianDossier from "@/components/politician/PoliticianDossier";
import JsonLd from "@/components/JsonLd";
import { getPoliticianByBioguide, listDossierParams } from "@/lib/db";
import { dossierMetadata } from "@/lib/metadata";
import { isPublishablePolitician } from "@/lib/publishFloor";
import { politicianJsonLd } from "@/lib/structuredData";

// ISR — 24 hours. The old 1800s was matched to the *content*, which is
// right in isolation and wrong against the access pattern: with ~650 distinct
// dossier URLs and crawler traffic that visits each one about once per sweep,
// a 30-minute entry has always expired before the next hit, so every crawl
// paid a full render. A day-long entry survives between sweeps. Nothing here
// moves faster than that anyway — committees shift quarterly, donor/voting
// data lands on a daily refresh job.
export const revalidate = 86400;

/**
 * Prerender the publishable politician dossiers at build time.
 *
 * These pages are crawler-facing by design — they are advertised in
 * sitemap.xml — and until this existed none of them were prebuilt, so a
 * crawler sweep across the set generated every one on demand. `dynamicParams`
 * is left at its default of true: a dossier below the publish floor is not
 * prebuilt and still renders on first request, exactly as before.
 */
export async function generateStaticParams(): Promise<
  Array<{ bioguide: string }>
> {
  const params = await listDossierParams("politician");
  return params.map((bioguide) => ({ bioguide }));
}

interface PoliticianRouteProps {
  params: Promise<{ bioguide: string }>;
}

export async function generateMetadata({
  params,
}: PoliticianRouteProps): Promise<Metadata> {
  const { bioguide } = await params;
  const politician = await getPoliticianByBioguide(bioguide);
  if (!politician) return { title: "Politician not found" };

  // Per-route metadata override so shared dossier links carry the
  // politician's name, not the homepage's generic title. og:image comes from
  // the sibling opengraph-image.tsx (shared card factory in lib/og.tsx).
  const partyState =
    politician.party && politician.state
      ? ` (${politician.party}-${politician.state})`
      : "";
  return dossierMetadata({
    title: `${politician.name} — Politician dossier`,
    unfurlTitle: `${politician.name}${partyState} — Politician dossier | Sift`,
    description: `Committees, top industries by PAC contributions, and voting context for ${politician.name} on Sift.`,
    indexable: isPublishablePolitician(politician),
    ogType: "profile",
  });
}

export default async function PoliticianDossierPage({
  params,
}: PoliticianRouteProps) {
  const { bioguide } = await params;
  const politician = await getPoliticianByBioguide(bioguide);
  if (!politician) notFound();
  return (
    <>
      {/* Emits only fields the page itself renders — notably not `notes`. */}
      <JsonLd data={politicianJsonLd(politician)} />
      <PoliticianDossier politician={politician} />
    </>
  );
}
