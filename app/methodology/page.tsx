import type { Metadata } from "next";
import Link from "next/link";

import LandingMasthead from "@/components/landing/LandingMasthead";
import { getAllOutletProfiles } from "@/lib/db";
import { COPY } from "@/lib/copy";
import { bucketize, type CrossSpectrumBucket } from "@/lib/crossSpectrum";
import type { OutletProfile } from "@/lib/types";

export const metadata: Metadata = {
  title: "Methodology — How Sift sources the news",
  description:
    "How Sift selects outlets, surfaces ownership and funding, cites AllSides and MBFC ratings, and applies symmetric treatment across the political spectrum.",
};

// ISR — 24 hours, traced to this page's own declared `changeFrequency` in
// app/sitemap.ts (weekly or monthly). A 30-minute entry asserted a cadence
// several orders of magnitude faster than the one we advertise to crawlers.
export const revalidate = 86400;

type BucketKey = CrossSpectrumBucket | "unrated";

function bucketForList(rating: OutletProfile["allSidesRating"]): BucketKey {
  return bucketize(rating) ?? "unrated";
}

const BUCKET_ORDER: readonly BucketKey[] = [
  "left",
  "center",
  "right",
  "unrated",
];

export default async function MethodologyPage() {
  const outlets = await getAllOutletProfiles();

  // Group outlets into Left / Center / Right / Unrated. "mixed" + null
  // ratings land in `unrated` since AllSides treats both as
  // non-bucketable; the unratedNote in copy explains the distinction.
  const groups: Record<BucketKey, OutletProfile[]> = {
    left: [],
    center: [],
    right: [],
    unrated: [],
  };
  for (const outlet of outlets) {
    groups[bucketForList(outlet.allSidesRating)].push(outlet);
  }

  const m = COPY.methodology;

  return (
    <div className="min-h-screen bg-(--surface-base) text-(--text-primary)">
      <LandingMasthead />

      <main
        id="main-content"
        className="max-w-[800px] mx-auto px-6 pt-12 pb-24"
      >
        {/* Eyebrow + headline + lede */}
        <header className="mb-9">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-3 flex items-center">
            <span
              aria-hidden
              className="inline-block w-7 h-px bg-(--border) mr-3"
            />
            {m.eyebrow}
          </p>
          <h1 className="font-heading text-[36px] md:text-[44px] font-bold leading-[1.05] tracking-tight text-(--text-primary)">
            {m.title}
          </h1>
          <p className="font-body text-[16px] text-(--text-secondary) mt-3 max-w-[60ch] leading-relaxed">
            {m.lede}
          </p>
        </header>

        <hr className="border-0 border-t border-(--border) my-10" />

        {/* What Sift reads — live outlet list grouped by AllSides bucket */}
        <section className="mb-12">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-4">
            {m.sections.includes.kicker}
          </p>
          <p className="font-body text-[15px] text-(--text-secondary) leading-relaxed max-w-[60ch] mb-7">
            {m.sections.includes.body(outlets.length)}
          </p>
          {outlets.length > 0 ? (
            <div className="space-y-7">
              {BUCKET_ORDER.map((bucket) => {
                const list = groups[bucket];
                if (list.length === 0) return null;
                return (
                  <div key={bucket}>
                    <p className="font-body text-outlet uppercase tracking-wider text-(--text-primary) font-semibold mb-2.5">
                      {m.sections.includes.bucketLabels[bucket]} ({list.length})
                    </p>
                    <ul className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1.5">
                      {list.map((outlet) => (
                        <li key={outlet.slug}>
                          <Link
                            href={`/outlet/${outlet.slug}`}
                            className="font-body text-[13px] text-(--text-secondary) hover:text-(--accent) transition-colors no-underline tracking-tight"
                          >
                            {outlet.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {groups.unrated.length > 0 && (
                <p className="font-body text-[12px] text-(--text-tertiary) italic max-w-[60ch] leading-relaxed pt-2">
                  {m.sections.includes.unratedNote}
                </p>
              )}
            </div>
          ) : (
            // Graceful: outlet_profiles isn't populated yet (or table missing).
            // The page still reads as a methodology doc; the missing list is
            // an acceptable empty state rather than a broken section.
            <p className="font-body text-[14px] text-(--text-tertiary) italic max-w-[60ch] leading-relaxed">
              The curated outlet list will appear here once it&apos;s seeded.
            </p>
          )}
        </section>

        {/* What Sift excludes */}
        <section className="mb-12">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-4">
            {m.sections.excludes.kicker}
          </p>
          <p className="font-body text-[15px] text-(--text-secondary) leading-relaxed max-w-[60ch] mb-4">
            {m.sections.excludes.body}
          </p>
          <ul className="space-y-2.5 max-w-[60ch]">
            {m.sections.excludes.items.map((item) => (
              <li
                key={item}
                className="font-body text-[14px] text-(--text-secondary) leading-relaxed flex items-baseline gap-3"
              >
                <span aria-hidden className="text-(--accent) shrink-0">
                  ◆
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* Bias ratings explainer */}
        <section className="mb-12">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-4">
            {m.sections.bias.kicker}
          </p>
          <p className="font-body text-[15px] text-(--text-secondary) leading-relaxed max-w-[60ch] mb-3">
            {m.sections.bias.body}
          </p>
          <a
            href={m.sections.bias.citeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-meta text-(--text-tertiary) no-underline hover:underline hover:text-(--accent)"
          >
            {m.sections.bias.cite} <span aria-hidden>↗</span>
          </a>
        </section>

        {/* Factual-reporting explainer */}
        <section className="mb-12">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-4">
            {m.sections.factual.kicker}
          </p>
          <p className="font-body text-[15px] text-(--text-secondary) leading-relaxed max-w-[60ch] mb-3">
            {m.sections.factual.body}
          </p>
          <a
            href={m.sections.factual.citeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-meta text-(--text-tertiary) no-underline hover:underline hover:text-(--accent)"
          >
            {m.sections.factual.cite} <span aria-hidden>↗</span>
          </a>
        </section>

        {/* Symmetric application */}
        <section className="mb-12">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-4">
            {m.sections.symmetric.kicker}
          </p>
          <p className="font-body text-[15px] text-(--text-secondary) leading-relaxed max-w-[60ch]">
            {m.sections.symmetric.body}
          </p>
        </section>

        {/* Refresh cadence */}
        <section className="mb-12">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-4">
            {m.sections.cadence.kicker}
          </p>
          <p className="font-body text-[15px] text-(--text-secondary) leading-relaxed max-w-[60ch]">
            {m.sections.cadence.body}
          </p>
        </section>

        {/* Suggest an addition or correction */}
        <section className="mb-12">
          <p className="font-body text-kicker uppercase text-(--text-tertiary) mb-4">
            {m.sections.suggest.kicker}
          </p>
          <p className="font-body text-[15px] text-(--text-secondary) leading-relaxed max-w-[60ch] mb-3">
            {m.sections.suggest.body}
          </p>
          <a
            href={m.sections.suggest.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-body text-meta text-(--text-tertiary) no-underline hover:underline hover:text-(--accent)"
          >
            {m.sections.suggest.github} <span aria-hidden>↗</span>
          </a>
        </section>

        <hr className="border-0 border-t border-(--border) my-10" />

        {/* Back link */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/"
            className="font-body text-outlet uppercase tracking-wider text-(--text-secondary) hover:text-(--accent) transition-colors no-underline inline-flex items-center gap-1.5"
          >
            <span aria-hidden>←</span> {m.backLink}
          </Link>
        </div>
      </main>
    </div>
  );
}
