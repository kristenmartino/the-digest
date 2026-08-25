import type { Metadata } from "next";
import { notFound } from "next/navigation";

import BillDossier from "@/components/bill/BillDossier";
import JsonLd from "@/components/JsonLd";
import { getBillById, getPoliticianByBioguide, listDossierParams } from "@/lib/db";
import { formatBillIdDisplay } from "@/lib/bill";
import { dossierMetadata } from "@/lib/metadata";
import { isPublishableBill } from "@/lib/publishFloor";
import { billJsonLd } from "@/lib/structuredData";

// ISR — 24 hours, same reasoning as the other profile-only dossiers: sized
// to the crawl interval, not to a heartbeat that expired between sweeps.
export const revalidate = 86400;

/**
 * Prerender the publishable bill dossiers at build time.
 *
 * These pages are crawler-facing by design — they are advertised in
 * sitemap.xml — and until this existed none of them were prebuilt, so a
 * crawler sweep across the set generated every one on demand. `dynamicParams`
 * is left at its default of true: a dossier below the publish floor is not
 * prebuilt and still renders on first request, exactly as before.
 */
export async function generateStaticParams(): Promise<
  Array<{ id: string }>
> {
  const params = await listDossierParams("bill");
  return params.map((id) => ({ id }));
}

interface BillRouteProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: BillRouteProps): Promise<Metadata> {
  const { id } = await params;
  const bill = await getBillById(id);
  if (!bill) return { title: "Bill not found" };
  const display = formatBillIdDisplay(bill.billId);

  // Per-route metadata override so shared bill links carry the bill's
  // name in the unfurl card. og:image comes from the sibling
  // opengraph-image.tsx (shared card factory in lib/og.tsx).
  return dossierMetadata({
    title: `${display} — Bill dossier`,
    unfurlTitle: `${display} (${bill.shortTitle ?? "Bill"}) — Sift`,
    description: `Sponsor, cosponsors, status, and lobbying spend for ${
      bill.shortTitle ?? display
    } on Sift.`,
    indexable: isPublishableBill(bill),
    ogType: "article",
  });
}

export default async function BillDossierPage({ params }: BillRouteProps) {
  const { id } = await params;
  const bill = await getBillById(id);
  if (!bill) notFound();

  // Resolve the sponsor's politician profile so the dossier can render
  // their name as a clickable link to /politician/[bioguide]. Tolerant
  // of misses — a sponsor whose bioguide hasn't been curated yet renders
  // as plain text (no broken link).
  const sponsor = bill.sponsorBioguide
    ? await getPoliticianByBioguide(bill.sponsorBioguide)
    : null;

  return (
    <>
      <JsonLd data={billJsonLd(bill)} />
      <BillDossier bill={bill} sponsor={sponsor} />
    </>
  );
}
