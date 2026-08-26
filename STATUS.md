# Sift — STATUS

**Updated:** 2026-08-25
**Tier:** v1.5 (civic-literacy pivot) — **feature work active** (un-paused 2026-08-05)
**Velocity:** **27 PRs merged 2026-08-05** (24 `sift-api`, 3 `sift`) — the largest single day in the project's history, against a six-week gap that ended 2026-07-30. By month: Mar 44 · Apr 39 · May 51 · Jun 13 · Jul 3. This line has twice been wrong in the *optimistic* direction (it read "High (10+ PRs / week)" through eight weeks of near-zero — see [`docs/LAUNCH_DECISION_MEMO.md`](./docs/LAUNCH_DECISION_MEMO.md) §2.5); treat a single day as a day, not a baseline.

> **Feature work is no longer paused** (2026-08-05). The evidence-only posture D46 set held from 2026-07-27 and is now lifted; the passage that used to sit here — arguing the 2026-07-30 commits fit inside it "on a technicality" — described a constraint that no longer applies.
>
> **What has not changed: the week-one librarian / policy-staffer test still has not been run.** Un-pausing the build does not answer Q1–Q3, and shipping is still the more comfortable of the two jobs. The difference is that this is now a sequencing question rather than a prohibition.

## Active focus

**Sourcing the dossier corpus, and the outreach that tests whether anyone wants it.** The two are no longer exclusive.

Shipped 2026-08-05 — the uncited-claims class of defect is closed across every population it appeared in:

- **111 rows cleaned of uncited prose about living people.** 102 executive / foreign-executive rows (migration 015) and 9 Supreme Court Justices (016), all traced to one un-merged branch's hand-run seeders on 2026-05-20, which also produced the 93 agency org rows 013 had already fixed. `docs/OPERATING_CONTEXT.md` §5 forbade all of it.
- **69 dossiers now publish**, gated on sourcing rather than on chamber: 47 U.S. executive, 13 foreign, 9 Justices — plus 7 intergovernmental organizations as `org` rows. Sitemap **674 → 767 URLs** (the later growth is not all this work: other seeding landed the same day). *(Corrected: this line read "67" while itself listing 47 + 13 + 9.)* Every claim-bearing field is paired with the record that backs it, dropped in the parser if the source is absent.
- Alongside: the linker's regex pre-gate, the cost breakdown, Neon retention, and `init.sql` finally describing all 15 tables.

**Next, in order.** The **~10-hour week-one test** (`LAUNCH_DECISION_MEMO.md`) is still the action that answers Q1, Q2 and Q3, and it is still unrun. Its prerequisites are now *all* met — B1/B2/B7 and B6 are done, and the dossier set it would point at is both larger and defensible. Nothing is blocking it except doing it.

