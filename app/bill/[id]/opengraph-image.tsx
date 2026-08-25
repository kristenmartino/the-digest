import { formatBillIdDisplay, formatBillStatusLabel } from "@/lib/bill";
import { getBillById } from "@/lib/db";
import { clampOgTitle, OG_SIZE } from "@/lib/og";
import { createDossierOgImage } from "@/lib/ogImage";

// Satellite-cached with its dossier (24h). Rendering an OG card is one of the
// most CPU-expensive things this app does per invocation, and the card is
// derived from the same slow-moving profile row the page is — there is no
// version of this image that needed re-deriving every 30 minutes.
export const revalidate = 86400;
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Bill dossier on Sift — the news, with footnotes";

export default createDossierOgImage({
  eyebrow: "Bill dossier",
  load: ({ id }: { id: string }) => getBillById(id),
  card: (bill) => ({
    title: bill.shortTitle ?? clampOgTitle(bill.title),
    meta: [formatBillIdDisplay(bill.billId), formatBillStatusLabel(bill.status)]
      .filter(Boolean)
      .join(" · "),
  }),
});
