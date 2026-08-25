import { getOutletBySlug } from "@/lib/db";
import { OG_SIZE } from "@/lib/og";
import { createDossierOgImage } from "@/lib/ogImage";
import {
  formatAllSidesLabel,
  formatFundingLabel,
  formatMbfcLabel,
} from "@/lib/outlet";

// Satellite-cached with its dossier (24h). Rendering an OG card is one of the
// most CPU-expensive things this app does per invocation, and the card is
// derived from the same slow-moving profile row the page is — there is no
// version of this image that needed re-deriving every 30 minutes.
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Outlet dossier on Sift — the news, with footnotes";

export default createDossierOgImage({
  eyebrow: "Outlet dossier",
  load: ({ slug }: { slug: string }) => getOutletBySlug(slug),
  card: (outlet) => {
    // Ratings are attributed to their raters and rendered in neutral ink —
    // same rule as the on-page chips.
    const allSides = formatAllSidesLabel(outlet.allSidesRating);
    const mbfc = formatMbfcLabel(outlet.mbfcFactual);
    return {
      title: outlet.name,
      meta:
        [
          formatFundingLabel(outlet.fundingModel),
          outlet.parentCompany ? `Parent: ${outlet.parentCompany}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      chips: [
        allSides ? `AllSides: ${allSides}` : null,
        mbfc ? `MBFC factual: ${mbfc}` : null,
      ],
    };
  },
});