Paused, preserved, not deleted: Android v1 (see Recent decisions), the sift-mcp→sift-api merge ([`sift-api#62`](https://github.com/kristenmartino/sift-api/issues/62)), Ask Sift + Refined Compare ([`sift-api#63`](https://github.com/kristenmartino/sift-api/issues/63)), theme migration 2E QA.

## Open strategic questions

### 1. Is there enough product here to launch?

Raised by the panel and not settled. The strategic thesis (`OPERATING_CONTEXT.md` §2) is that the dossier dataset is the sellable asset.

> ⚠️ **This paragraph has now been corrected twice.** A version of it was fixed in [#203](https://github.com/kristenmartino/sift/pull/203) and reverted by a later merge, restoring figures that were wrong by an order of magnitude in places. If you are about to quote a dossier count from this file, query the tables instead — `data/*.csv` and this paragraph have both been wrong.

**Verified against prod 2026-08-07:**

| | Stated here until 2026-08-07 | Actually in prod |
|---|---|---|
| politicians | 536, all sitting Congress | **649** — 437 house, 100 senate, 56 executive, 46 foreign-executive, 9 scotus, 1 former |
| orgs | 25 | **110** |
| bills | **one** | **25** |
| outlets | 72 | 72 ✓ |
| `interest_group_ratings` | empty on all rows | **531 carry an LCV 2025 score**, each with its year and source URL |

Still true and still the weak part: PAC figures are from the 2022 cycle (OpenSecrets API discontinued Apr 2025) — the page now says so rather than implying currency, see Data integrity item 3, but the figures themselves have not moved — there is no automated refresh on any profile table, and the LCV scorecard is **one advocacy group's** — a conservative counterpart was attempted and is not obtainable, so the page says "Advocacy-group scorecards" rather than claiming a general rating.

The honest inventory is now: a real org dataset, a public directory that got materially deeper (649 politicians, 531 with a sourced third-party score, 47 executives on primary records), a small-but-real bill set, and one commodity not yet licensed. **Added 2026-08-17: a fifth type, `term`, with 24 rows, all 24 published** (this line said 4 for the few hours between the route landing and the terms being curated). Reported as a flat count rather than folded into a headline number, because the sourcing is hand work and the table grows at the speed of that work, not of a seeder — every definition is a human reading a statute and writing two sentences. It is the first dossier type whose value is not the row: the definition is the commodity half (Cornell already wrote it) and the corpus coverage is the half nobody else can assemble. If the week-one test says the dossiers are too thin, this is the shape of the answer — depth from what Sift already holds rather than more rows. The week-one test still answers this question, and it still has not been run.

**"What changed" on a developing story — candidate feature, not committed.**

Surfaced 2026-07-27 while checking whether Sift already had one. **It does not, and the current architecture forecloses it** — recording the mechanics here so this isn't re-investigated later:

- [`workflows/story_workflow.py:210`](https://github.com/kristenmartino/sift-api/blob/main/workflows/story_workflow.py) derives `story_id = sha256(sorted article IDs)[:16]`. Identity is a hash of **the article set**, so a story that gains a fourth outlet becomes a *different* story, not an updated one.
- Lines 166–173 NULL `story_id` for every article in the category inside the window each run, then re-cluster from scratch ("articles may have been re-clustered differently").
- The `ON CONFLICT (id) DO UPDATE` upsert therefore rarely fires; the prior story row is orphaned once its articles repoint.
- `RECENCY_WINDOW_HOURS = 48` — older coverage leaves threading entirely.
- **No prior version is retained anywhere.** `stories` has single `headline`/`summary` columns, `articles` a single `summary`; no history table, no revision column. Every re-synthesis overwrites and discards. A three-day story is re-synthesized ~144 times and leaves no record of what it used to say.

**Why it's worth keeping on the list:** it is the natural companion to "the news, with footnotes," it is commentary *on* coverage rather than a substitute for the article (a better legal posture than the summarizer per `LAUNCH_DECISION_MEMO.md` §2.2b/§3.6), and one hard part already exists — [`workflows/compare_workflow.py:225–228`](https://github.com/kristenmartino/sift-api/blob/main/workflows/compare_workflow.py) already extracts claims tagged `unanimous | majority | disputed | unique`.

**Why it is NOT next:** it fails the test set in D46 — *does this add a row to the asset the strategy says is being sold?* It doesn't. Building it now would be the third consecutive quarter of shipping product instead of finding out whether anyone wants it, and the memo's pre-mortem sentence that is already true is *"the dossier dataset ended the quarter exactly as it began."*

**How it gets decided for free:** add one line to the week-one test email — *"would 'what changed since yesterday' on a developing story be useful to you?"* Evidence at zero build cost. Real scope if it ever proceeds: a thread identity independent of the article set (centroid- or entity-based, not a content hash), retained prior syntheses, and a diff surface — schema + workflow + UI, not a feature flag.

**Geographic scope of civic content + monetization timeline.**

The geographic question closed 2026-08-05; monetization timing has not. The frame around both changed on 2026-07-27 and the old framing is no longer the right one to reason from.

**What's superseded:** native platform direction was resolved 2026-05-20 as **Android-first** (Path A from [`docs/IOS_VS_ANDROID.md`](./docs/IOS_VS_ANDROID.md)), and this section previously asked whether Android-first "holds longer-term or eventually pairs with iOS-as-second-platform." **D46 paused Android entirely**, so that question is not live — there is no native platform direction to hold or pair while both clients are paused. The 2026-05-20 reasoning stands on its own terms and is preserved in [`docs/IOS_VS_ANDROID.md`](./docs/IOS_VS_ANDROID.md) and [`DECISIONS.md` D32](./docs/DECISIONS.md); it simply isn't what's being decided now. Re-open it only if the un-pause condition in [`sift-android/STATUS.md`](https://github.com/kristenmartino/sift-android/blob/main/STATUS.md) is met — a wedge whose behavior is mobile-shaped, *and* real replies to the week-one test.

**What's actually still open, re-framed as web questions:**

- ~~**Q8 — US-only or global civic content**~~ **CLOSED 2026-08-05 — global**, entered through IGO founding treaties rather than more foreign heads of state. See [`DECISIONS.md` D47](./docs/DECISIONS.md); full original evidence archived in [`docs/STATUS_ARCHIVE.md`](docs/STATUS_ARCHIVE.md).
- **Q3 — monetization.** No `docs/DECISIONS.md` D-number settles this — its own OQ3 table row still lists monetization open ("Not until v1.5 KPIs validate D30 ≥ 20%"). The memo's current target is one paid pilot at $2,000–5,000 (a journalism school or public library, invoiced directly), not a consumer subscription; willingness-to-pay gets asked in writing in the week-one test. Full 2026-07-27 reframing archived in [`docs/STATUS_ARCHIVE.md`](docs/STATUS_ARCHIVE.md).

Monetization is answered by the same evidence the wedge question is waiting on, not by platform strategy.

**Rating system + entity coverage — how far past AllSides bias + MBFC factual?**

Surfaced 2026-06-01. The **neutrality rule**, the **"won't do" calls** (MBFC credibility, MBFC's bias scale, the "Questionable" flag — all re-introduce lean-as-value), and the plain-language `Bias rating:` / `Factual Reporting:` labels (#147) are settled in [`docs/DECISIONS.md` D37](./docs/DECISIONS.md). Still open: **MBFC country + press-freedom** (RSF / Freedom House) — the §3-clean expansion, "pursue when prioritized" (paid license + ToS) — and extending the dossier system to journalists / world leaders / a genre taxonomy. See OQ5 + D37 in [`docs/DECISIONS.md`](./docs/DECISIONS.md).

### 2. Should source credibility weigh on ranking — and if so, is that a rule we publish or a thumb we hide?

**Raised 2026-08-17, not settled.** Prompted by sift-api#227 (the New York Post filing more `world` stories than BBC World): should outlets that skew tabloid or shock-value rank lower, and should a story carried by only one source rank lower than a corroborated one?

**Two thirds of the instinct is already decided, and unbuilt.**

- *Downweight single-source stories.* Already sanctioned in spirit — D44's empirical scoring includes "marginal novelty (de-prioritize pure syndication overlap)". Corroboration judges the story's uptake, not the outlet's character, so it raises none of the questions below.
- *Steer readers toward more important news.* This is **D45**, DECIDED June 2026: rank by **civic impact, not coverage volume**. Its "Sift-native impact proxy — stories tied to a bill / policy / dossier" does the work without judging any outlet: a shark attack ties to no bill and sinks on its own merits. **The gap here is build, not decision.**

**The remaining third reopens a settled rule — one this file already states in stronger terms than D37's table row.** Question 1 above records the "won't do" calls as settled: *"MBFC credibility, MBFC's bias scale, the 'Questionable' flag — all re-introduce lean-as-value."* Lean-as-value is precisely what a tabloid-ness weight is. D37 itself says, verbatim, *"reject MBFC credibility/bias-scale"*, and D45's own pairing note draws the line: accessibility and neutrality are *"'serve the reader' signals, **not editorial value judgments**"*. Weighting by tabloid-ness is an editorial value judgment. Taking it means **reversing D37 explicitly**, not adding a coefficient to a ranking formula.

**The distinction that makes it answerable: a published gate versus an invisible weight.** Sift already judges source credibility — D44 applies an **MBFC factual floor** as a hard gate ("exclude Low / Very-Low / Questionable"). So "never judge sources" is not the standing position. A gate is binary, applied once at curation, and publicly stateable on `/methodology`. A per-story ranking weight is continuous, invisible, and applied to everything a reader sees. A serious publication can defend the first in print. The second has to be either published or concealed, and concealing it is the part that fails.

**The specific case does not support the specific fix.** The Post is inside the curated set, which means it *passed* the factual floor. The finding in #227 is not low credibility — it is that local crime is being **misfiled into `world`** by the summarizer, confidently rather than by fallback. Fix the classifier and the problem leaves the tab without any ranking change. Installing a source weight now would be **compensating for a bug with a policy**, and the policy would outlive the bug with nobody remembering why it is there. This trap has already been sprung once one layer up: sift-api#227 records that "ranking was the symptom; this is one of the causes."

**Measured 2026-08-17, and this is the finding that most constrains the answer: the lower-factual outlets are disproportionately how Sift has any right-of-centre coverage at all.** From `sift-api/data/outlet_profiles.csv` (57 rows), 8 sit at MBFC **mixed or below**:

| outlet | factual | lean |
|---|---|---|
| Fox News | **low** | lean-right |
| The Washington Times | mixed | lean-right |
| The Daily Caller | mixed | right |
| The Daily Wire | mixed | right |
| The Federalist | mixed | right |
| New York Post | mixed | right |
| MSNBC | mixed | left |
| The Free Press | mixed | (none) |

**Six of the eight are right or lean-right; one is left.** Set against the whole file — center 15, lean-left 11, left 8, lean-right 5, right 5, 13 unrated — that means **6 of the 10 right-of-centre outlets are mixed-or-below (60%), against 1 of 19 on the left (5%).**

So a factual-rating weight would remove roughly **60% of the right-of-centre supply and 5% of the left's**. That is not a subtle skew; it would gut one side of the spectrum in a product whose pitch is showing the spectrum. The probable cause is structural rather than a Sift oversight — the set of highly-rated right-of-centre outlets is small, so carrying any right coverage means carrying Mixed — but the consequence for this proposal is the same either way.

**Two live tensions this surfaces, independent of the ranking question:**

- **Fox News is rated `low`, and D44's hard gate says to exclude Low / Very-Low / Questionable.** The gate was written for the ~200 expansion (sift#151, not yet run), so this is not a violation today — but when #151 runs, either the floor drops the largest right-of-centre outlet by reach, or the floor gets revisited. Worth deciding before the expansion, not during.
- **`Inside Climate News` carries no `mbfc_factual` value at all**, so it is neither above nor below any floor.

**If it is ever taken, one thing must be instrumented from day one.** Tabloid-ness correlates with lean. D44 selects under a **spectrum-symmetry constraint** and D37 §3 targets a symmetric L/C/R distribution, which we publish (e.g. left 51 / center 45 / right 46 on `/term/temporary-protected-status`). Downweighting shock-value outlets will move that distribution; if it moves asymmetrically we have built a measurable partisan skew while `lib/copy.ts` says *"Never partisan. Never editorializing."* The precedent for refusing this is the LCV scorecard — a conservative counterpart was attempted, was not obtainable, and the page says "Advocacy-group scorecards" rather than claiming a general rating.

**Sequence, so the question gets asked against real numbers rather than an anecdote:**

1. Ship sift-api#227 and re-measure the `world` tab source mix.
2. Ask whether the problem still exists. Best guess: mostly gone.
3. If a gap remains, **build D45** — the decided-but-unbuilt civic-impact ranking.
4. Only if D45 proves insufficient, reopen D37 — and record it as a reversal.

**A narrower variant worth separating: ordering inside Compare.** Rather than weighting the feed, do not *lead* a Compare with a mixed-factual source even when it is included — the reader chose the set, so this is presentation order, not inclusion, and the factual rating is already displayed on the card (#147 / D37), so it hides nothing. **But the skew above applies here too, and more visibly:** ordering mixed-factual last puts the right-hand column last nearly every time, side by side where the pattern is legible. If Compare needs a defensible order, **order by spectrum position (left → right) or by publication time** — both are neutral, self-evident, publishable, and sidestep credibility ordering entirely.

**Deliberately not a GitHub issue**, per the CLAUDE.md decision tree: strategic questions get answered through usage and conversation, not engineering work. sift-api#71 ("do sports & entertainment belong in 'news with footnotes'?") is the same genre and the closest sibling.

## Data integrity — open, surfaced 2026-07-27 and 2026-08-17

Items 1 and 2 were found while applying migration 012 to prod; item 3 while fixing the politician-dossier caption gate ([#253](https://github.com/kristenmartino/sift/pull/253)); item 4 while cleaning up the think-tank org rows (2026-07-28). None blocks the week-one test; all four should be resolved before the dossiers go in front of people who read 990s and statutes for a living. Origin narratives for items 1, 3 and 4 are archived in [`docs/STATUS_ARCHIVE.md`](docs/STATUS_ARCHIVE.md).

1. **`org_profiles` seeder is still upsert-only and never prunes** (the D40 divergence — prod 103 rows vs seed CSV 25; discovery and the slug-remapping fix archived). Nothing prevents the same slug-collision failure recurring, and the CSV still doesn't describe the other 78 prod agency rows beyond the 15 remapped agencies. Prod backup at `sift-api/data/org_profiles.prod-backup-2026-07-27.csv`.

2. **Budget figures are unverified and at least one is wrong.** EPI's `annual_budget_usd` reads **$9,000,000**; EPI's own About page states a **2024 operating budget of $13.3M**. Not corrected — the budget column is cited on-page to ProPublica 990 data, and substituting a self-reported fundraising figure would break that provenance without resolving which is right. The same doubt applies to the other nine think-tank budgets, and to agency budgets, where prod and CSV disagree outright (EPA: prod **$36.97B** vs CSV **$10B**, neither verified). **Do a single pass against ProPublica/990s and decide what the column means** — filing-year figure vs self-reported operating budget — before publishing.

3. **PAC contribution data is four years stale; the page discloses it but the data has not moved.** Sampled 180 of the 533 published congressional rows on prod — every one has 2022 data populated, so this is what the corpus shows a reader today. **Half shipped 2026-08-17** ([#257](https://github.com/kristenmartino/sift/pull/257)): a note under the industries list attributing the figures to OpenSecrets' 2022-cycle bulk release and saying they aren't refreshed between releases. **The reader-facing half of this item is closed; the stale data is not.** The blocker is upstream availability, not a lookup — OpenSecrets' bulk file listing is gated behind an account requiring signup and manual approval, and a user reported that queue unresponsive since 2026-07-09 with no staff reply (full narrative — including the bot-blocking-vs-auth-wall correction and the Stanford DIME evaluation that ruled DIME out as a substitute — archived). Tracked as [#251](https://github.com/kristenmartino/sift/issues/251) (the year is still hardcoded, so the drift recurs in 2028) and [`sift-api`#254](https://github.com/kristenmartino/sift-api/issues/254) (the re-import, the blocking half — D35 puts the write path there). The schema question belongs in the same pass: the source file carries a `cycle` column, so storing it beside the data would let the label be derived rather than hardcoded.

4. **`founded_year` on the 93 agency rows is unverified.** All 93 have it, and it is still rendered and still unsourced. Not dropped like the think-tank rows' version, because this population has different provenance — its budget figures are precise to the dollar and include a negative, so it looks like real extraction rather than fixtures. **It has not been verified.** Founding is often already stated, with a citation, inside `governance_structure` (EPA: *"began operations on December 2, 1970"*), so the separate field may be redundant as well as unsourced.

## Next 3 — moved to GitHub

**This section is gone deliberately.** The concrete failure mode already happened once without it being enforced: `Blocked-on` carried "Triage of `sift-api` #62 (merge) and #63 (Ask Sift + Refined Compare) into the sequenced roadmap" since at least 2026-05-20 (the day both issues were opened, per Recent decisions), and as of this file's 2026-08-17 update both were still sitting untriaged in `Active focus`'s "Paused, preserved, not deleted" list — three months of a hand-maintained line promising a triage that never happened, with nothing in this file or on GitHub enforcing it.

    gh issue list --state open            # the engineering queue
    gh pr list --state open               # in flight

Priority lives in issue labels and effort tags. **Non-engineering next actions — outreach, conversations, anything
CLAUDE.md's "where to file new work" table says never becomes a GitHub issue (like the week-one test email send) —
live in Active focus above, not here.** This file is a decision log, not a queue.

## Blocked-on — moved to GitHub

**Also gone deliberately.**

    gh issue list --state open --label blocked

### What this file is for

STATUS.md holds no current state of its own. Current state lives in GitHub issues/PRs, and in Active focus above
(bounded, current, rewritten not appended). What has no home in GitHub is the cross-issue record — we measured X,
it refuted Y, here is why we did not do Z — and architecture-level decisions promote further into
[`docs/DECISIONS.md`](docs/DECISIONS.md). An entry below describes what was true on its date and is never edited
to stay current.

## Recent decisions (last 7 days)

**Entries before 2026-08-13 are archived** in [`docs/STATUS_ARCHIVE.md`](docs/STATUS_ARCHIVE.md). This section
held 37 entries going back to 2026-05-20.

- **2026-08-25** — **Dossiers are prebuilt and middleware is scoped to the seven paths that read a session** ([`docs/DECISIONS.md`](./docs/DECISIONS.md) D62). Vercel warned the Hobby team was at **75% of its 4-hour Fluid Active CPU** allowance. A 24h log sample found **822 middleware + 816 function invocations against 10 cache entries**, spread across **783 distinct paths at ~1 hit each** — a crawler walking the sitemap it was built to attract. `revalidate = 1800` was already on every dossier and was losing anyway: nothing was prebuilt, each of ~650 URLs is its own cache entry so a 30-minute TTL never survives to the next sweep, and the old catch-all matcher ran Clerk on all of them — a cost an ISR hit does not avoid. Fixed by `generateStaticParams` (derived from the existing publish-floor query, not a third copy of it), TTLs sized to the crawl interval, and a matcher listing only the paths that call `auth()`. **Per-project CPU attribution is inferred from traffic, not read from the usage meter** — no API exposes it.

- **2026-08-17** — **`@testing-library/jest-dom` bumped to 7.0.0; `typescript` stays pinned at 6.0.3 — TS 7's compiler API broke the suite's own integrity guard.** ([#195](https://github.com/kristenmartino/sift/pull/195) merged; [#194](https://github.com/kristenmartino/sift/pull/194) left open.)

  jest-dom 7 was a clean bump — its only breaking changes (`@testing-library/dom` now a required peer, Node floor raised to 22) were already satisfied here, and the full suite plus `tsc --noEmit` passed unchanged.

  TypeScript 7.0.2 is not routine: it's the native-compiler rewrite, and its package now maps the default `"typescript"` import to a version-string stub — the compiler/AST API moved to explicitly-labeled `typescript/unstable/ast/*` subpaths in a different shape entirely. `__tests__/meta.test.ts` (the #267 guard that checks the test suite can actually fail) uses `ts.createSourceFile`/`ts.isCallExpression`/`ts.forEachChild` and broke outright — 50 `tsc` errors, and at runtime the suite crashes on load (`Cannot read properties of undefined (reading 'Latest')`); the other 57 suites / 874 tests were unaffected. Porting the guard to the new `unstable` API is a real rewrite against a surface Microsoft itself calls unstable, not an annotation fix — exactly the "large refactor smuggled into a dependency bump" this kind of PR should never carry, so it's pinned rather than forced through. Also found en route: `ts-jest` was a dead `devDependency` (never wired into `jest.config.ts`, which uses `next/jest`'s SWC transform). No interaction found with `@types/node@26` (#196) — every TS7 error traces to the compiler-API move, none to Node's types.

  **Three corrections to the paragraph above, 2026-08-18.** ~~`ts-jest` … removed~~ — it was removed *on the #194 branch*, which never merged, so it sat on `main` for another day; actually retired in #279. ~~its peer range `typescript@">=4.3 <7"` was blocking `npm install` outright~~ — under npm 11.16.0 with `strict-peer-deps` off, `npm install typescript@7.0.2 --dry-run` succeeds with `ERESOLVE overriding peer dependency`. It is a warning and an override, not a hard failure. And the entry names the meta-guard port as *the* blocker, which understates it: **`@typescript-eslint` 8.60.0 peer-requires `typescript >=4.8.4 <6.1.0` across 13 packages**, and since #275 made `npm run lint` a required check, that ceiling binds harder than the guard does. Porting `meta.test.ts` first would unblock nothing. The order is: typescript-eslint ships TS 7 support, then the guard. Encoded as a dependabot `ignore` in #279 so the decision stops being re-proposed weekly.

  **The guard is now ported anyway** ([#289](https://github.com/kristenmartino/sift/pull/289), 2026-08-20) — `__tests__/meta.test.ts` no longer touches TypeScript's own compiler API at all. Rewritten against `@typescript-eslint/typescript-estree`'s stable ESTree AST, which wraps whichever `typescript` is installed rather than depending on its internal shape, so this class of breakage can't recur on a future TS major either. Same checks, same thresholds, verified equivalent (same ~847 tests found across 58 files). This doesn't unblock #194 — the `@typescript-eslint` peer ceiling still does, and that's still not ours to fix — but it does mean the ordering note above ("typescript-eslint ships support, *then* the guard") is now moot: the guard was the cheaper half and there was no reason to wait. `#194` itself closed 2026-08-18 (dependabot auto-closed it once #279's `ignore` landed); `#271` closed via #289.

  Follow-up tracked at [#271](https://github.com/kristenmartino/sift/issues/271): rewrite `meta.test.ts`'s AST walk against `typescript/unstable/ast/*`, or swap it to a different static-analysis approach (e.g. `@typescript-eslint/typescript-estree`, already in the tree transitively).

- **2026-08-18** — **CI now gates a merge in both repos, and both gate on their linter.** The finding recorded a day earlier is closed.

  `required_status_checks` rules are active on both `main` branches — **`Type Check & Test`** in `sift`, **`Lint & Test`** in `sift-api` — alongside `pull_request` and `non_fast_forward`. `sift`'s existing ruleset was extended rather than replaced; `sift-api` had **no protection of any kind** and now mirrors it, which means direct pushes to `main` no longer land there. `required_approving_review_count` stays at 0 (a solo maintainer requiring an approval blocks only themselves), and `strict` is off, so a moving `main` does not force a rebase on every PR. No bypass actors: a gate with a hole in it is the state this replaced.

  **It proved itself on the way in.** `sift-api`#262 went `BLOCKED` on push and only became `CLEAN` once `Lint & Test` reported — the same PR that, a day earlier, would have been mergeable red.

  **`sift` gained a `Lint` step** ([#273](https://github.com/kristenmartino/sift/pull/273)), which it had never had: `ci.yml` ran audit, `tsc`, jest and the production build, so the three ESLint errors sitting on `main` were invisible to CI and only ever surfaced by hand. Those are fixed in the same PR — two `react-hooks/set-state-in-effect` (`CoachStrip`, `NewsAggregator`) and an `<a>` to an internal route. `CoachStrip` now reads localStorage through `useSyncExternalStore` like `useTheme` does, and gained the test file its behaviour never had. `sift-api` already ran `ruff check .` inside its required job — verified in the Actions step log, not assumed.

  **The gate starts green in both repos, deliberately.** `eslint .` exits 0, `ruff check .` passes, 886 jest tests, 894 pytest. Switching a required check on over a known-red tree teaches people to bypass it.

- **2026-08-17** — ~~**The test suites were audited for whether they can fail, and CI does not gate a merge in either repo.**~~ **The gating half was closed 2026-08-18 — see the entry above.** The audit findings below stand as written; the claim that no `required_status_checks` rule exists is history.

  Audited ~110 test files / ~21k lines across both repos against one question: if the code under test broke, would the test go red? Most of it holds — `sift-api` has had `tests/test_meta_suite.py` failing the build on assertion-free tests since the `stable_hash` defect, and `security.test.ts`, `rate-limit.test.ts` and the cross-repo `$7.38` golden in `usage-tracker.test.ts` are the house standard. Every finding below was **proved by mutation before the test was touched**: break the source, confirm the suite stays green, rewrite, confirm it now goes red.

  **The most serious finding is not in a test file.** Neither repo has a `required_status_checks` rule. `sift`'s ruleset holds only `pull_request` (with `required_approving_review_count: 0`) and `non_fast_forward`; `sift-api` has no protection at all, so pushes land directly on `main`. Both `ci.yml` files carry comments written *for* branch-protection semantics — the path-filtered jobs already post green when skipped, which is the correct shape for a required check. It was never switched on, which makes every suite in both repos advisory. **Not fixed here:** it is a repository settings change rather than a code change, and it is a one-liner per repo once someone decides to run it — `gh api` against `/repos/{owner}/{repo}/rulesets` adding a `required_status_checks` rule naming `Type Check & Test` (sift) and `Lint & Test` (sift-api). It does not block the week-one test, so it does not displace anything on Next 3.

  **`/api/compare` had no working guards in test.** The route mocked `@/lib/rate-limit` and `@/lib/security` and then asserted on the values it had just configured; `mockRateLimit` was never referenced by a single assertion and there was no 429 test. Deleting the entire limiter left all six tests green, as did `maxRequests: 5000`, keying the limiter on a constant instead of `userId`, moving `checkCsrf` after `auth()`, and `"X-Pipeline-Key": ""` — that last because presence was asserted with `toBeDefined()` and `SIFT_API_KEY` defaults to `""`. Each request is a 20–90s LLM job upstream, so this is both the abuse vector and the cost ceiling.

  **No fixture in `api.test.ts` contained an HTML tag,** so all six `stripHtml` call sites in the news route could be deleted with the suite green — the one sanitization boundary in the app with no call-site coverage, on LLM-synthesized text that reaches the client render path. `spectrumBuckets` appeared nowhere in the suite at all.

  **Two new guards, because a rule beats a fix.** `__tests__/meta.test.ts` is the frontend counterpart to `sift-api`'s meta-suite plus the check that file lacked — a test can assert and still be unable to fail. It catches assertion-free bodies, self-comparisons (`expect(f(x)).toBe(f(x))`, the original form of the `stable_hash` defect, which neither that suite nor any lint rule sees), and duplicate names within a `describe`. And Stryker now runs by hand over five pure, high-consequence modules (`npm run mutate`, ~80s), scoring **85.34%** on its first run — the same doctrine as `sift-api/setup.cfg`, deliberately not in CI. It immediately earned its place: `t > cutoff` → `t >= cutoff` in the rate limiter survived the whole suite because no test sat on the window boundary.

  **Deliberately not done:** the coverage gaps, as opposed to the validity gaps. `app/api/topics/generate/route.ts` and `app/api/news/topic/route.ts` (663 lines, billed Anthropic web search, three rate limiters, CSRF, `hashIp`) still have **no tests at all** — invisible today because the jest `global` threshold is ratcheted at 15–18%. And `app/api/sign-out/route.ts` has no `checkCsrf`, so nothing would catch a forced-logout CSRF; that one is a source defect, not a test defect. Both are filed rather than fixed.

- **2026-08-17** — **DIME cannot replace the industry data, but it can answer the adjacent question — and that half is unblocked.** ([`sift-api`#260](https://github.com/kristenmartino/sift-api/issues/260) writes it, [#264](https://github.com/kristenmartino/sift/issues/264) renders it.)

  Re-examined Stanford's DIME after ruling it out as an industry source. The rejection stands for industries and nothing about it is close — no classification field in any tier. But the recipients file carries something Sift does not have and cannot get from OpenSecrets today: **FEC-reported fundraising composition**, per candidate per cycle. Total raised, itemised vs unitemised individual, PAC, party, self-funding, outside spending for and against, and distinct-donor count.

  **Validated rather than assumed**, because the last two weeks were about figures that had moved: Warnock 2022 reads **$206,593,948** and Ossoff 2020 **$156,146,538**, matching the known public totals for those races; **524 of 537** current members join via `Cand.ID` → `congress-legislators` FEC id → bioguide (ICPSR is only 319/537 and is the wrong key); 100% fill on every money field for 2020, 2022 and 2024. ODC-BY 1.0, so commercial use is permitted with attribution — unlike the OpenSecrets lane.

  **Why it is arguably the better section.** The industry feature depends on someone's editorial judgement about which industry a committee belongs to, which is exactly the part that is proprietary and gated. Composition is arithmetic over filings, which is why it is openly licensed — and it reads better: "84% from individuals, most of it unitemised, 1% from PACs" is a story a reader can follow, where "Securities & Investment: $250,000" is not. It is also current through 2024 against the 2022 figures on the page now.

  **The trap is the one we just spent the day removing.** Warnock's 2024 row reads $4.8M — off-cycle committee activity, not a campaign. A panel labelled "2024 cycle" would print a technically-true, badly-misleading figure about a named living person, which is the caption bug in a new costume. #264 records that constraint plus six others: derive the cycle from data, show the 6.3% remainder rather than letting the visible slices imply the whole, treat itemised and unitemised as additive, do not characterise, distinguish "none recorded" from "none", and render nothing for the 13 members who do not join.

  **Deliberately rejected:** the CFscores. `composite.score` is built by multiple over-imputation plus PCA — a modelled composite, which is what D37 says Sift does not derive or characterise — and a bare `-0.412` cannot be made meaningful to a reader without characterising it. `dwnom1` is 28% filled regardless. The tempting part is the part to leave.

- **2026-08-17** — **A dossier caption told foreign heads of state their PAC data was missing, and the fix exposed a wider staleness.** ([#253](https://github.com/kristenmartino/sift/pull/253), [#257](https://github.com/kristenmartino/sift/pull/257))

  The "not yet enriched" caption was gated on `!hasOffice` — i.e. `!Boolean(role.roleTitle)` — as a proxy for "is a member of Congress". That proxy asks only whether a row carries a *sourced statutory title*, and ~33 of the 46 foreign-executive rows do not. So Kim Jong Un's dossier, and every other unsourced foreign row plus unsourced executive and scotus rows, read: *"PAC contribution data isn't on file for the 2022 cycle — common for senators not on that year's ballot."* Now gated on chamber, via `isCongressionalChamber` mirroring the house/senate arm of `isPublishablePolitician`. **Verified on prod:** `/politician/FOREIGN-KIM-JU` renders the lede fallback and no caption.

  **The proxy's second failure was larger and quieter.** "Common for senators not on that year's ballot" is true for the Senate — a third of seats per cycle — and false for the House, where every seat is on every ballot. 437 of 649 rows are House. Split so only senators get the rationale.

  **The tests that looked like coverage were not.** The existing case flipped `chamber` to `"senate"` *and* blanked the role, but its assertion turned only on the blanked role — the chamber change was decorative, and `"foreign-executive"` would have passed it. The two new regression cases were confirmed load-bearing by restoring the old gate and watching them fail.

  **Then the honest-label question.** Prod sampling showed the caption almost never fires on congressional rows — every one of 180 sampled has 2022 PAC data — so its entire practical appearance was on the rows where it was wrong. What *does* render everywhere is "(2022 cycle)" with no qualification, four years on. #257 says plainly what the figure is and that it does not refresh, rather than waiting on an upstream release that may not come. See Data integrity item 3 for the blocker and why Stanford's DIME does not substitute.

- **2026-08-17** — **The landing's fallback comparison put invented sentences in three real outlets' mouths** ([#261](https://github.com/kristenmartino/sift/pull/261)). The static block shown when sift-api has not generated a comparison named Reuters, the WSJ and Bloomberg, quoted a written line from each, and stamped every one "AllSides: Center" — a rating applied to something never said. Reachable, not dead code: a null from `getDailyCompareExample()` on an empty table, malformed payload, missing relation, or DB outage is what a visitor sees on a first deploy or a bad database day. Frames now carry generic roles, no lean chips, and a note saying the lines are written rather than quoted.

- **2026-08-17** — **The term layer got its vocabulary, its real coverage signal, and a front door** ([`docs/DECISIONS.md`](./docs/DECISIONS.md) D57, D58). Three merges on top of the route itself: 20 more curated terms (4 → 24), the primer union that made them countable, and `/glossary`.

  **Every citation was refetched and asserted to name the term before a definition was written**, the discipline `verify_role_sources.py` established. Two of 22 candidates failed and were dropped rather than guessed at: `law.cornell.edu/wex/gerrymandering` 404s (the slug is `/wex/gerrymander`), and no fec.gov URL for Super PAC could be verified at all, so **there is no Super PAC row**. Both were URLs that would have been written confidently from memory. Sources are Cornell LII, the U.S. Code, the Constitution, 28 CFR and senate.gov.

  **The coverage signal was measuring the wrong thing, and failing hardest where it mattered most.** It searched title and summary only — but the terms worth a page are what a journalist writes in paragraph nine, not the headline. Measured: prior restraint **0** headline matches against **128** primer definitions, certiorari 5 vs 83, qualified immunity 6 vs 75, cloture 0 vs 45. Migration 033 indexes the primer's term list (an IMMUTABLE function, because the generator's casing is inconsistent and plain jsonb containment is case-sensitive), and coverage now unions the two. **20/24 above the floor → 24/24**, nothing lost. The primer is the *higher-precision* half — its generator read the article, the regex only sees a string — but it still cannot define anything: all primer terms carry `source: null` — 72,856 of them at the time of writing, and the count that matters is the zero. The page says out loud that the count includes stories flagged by Sift's reading notes, because the story list now visibly contains pieces that never print the term.

  **`/glossary` leads with the finding.** Across the 24 terms, **~1,030 of ~4,830 stories turn on a term the coverage never names** — about 1 in 5, and for prior restraint and cloture every single story. Computed live rather than written in, which is why the deployed page reads 1,034/4,833: the corpus grew between the PR and the deploy. Route is `/glossary` because `/terms` is the ToS; the copy key is `termIndex` because `COPY.glossary` was already the inline entity-chip layer and reusing it silently shadowed that namespace.

  Also fixed in passing: `/civic`, `/agencies` and `/think-tanks` had been serving `... — Sift | Sift` in prod, hardcoding the brand into a title that `app/layout.tsx` already templates. Eight wasted characters of a ~60-character SERP title, on the pages built for search.

  **The ceiling, named now rather than discovered later:** `/glossary`'s query recomputes per-article match state across the corpus — 785 ms at 24 terms, and it scales with the term count. Fine behind ISR today; at ~200 terms it needs a materialized coverage table refreshed by the pipeline. **1,442 distinct primer terms appear in ≥8 articles**, so that ceiling is nearer than the headroom suggests.

- **2026-08-17** — **A fifth dossier type: `/term/<slug>`, where the definition is the cheap half** ([`docs/DECISIONS.md`](./docs/DECISIONS.md) D55, D56). The route pairs a hand-sourced definition of a civic term with how Sift's own corpus is covering it. **The coverage half is the whole point.** Definitional search is unwinnable and this settles it with numbers rather than intuition — measured Wikipedia pageviews are 145,241/mo for Strait of Hormuz, 54,137 for prediction markets, 4,001 for TPS, and Cornell LII writes a better definition of a statute than Sift will. What nobody else has is which outlets are covering the term right now and where they sit on the spectrum. Live on prod data, `/term/temporary-protected-status` reads 146 stories from 23 outlets, left 51 / center 45 / right 46, filed April to August — with the same Somalia ruling carried as *"Trump scores major immigration victory"* (Fox News) and *"In Ohio, Haitians' American dream shatters"* (The Guardian) days apart.

  **The publish floor grew a new shape.** `isPublishableTerm` is the first predicate that reads a computed value rather than a column: a sourced definition **and** ≥8 corpus articles. Below that there is no coverage half and the page is a definition Cornell wrote and Sift re-stated — the "one row poured into a template" form the floor exists to keep out. ~~`prior-restraint` is the live counter-case: real term, cited to Cornell, **zero** corpus articles.~~ **Superseded the same day — and it was the floor's *input* that was wrong, not the floor.** Coverage counted only title/summary matches, so it could not see the 128 articles whose primer defined the term. With the primer counted (D57) `prior-restraint` publishes with 128 stories from 28 outlets, and all 24 curated terms clear the floor. Left struck through rather than deleted because "the floor correctly withheld a thin page" and "the signal under the floor was blind" look identical from the outside, and this file has twice been wrong by quoting a figure that had moved. ~~992 terms clear the threshold in the current corpus~~ — **corrected 2026-08-17: 1,442.** The 992 could not be reproduced from any predicate; re-measured as distinct primer terms appearing in ≥8 non-search articles. Either way the point stands and gets stronger: the floor is not what bounds how large this gets — editorial sourcing time is.

  The definitions are hand-written even though `articles.context_primer` already defines ~11,900 terms, because **every one of those has `source: null`**. A primer is an inline reading aid; a term page is a standalone claim about what a legal term means. Publishing the former as the latter is the defect 013 removed from `org_profiles` and 015 removed from the executive rows, and it would have been the third time.

- **2026-08-17** — **`source_name_aliases` was empty in prod, and the gap ran leftward.** Found while checking the new term page against real data: the table had **0 rows since it was created**. It looked fine because both `getRecentArticlesByOutletSlug` and `getTermCoverage` fall back to matching `outlet_profiles.name` directly, so the 43 outlets whose feed name equals their dossier name resolved anyway — and nothing anywhere reported the other **41.8% of articles**. A silent fallback masking a wholly unpopulated table is the same failure shape as D53's swallowed degrade, in a different place.

  **The misses were not random, which is what makes this a D37 matter rather than housekeeping.** Outlets filing under variant names — `The Guardian US`, `New York Times`, `Washington Post` — skew left; right-leaning outlets happen to file under their canonical names and were unaffected. Replayed on the TPS term page, seeding 14 hand-checked rows moved the left bucket **21 → 51** and center 39 → 45 while right stayed at 46, with unplaced dropping 40 → 4. Sift was under-reporting left coverage by 2.4x and presenting the result as a neutral spectrum readout. The page's own note made it worse by attributing the omission to AllSides not having rated those outlets, which is false — AllSides rates all three.

  Only the 14 rows that change behaviour are committed; the 43 exact-name matches `audit_source_aliases.py` also proposes are no-ops against the name fallback. Every row was checked by hand, because the audit's `substring` tier is a review heuristic and **not data** — it proposed `IGN → foreign-affairs`, matching "ign" inside "foreign", which would have filed a gaming site under Foreign Affairs and handed it that outlet's AllSides rating. This also widens `/outlet/*` recent-story lists and feed lean badges, a larger blast radius than the route that surfaced it.

- **2026-08-14** — **The Neon compute is allowed to sleep, and the cost table that said it was free is marked as the thing that went wrong** ([`docs/DECISIONS.md`](./docs/DECISIONS.md) D54). Measured `pg_postmaster_start_time()`: **26 days of unbroken uptime**. The compute had never once scaled to zero — **with scale-to-zero already enabled and the autoscale floor already at 0.25 CU**, both verified in the console, which is what makes the cause certain rather than plausible: a query must have landed inside every single 5-minute window. It was `sift-api`'s batch poller, which opened each 60-second iteration with a `SELECT` on `api_batches` *before* checking whether anything was pending, plus `/health`'s two queries every 30 minutes from the GitHub heartbeat. Both were asking Postgres a question the process already had in memory; both now answer from memory. **The intuitive diagnosis was wrong** — `asyncpg`'s `min_size` is not a connection floor (nothing refills the pool) and Neon suspends on absence of *queries*, not connections, so the pool config everyone reaches for first was never the cause.

  **Three corrections to what this repo believed about its own bill.** (1) Launch has **no included-CU-hour allowance** — compute bills from the first hour, so savings are linear and there is no threshold to get under. (2) **Storage was never the driver**: 2.11 GB at $0.35/GB-month is **$0.38/month**, so every action in `sift-api/docs/NEON_RETENTION.md` is hygiene worth cents, and it now carries a banner saying so. (3) The CU-hours are **shared across all four projects in the Neon org**, where `sift` was not even the largest (`cratedigger` was; a sibling, `tenancy`, sits Idle at ~$3/month — the shape `sift` should take). Expect ~$32/mo → ~$17/mo for `sift` once deployed; **confirm at +48h with `sift-api/scripts/verify_neon_idle.py`, do not assume.**

  Frontend changes are all defensive rather than causal: `connectionTimeoutMillis` (node-pg defaults to *wait forever*, which was harmless only while the compute never slept), `s-maxage` on `/api/news` so traffic cannot silently re-pin the compute, React `cache()` on the four dossier fetchers that each ran twice per render, and the `globalThis` pool singleton now cached in **production too** — the familiar `NODE_ENV !== "production"` guard disables duplicate-pool protection in exactly the environment that pays for it, since Next bundles the RSC and route-handler graphs separately. A sweep for other timers found none: the frontend has no client-side polling at all, and `sift-api`'s remaining loops are the 30-min pipeline and two daily monitors.

---

*See also: [`docs/STATUS_ARCHIVE.md`](./docs/STATUS_ARCHIVE.md) (archived decision-log history), [`docs/PROJECT_PLAN.md`](./docs/PROJECT_PLAN.md), [`docs/DECISIONS.md`](./docs/DECISIONS.md), [`docs/PRODUCT_STORY.md`](./docs/PRODUCT_STORY.md), [`docs/ANDROID_APP_v1.md`](./docs/ANDROID_APP_v1.md), [`CLAUDE.md`](./CLAUDE.md). Sibling repos: `sift-api` (backend), `sift-mcp` (MCP server — merging into sift-api per #62).*
