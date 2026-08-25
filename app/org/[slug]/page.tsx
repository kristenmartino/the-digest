import type { Metadata } from "next";
import { notFound } from "next/navigation";

import OrgDossier from "@/components/org/OrgDossier";
import JsonLd from "@/components/JsonLd";
import { getFundingEdgesForOrg, getOrgBySlug, listDossierParams } from "@/lib/db";
import { dossierMetadata } from "@/lib/metadata";
import { reportError } from "@/lib/observability";
import { einFromOrgLinks } from "@/lib/org";
import { isPublishableOrg } from "@/lib/publishFloor";
import { orgJsonLd } from "@/lib/structuredData";

// ISR — 24 hours, same reasoning as the politician dossier: sized to the
// crawl interval rather than to a 30-minute heartbeat that always expired
// before the next visit. Org metadata is the slowest-moving of the set
// (annual budgets refresh on 990 cycles, FARA registrations are sporadic).
export const revalidate = 86400;

/**
 * Prerender the publishable org dossiers at build time.
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
  const params = await listDossierParams("org");
  return params.map((slug) => ({ slug }));
}

interface OrgRouteProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: OrgRouteProps): Promise<Metadata> {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) return { title: "Organization not found" };

  // Per-route metadata override so shared org-dossier links carry the
  // org's name in the unfurl card. og:image comes from the sibling
  // opengraph-image.tsx (shared card factory in lib/og.tsx).
  // No "political lean" here — migration 013 dropped the column precisely so
  // Sift stops characterizing organizations. The description shouldn't keep
  // advertising a field the page no longer has.
  return dossierMetadata({
    title: `${org.name} — Org dossier`,
    description: `Governance, cited annual expenses, self-description, and FARA disclosure for ${org.name} on Sift.`,
    indexable: isPublishableOrg(org),
    ogType: "profile",
  });
}

export default async function OrgDossierPage({ params }: OrgRouteProps) {
  const { slug } = await params;
  const org = await getOrgBySlug(slug);
  if (!org) notFound();
  // Filed 990 edges, matched by the EIN inside the org's ProPublica link.
  // Guarded so a funding-table miss degrades to a dossier without the
  // sections rather than a broken page — same posture as the lead-story
  // and outlet-map fetches on the landing route.
  // getFundingEdgesForOrg already swallows the one expected failure (a local
  // DB predating migration 027). Anything reaching here is unexpected, so it
  // gets reported before the page degrades — a silent catch turned a broken
  // query into an org that simply appears to fund nobody, which is the one
  // wrong impression these sections must never leave.
  const funding = await getFundingEdgesForOrg(
    einFromOrgLinks(org.externalLinks),
  ).catch((err) => {
    reportError("page.orgDossier.fundingEdges", err, { extra: { slug } });
    return undefined;
  });
  return (
    <>
      <JsonLd data={orgJsonLd(org)} />
      <OrgDossier org={org} funding={funding} />
    </>
  );
}
