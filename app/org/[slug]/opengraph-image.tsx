import { getOrgBySlug } from "@/lib/db";
import { OG_SIZE } from "@/lib/og";
import { createDossierOgImage } from "@/lib/ogImage";
import { formatOrgTypeLabel } from "@/lib/org";

// Satellite-cached with its dossier (24h). Rendering an OG card is one of the
// most CPU-expensive things this app does per invocation, and the card is
// derived from the same slow-moving profile row the page is — there is no
// version of this image that needed re-deriving every 30 minutes.
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Organization dossier on Sift — the news, with footnotes";

export default createDossierOgImage({
  eyebrow: "Organization dossier",
  load: ({ slug }: { slug: string }) => getOrgBySlug(slug),
  // No budget figure here — annualBudgetKind exists because the number means
  // different things per source, and a card can't carry that citation.
  card: (org) => ({
    title: org.name,
    meta:
      [
        formatOrgTypeLabel(org.type),
        org.faraRegistered ? "FARA-registered" : null,
      ]
        .filter(Boolean)
        .join(" · ") || null,
  }),
});
