import { cache } from "react";
import { Pool } from "pg";

import { isMissingColumn, isMissingSchemaObject } from "./dbErrors";
import { TERM_MIN_ARTICLES } from "./publishFloor";
import { reportError } from "./observability";
import { parseDbOrgProfile, type DbOrgProfileRow } from "./org";
import { hasPartisanBalanceCap } from "./agencies";
import { claimsNonPartisanship } from "./thinkTanks";
import { parseDbBillProfile, type DbBillProfileRow } from "./bill";
import { parseDbOutletProfile, type DbOutletProfileRow } from "./outlet";
import {
  parseDbTermProfile,
  termPatterns,
  type DbTermProfileRow,
  type TermPattern,
} from "./term";
import {
  parseDbPoliticianProfile,
  type DbPoliticianProfileRow,
} from "./politician";
import {
  computeOutletStats,
  EMPTY_OUTLET_STATS,
  type OutletStats,
} from "./outletStats";
import type {
  AgencyGovernance,
  SelfDescribedOrg,
  BillListItem,
  BillProfile,
  CompareResponse,
  DailyCompareExample,
  FundingEdge,
  OrgFundingEdges,
  OrgListItem,
  OrgProfile,
  OutletProfile,
  PoliticianListItem,
  PoliticianProfile,
  TermCoverage,
  TermListItem,
  TermOutletCoverage,
  TermProfile,
} from "./types";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const isLocalhost = process.env.DATABASE_URL.includes("localhost") || process.env.DATABASE_URL.includes("127.0.0.1");

// Held on globalThis, not module scope, and cached in EVERY environment.
//
// The familiar idiom guards this with `NODE_ENV !== "production"`, on the
// reasoning that only dev HMR re-evaluates a module. That is wrong here in the
// one direction that costs money: Next.js bundles the RSC graph and the
// route-handler graph separately, so this module can be instantiated more than
// once per server instance in production — each copy opening its own Pool of
// up to `max` sockets against Neon. Guarding on NODE_ENV disables
// duplicate-pool protection in exactly the environment that pays for it.
//
// (Found in the sibling `cratedigger` project, which shares this Neon org and
// had the same pattern.)
const globalForDb = globalThis as unknown as { siftPgPool?: Pool };

const pool =
  globalForDb.siftPgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    // node-pg defaults this to 0, meaning "wait forever". Harmless while the
    // Neon compute was pinned awake 24/7; not harmless now that it scales to
    // zero, because a cold start is the one moment a connect can take seconds.
    // Fail the request instead of hanging it — the page has a fallback, a hung
    // lambda does not.
    connectionTimeoutMillis: 10_000,
    ...(!isLocalhost && {
      ssl: { rejectUnauthorized: true },
    }),
  });

globalForDb.siftPgPool = pool;

// Ceiling on how many articles one outlet can hold in a category's standalone
// pool (LIMIT 50). Without it a single high-volume feed dominates the pool —
// NY Post held 23/50 of 'top' when this was added (2026-08-10).
const MAX_ARTICLES_PER_SOURCE = 6;

// D48 grim dampener: articles tagged tone='grim' with importance <= 3 rank
// as if ~12 hours older (e^-0.51 ≈ 0.6). Importance 4-5 somber news and
// NULL-tone (unclassified) rows are untouched — the rule de-stacks
// low-importance tabloid crime, it never hides major news. Set to 1.0 to
// fully revert. Mirrored client-side in NewsAggregator.tsx rankScore().
const GRIM_DAMPENER = 0.6;

// SQL fragment appended to the importance × recency rank product.
const GRIM_DAMPENER_SQL = `CASE WHEN tone = 'grim' AND COALESCE(importance_score, 3) <= 3 THEN ${GRIM_DAMPENER} ELSE 1.0 END`;

// Ranking v2 stage 2 (docs/RANKING_SIGNALS.md): civic-entity-density boost —
// the D45 decision-relevance signal. Weighted DISTINCT dossier links (bill
// and politician 1.0, org 0.5, outlet 0), capped at 3, ×0.1 per point:
// civic density re-orders within a tier but tops out at +30%, so it can
// never promote a routine item over a disaster. Weights, cap, and constant
// mirror lib/civicWeight.ts (the client re-rank) — keep them in lockstep.
// Applied to the three article pool queries; the hero query keeps its own
// tone-preference mechanic, and stories derive their boost client-side from
// member articles (same layering as the stage-1 spectrum bonus). Verified
// against prod before shipping: worst pool shape 163 ms, unchanged.
const CIVIC_BOOST = 0.1;
const CIVIC_WEIGHT_SQL = `COALESCE((
  SELECT SUM(CASE t WHEN 'bill' THEN 1.0 WHEN 'politician' THEN 1.0 WHEN 'org' THEN 0.5 ELSE 0 END)
  FROM (SELECT DISTINCT el->>'type' AS t, el->>'canonical_id' AS cid
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(entity_links) = 'array' THEN entity_links ELSE '[]'::jsonb END) el) links
), 0)`;
const CIVIC_BOOST_SQL = `(1 + ${CIVIC_BOOST} * LEAST(${CIVIC_WEIGHT_SQL}, 3))`;

// Ranking v2 stage 4 (docs/RANKING_SIGNALS.md): opinion is not a top story.
// Evidence: the first hand-labeled ranking eval (sift-api#200) — half the
// overrules rejected op-eds the formulas ranked as news. Outlet-declared
// opinion (articles.is_opinion, set at ingest from URL/title markers) ranks
// ×0.6, and the API layer excludes opinion-backed framings from the
// cross-spectrum bonus (op-eds across lanes are disagreement, not
// corroboration). Flat, no importance gate: an op-ed is opinion at any
// importance. Set to 1.0 to revert. Mirrored in NewsAggregator.tsx.
const OPINION_DAMPENER = 0.6;
const OPINION_DAMPENER_SQL = `CASE WHEN is_opinion THEN ${OPINION_DAMPENER} ELSE 1.0 END`;

// Ranking v2 stage 5 (docs/RANKING_SIGNALS.md): roundup containers are not
// stories. Program episodes and daily briefs ("Morning news brief", "| The
// Opening Trade 8/11/2026") inherit importance from the events their
// summaries mention — the second labeled eval (sift-api#204) caught them
// near the top of 'top', and the original doom-feed's pinned #1 was one.
// Harder than the opinion dampener (0.4 vs 0.6) because a container is
// never the best version of a story: the underlying event is also in the
// feed, reported directly. Set to 1.0 to revert.
const ROUNDUP_DAMPENER = 0.4;
const ROUNDUP_DAMPENER_SQL = `CASE WHEN is_roundup THEN ${ROUNDUP_DAMPENER} ELSE 1.0 END`;

// Ranking v2 stage 6 (docs/RANKING_SIGNALS.md): 'top' is the front page,
// so it holds a higher bar than the topical tabs. Measured 2026-08-11:
// 303 of 489 'top' articles in a week scored importance <= 2, and only 8
// were tone='light' — the front page was filling with crime spectacle
// ("Naked champion swimmer accused of killing security guard"), correctly
// scored 1-2 and surfacing purely on freshness.
//
// Scoped to 'top' by design: an importance-2 sports result belongs in
// Sports, and the topical tabs are complete coverage. Set to 0 to turn
// this into a hard floor (importance <= 2 never appears in 'top'); 0.35
// is the graceful version, because the 2/3 boundary is exactly where a
// mis-scored article would be silently lost.
const LOW_IMPORTANCE_DAMPENER = 0.35;
const LOW_IMPORTANCE_SQL = `CASE WHEN category = 'top' AND COALESCE(importance_score, 3) <= 2 THEN ${LOW_IMPORTANCE_DAMPENER} ELSE 1.0 END`;

// Stage 6, second half: genre (articles.genre, migrations/025). Magazine
// features and soft/curiosity pieces are not the front page's job even
// when they score importance 3+. NULL/'news' is untouched.
//
// STANDALONE ARTICLES ONLY — deliberately absent from the stories query.
// Stories rank on corroboration, so a feature or tabloid piece inside a
// multi-outlet story does not drag the story down and still appears in
// its source list ("how this was covered"). A lone soft article standing
// on its own is the thing being demoted, not coverage of a real event.
const NON_NEWS_DAMPENER = 0.5;
const NON_NEWS_SQL = `CASE WHEN genre IN ('feature', 'soft') THEN ${NON_NEWS_DAMPENER} ELSE 1.0 END`;

// Ranking v2 stage 1 (docs/RANKING_SIGNALS.md): stories rank on a SATURATING
// corroboration curve, 3 + STORY_BOOST × ln(1 + sources), in both the SQL
// pool and the client re-rank — previously the pool used raw count × decay
// while the client showed readers a different formula, so the LIMIT 20
// truncation happened under an order nobody saw. ln keeps an 18-member wire
// pile-up from lapping a 6-outlet story 3×. The cross-spectrum bonus is
// applied at the API/client layer only (it needs framings' outlet ratings);
// its ≤1.2× range cannot meaningfully change a 20-deep pool truncation.
// STORY_BOOST = 0.5/ln(2) ≈ 0.72 would reproduce the old client score for a
// 2-source story; 0.8 sat close to that while giving big stories a little
// more headroom (10 sources → 4.9, vs the old hard cap at 5).
//
// RAISED 0.8 → 2.0 AND THE BASE DROPPED 3 → 1 ON 2026-08-11, TOGETHER.
//
// At (3, 0.8) corroboration barely ordered anything: the term spanned 3.88 (2
// outlets) to 5.36 (18) — a 1.38× range — against decay = EXP(-age_days), so
// the entire 2 → 18 range was worth **7.7 hours of freshness** and the base
// constant was 77% of the score at n=2. Recency was the ranking signal;
// coverage was rounding error.
//
// The base has to move with the boost, because these two numbers do different
// jobs and only one of them is about coverage. `STORY_BASE` sets where stories
// sit against STANDALONE ARTICLES, which score `importance × decay` on a 1-5
// scale — so raising the boost alone lifts every story against every article
// at once. Replayed against prod over six categories:
//
//   base boost | avg stories in top-20 | story-vs-story reordering | 2→18
//   3    0.8   | 5.8                   | —                         |  7.7h
//   3    1.6   | 8.5  ← floods         | 32                        | 11.6h
//   1    2.0   | 5.8  ← unchanged      | 53                        | 18.4h
//
// Bumping the boost alone bought reordering by crowding articles out (sports
// went 9 → 14 of 20, and 19 of 20 at 2.5). Lowering the base in step buys
// *more* reordering at an identical story/article mix. Coverage now moves the
// feed; the mix does not move at all, which is the point.
//
// Sanity at the new constants: a 2-outlet story scores 3.20 (just over an
// importance-3 article), an 18-outlet story 6.89 (over the importance-5
// ceiling). A thinly-covered grim story still lands under D48's dampener at
// 1.92. The `ln` still saturates, so a wire pile-up cannot lap a 6-outlet
// story — that guard was never the problem.
const STORY_BASE = 1;
const STORY_BOOST = 2.0;

// Ranking v2 stage 7: corroboration is a MULTIPLIER ON SIGNIFICANCE, not a
// substitute for it. Until this landed, a story's score ignored importance
// entirely — every story ranked on outlet count alone — so wire pickup of a
// local tragedy was indistinguishable from a major event. Measured
// 2026-08-11 at the (1, 2.0) constants: a New York Harbor drowning with 18
// outlets and mean member importance 1.9 scored 6.78 against a 169-death
// Colombian earthquake's 7.09. A 1.05x ratio. System-wide, 302 of 475
// stories had max member importance <= 2.
//
// The story's base significance is the MEAN importance of its member
// articles — what the outlets that covered it judged it to be, which is
// exactly the wire-pickup counter: 18 outlets each scoring it a 2 is 18
// votes for "minor", not one vote for "major".
//
// Centered on the observed mean (2.50 across six category pools, n=116) so
// the transform is share-NEUTRAL: dividing every story by a constant cannot
// reorder stories among themselves, it only shifts them against articles.
// Swept 2.0/2.2/2.4/2.6/3.0 — reordering is 89 at every center, story share
// runs 7.5/6.8/6.0/5.5/4.3 against a 5.7 baseline. 2.5 holds the mix that
// #231 tuned while adding 89 units of story-vs-story reordering.
const STORY_IMPORTANCE_CENTER = 2.5;
// An unscored member abstains rather than voting: it is averaged in AT the
// center, so it neither lifts nor lowers the story. Plain AVG skips NULLs
// instead, which hands the whole story to whichever members happen to be
// scored — one scored 5 among four unscored members read as mean 5, a 2.0x
// multiplier off a single outlet's judgment, which is precisely the
// single-outlet leverage the mean exists to remove. A flat COALESCE to 3
// would be worse still: it puts "no signal" ABOVE the observed mean.
const STORY_MEAN_IMPORTANCE_SQL = `AVG(COALESCE(a.importance_score, ${STORY_IMPORTANCE_CENTER}))`;
const STORY_IMPORTANCE_SQL = `(${STORY_MEAN_IMPORTANCE_SQL} / ${STORY_IMPORTANCE_CENTER})`;

// Stage 7's floor: a story may never rank below a genuinely important member.
//
// Stage 7 scores a story on the MEAN importance of its members, which is the
// right call against wire pickup — but it also means one important article
// clustered with minor ones is averaged down. Measured over 523 stories in
// 48h: 98 (19%) rank below their best member, but only **5** have a best
// member at importance 4-5. Those 5 are the case worth catching — a real
// story diluted by its company:
//
//   health    3 outlets  mean 2.8  max 5  ->  4.15
//   politics  4 outlets  mean 1.8  max 4  ->  3.09
//   business  2 outlets  mean 2.5  max 4  ->  3.20
//
// GATED AT 4 ON PURPOSE. An unconditional floor would undo what stage 7 is
// for: it lets a single outlet's importance score set the story's rank, which
// is the single-outlet leverage the mean was chosen to remove. Above 4 that
// leverage is worth it — an importance-5 article is the thing the publication
// most wants surfaced, and burying it because its co-members were fluff is a
// worse error than over-ranking one story. Below 4 the mean stands unqualified.
//
// Applied to SIGNIFICANCE ONLY — coverage x importance — before the dampeners.
// D48 (grim), opinion and the spectrum bonus still multiply on top: those are
// deliberate policy, and a floor that outran them would silently revert them.
// Set STORY_FLOOR_MIN_IMPORTANCE above 5 to disable.
const STORY_FLOOR_MIN_IMPORTANCE = 4;
// NULL-skipping on purpose, unlike the mean above: only a member somebody
// actually scored may trip the floor. MAX over all-NULL members is NULL and
// `NULL >= 4` is false, so the floor switches itself off with no fallback to
// invent. (This coalesced NULL to 3 until 2026-08-12, which was inert at the
// gate of 4 but would have fired on unscored members the moment the gate was
// lowered to test the rule.)
const STORY_MAX_IMPORTANCE_SQL = `MAX(a.importance_score)`;
// The floor is zero unless a member earns it, which makes one GREATEST enough
// — and keeps the coverage and mean subexpressions written (and evaluated)
// once rather than once per CASE branch.
const STORY_SIGNIFICANCE_SQL = `
         GREATEST(
           (${STORY_BASE} + ${STORY_BOOST} * LN(1 + COUNT(DISTINCT a.source_name)))::float
             * ${STORY_IMPORTANCE_SQL},
           CASE WHEN ${STORY_MAX_IMPORTANCE_SQL} >= ${STORY_FLOOR_MIN_IMPORTANCE}
                THEN ${STORY_MAX_IMPORTANCE_SQL}::float ELSE 0 END
         )`;

// "sources" in that curve means DISTINCT OUTLETS, not article rows. It counted
// COUNT(a.id) until 2026-08-11, which is a different thing: measured over 7
// days of complete stories, 29% had more articles than outlets and 18% were at
// >=1.5x, because a single high-volume outlet can file four pieces on one event
// (Sports Illustrated alone runs ~298 articles/day). Counting rows let one
// outlet manufacture the corroboration the curve is supposed to measure — the
// exact wire pile-up the ln was chosen to damp, entering through the variable
// instead of the shape.
//
// EXPECT THIS TO CHANGE ALMOST NOTHING IN THE FEED, AND THAT IS THE FINDING.
// Replayed against prod across all seven categories: 0/20 top-20 churn
// everywhere except politics, which moved one story. The corroboration term
// spans only 3.88 (2 sources) to 5.36 (18) — a 1.38x range — while decay is
// EXP(-age_days). So the entire 2->18 range is worth 7.7 HOURS of freshness,
// and the base constant 3 is 77% of the score at n=2. Corroboration is very
// nearly not a ranking signal at all right now; recency is.
//
// That makes this change a correctness fix (the number means what it says, and
// it stops one outlet inflating it) rather than the way to surface
// well-covered stories. Doing that is a weighting decision — lower the base,
// raise the boost, or slow decay for deep stories — and it is a product call
// about how much corroboration should outweigh freshness, not a mechanical
// one. docs/SOURCE_SCALING.md carries the measured trade-off curve.

export interface DbArticle {
  id: string;
  title: string;
  summary: string | null;
  source_url: string;
  source_name: string;
  image_url: string | null;
  category: string;
  published_date: Date | null;
  read_time: number;
  why_it_matters: string | null;
  importance_score: number | null;
  tone: string | null; // grim | neutral | light | NULL (migrations/020); NULL = neutral
  is_opinion: boolean; // outlet-declared opinion marker (migrations/023)
  is_roundup: boolean; // program-episode/brief container (migrations/024)
  genre: string | null; // news | feature | soft | NULL (migrations/025); NULL = news
  created_at: Date;
  // Civic-literacy MVP additions. Both columns added in
  // sift-api/migrations/005_context_primer_and_reading_levels.sql.
  // context_primer is populated by Phase 1A primer_generator;
  // reading_levels is reserved for Phase 1B (always NULL today).
  // pg returns JSONB as already-parsed objects, so type as `unknown`
  // here and validate at the API boundary via lib/primer.ts.
  context_primer: unknown;
  reading_levels: unknown;
}

// The category feed queries in getStoriesWithArticles (the standalone pool and
// its fallback) carry a 30-day recency floor. The EXP() decay in
// ORDER BY already zeroes out older rows (score × ~1e-13 at 30 days), so
// they can never rank — but without the floor Postgres still fetches and
// sorts every feed-quality row in the category (29k for business, 73k for
// sports as of 2026-07; sift-api#16). Written as an OR rather than
// COALESCE(published_date, created_at) so both branches stay servable by
// idx_articles_feed (category, published_date DESC).
//
// This floor is also why ~80% of the corpus is structurally undisplayable, and
// therefore why sift-api's embedding prune was safe — see
// sift-api/docs/NEON_RETENTION.md.
// ─── Stories ──────────────────────────────────────────

export interface DbStory {
  id: string;
  headline: string;
  summary: string;
  category: string;
  framings: unknown; // JSONB — parsed at API layer
  entities: unknown; // JSONB
  article_count: number;
  // Distinct outlets among the live member articles. This is what the
  // corroboration curve ranks on; `article_count` remains what the UI shows,
  // because "N articles" is still literally true and is the more useful
  // number to a reader looking at the source list.
  outlet_count: number;
  representative_image_url: string | null;
  published_date: Date | null;
  synthesis_status: string;
  // Fraction of live member articles tagged tone='grim' (0..1); the API
  // boundary derives Story.tone = 'grim' when >= 0.5. NULL tones count as 0.
  grim_share: string | number | null;
  // Mean importance of the live member articles (stage 7): the story's
  // base significance, which corroboration multiplies rather than replaces.
  avg_importance: string | number | null;
  // Highest member importance. Only used as the stage-7 floor, so a single
  // genuinely important article is not averaged into invisibility by minor
  // co-members. See STORY_FLOOR_MIN_IMPORTANCE.
  max_importance: string | number | null;
  // Fraction of live member articles flagged is_opinion (0..1); the API
  // boundary derives Story.isOpinion when >= 0.5.
  opinion_share: string | number | null;
}

export interface DbStoryArticle extends DbArticle {
  story_id: string | null;
}

export async function getStoriesWithArticles(
  category: string
): Promise<{ stories: DbStory[]; storyArticles: Record<string, DbStoryArticle[]>; standaloneArticles: DbArticle[] }> {
  // 1. Try to get stories with LIVE article counts (gracefully handle missing table).
  //
  // Story IDs are content-addressable (sha256 of member article IDs), so when
  // clustering shifts between refreshes the old story_id becomes orphaned:
  // the `stories` row persists with a stale `article_count`, but zero articles
  // reference it. Using the stored `article_count` ranks orphans highly and
  // shows "View 0 articles" in the UI. Instead, compute the live count via
  // LEFT JOIN, drop orphans with `HAVING >= 2`, and rank by the live count.
  let stories: DbStory[] = [];
  try {
    const storiesResult = await pool.query<DbStory>(
      `SELECT s.id, s.headline, s.summary, s.category, s.framings, s.entities,
              COUNT(a.id)::int AS article_count,
              COUNT(DISTINCT a.source_name)::int AS outlet_count,
              AVG(CASE WHEN a.tone = 'grim' THEN 1.0 ELSE 0 END) AS grim_share,
              ${STORY_MEAN_IMPORTANCE_SQL} AS avg_importance,
              ${STORY_MAX_IMPORTANCE_SQL} AS max_importance,
              AVG(CASE WHEN a.is_opinion THEN 1.0 ELSE 0 END) AS opinion_share,
              s.representative_image_url, s.published_date, s.synthesis_status
       FROM stories s
       LEFT JOIN articles a
         ON a.story_id = s.id
         AND a.from_search = false
         AND a.summary IS NOT NULL AND a.summary != ''
         AND LOWER(a.summary) NOT LIKE 'unable to provide%'
       WHERE s.category = $1 AND s.synthesis_status = 'complete'
       GROUP BY s.id
       HAVING COUNT(a.id) >= 2
       ORDER BY
         ${STORY_SIGNIFICANCE_SQL} *
         EXP(-LEAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - COALESCE(s.published_date, s.created_at))), 0) / 86400.0, 700))
       DESC NULLS LAST
       LIMIT 20`,
      [category]
    );
    stories = storiesResult.rows;
  } catch (err) {
    // stories table / story_id column may not exist yet — fall back to
    // articles-only. Anything else is a real failure and propagates.
    if (!isMissingSchemaObject(err, ["stories", "story_id"])) throw err;
    reportError("db.getStoriesAndArticles.stories", err, { level: "warning" });
  }

  const storyIds = stories.map((s) => s.id);

  // 2a. Fetch ALL articles that belong to the selected stories. Using a top-N
  // article limit would drop story members that don't rank in the top-N by
  // importance × recency, producing empty story.articles and "View 0 articles"
  // on the frontend.
  const storyArticles: Record<string, DbStoryArticle[]> = {};
  if (storyIds.length > 0) {
    try {
      const storyArticlesResult = await pool.query<DbStoryArticle>(
        `SELECT id, title, summary, source_url, source_name, image_url,
                category, published_date, read_time, why_it_matters, importance_score, tone, is_opinion, is_roundup, genre, context_primer, reading_levels, created_at, story_id
         FROM articles
         WHERE story_id = ANY($1::text[])
           AND from_search = false
           AND summary IS NOT NULL AND summary != ''
           AND LOWER(summary) NOT LIKE 'unable to provide%'
         ORDER BY published_date DESC NULLS LAST`,
        [storyIds]
      );
      for (const row of storyArticlesResult.rows) {
        if (!row.story_id) continue;
        if (!storyArticles[row.story_id]) storyArticles[row.story_id] = [];
        storyArticles[row.story_id].push(row);
      }
    } catch (err) {
      // story_id column may not exist — tolerate and fall through to articles-only path.
      if (!isMissingColumn(err, "story_id")) throw err;
      reportError("db.getStoriesAndArticles.storyArticles", err, {
        level: "warning",
      });
    }
  }

  // 2b. Fetch standalone articles for the feed. An article is "standalone"
  // when its story_id is NULL *or* when its story_id points to a story that
  // was dropped in step 1 (orphan: fewer than 2 live member articles). This
  // prevents orphan articles from disappearing entirely from the feed.
  //
  // The scored/capped CTEs cap each outlet at MAX_ARTICLES_PER_SOURCE rows
  // so one firehose feed can't fill the pool. Story-member articles (2a) are
  // deliberately uncapped — capping them would drop story members and
  // recreate the "View 0 articles" bug class described above.
  let standaloneArticles: DbArticle[] = [];
  try {
    const standaloneResult = await pool.query<DbArticle>(
      `WITH scored AS (
         SELECT id, title, summary, source_url, source_name, image_url,
                category, published_date, read_time, why_it_matters, importance_score, tone, is_opinion, is_roundup, genre, context_primer, reading_levels, created_at,
                COALESCE(importance_score, 3)::float *
                EXP(-LEAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - COALESCE(published_date, created_at))), 0) / 86400.0, 700)) *
                ${GRIM_DAMPENER_SQL} *
                ${CIVIC_BOOST_SQL} *
                ${OPINION_DAMPENER_SQL} *
                ${ROUNDUP_DAMPENER_SQL} *
                ${LOW_IMPORTANCE_SQL} *
                ${NON_NEWS_SQL}
                AS rank_score
         FROM articles
         WHERE category = $1 AND from_search = false
           AND (story_id IS NULL OR story_id <> ALL($2::text[]))
           AND summary IS NOT NULL AND summary != ''
           AND LOWER(summary) NOT LIKE 'unable to provide%'
           AND (published_date > NOW() - INTERVAL '30 days'
                OR (published_date IS NULL AND created_at > NOW() - INTERVAL '30 days'))
       ),
       capped AS (
         SELECT *, ROW_NUMBER() OVER (
                  PARTITION BY source_name
                  ORDER BY rank_score DESC, published_date DESC NULLS LAST
                ) AS source_rank
         FROM scored
       )
       SELECT id, title, summary, source_url, source_name, image_url,
              category, published_date, read_time, why_it_matters, importance_score, tone, is_opinion, is_roundup, genre, context_primer, reading_levels, created_at
       FROM capped
       WHERE source_rank <= ${MAX_ARTICLES_PER_SOURCE}
       ORDER BY rank_score DESC
       LIMIT 50`,
      [category, storyIds]
    );
    standaloneArticles = standaloneResult.rows;
  } catch (err) {
    if (!isMissingColumn(err, "story_id")) throw err;
    reportError("db.getStoriesAndArticles.standalone", err, {
      level: "warning",
    });
    const fallback = await pool.query<DbArticle>(
      `WITH scored AS (
         SELECT id, title, summary, source_url, source_name, image_url,
                category, published_date, read_time, why_it_matters, importance_score, tone, is_opinion, is_roundup, genre, context_primer, reading_levels, created_at,
                COALESCE(importance_score, 3)::float *
                EXP(-LEAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - COALESCE(published_date, created_at))), 0) / 86400.0, 700)) *
                ${GRIM_DAMPENER_SQL} *
                ${CIVIC_BOOST_SQL} *
                ${OPINION_DAMPENER_SQL} *
                ${ROUNDUP_DAMPENER_SQL} *
                ${LOW_IMPORTANCE_SQL} *
                ${NON_NEWS_SQL}
                AS rank_score
         FROM articles
         WHERE category = $1 AND from_search = false
           AND summary IS NOT NULL AND summary != ''
           AND LOWER(summary) NOT LIKE 'unable to provide%'
           AND (published_date > NOW() - INTERVAL '30 days'
                OR (published_date IS NULL AND created_at > NOW() - INTERVAL '30 days'))
       ),
       capped AS (
         SELECT *, ROW_NUMBER() OVER (
                  PARTITION BY source_name
                  ORDER BY rank_score DESC, published_date DESC NULLS LAST
                ) AS source_rank
         FROM scored
       )
       SELECT id, title, summary, source_url, source_name, image_url,
              category, published_date, read_time, why_it_matters, importance_score, tone, is_opinion, is_roundup, genre, context_primer, reading_levels, created_at
       FROM capped
       WHERE source_rank <= ${MAX_ARTICLES_PER_SOURCE}
       ORDER BY rank_score DESC
       LIMIT 50`,
      [category]
    );
    return { stories: [], storyArticles: {}, standaloneArticles: fallback.rows };
  }

  return { stories, storyArticles, standaloneArticles };
}

// ─── Landing ───────────────────────────────────────────

/**
 * Fetch a single hero-quality article for the marketing landing page.
 * Prefers articles that (a) have an image, (b) sit in the "top" category,
 * and (c) rank high on importance × recency. Returns null if the DB has
 * nothing usable — caller renders a fallback layout.
 *
 * D48 tone preference: among the top 12 by rank, the best non-grim article
 * wins if it scores at least half the overall best (≈ within one importance
 * point or ~17 hours) — so the landing page doesn't lead with a death story
 * every day, but a dominant story (a fresh importance-5 disaster) still
 * takes the hero. NULL tone counts as non-grim.
 */
export async function getTopStoryForLanding(): Promise<DbArticle | null> {
  try {
    const result = await pool.query<DbArticle>(
      `WITH ranked AS (
         SELECT id, title, summary, source_url, source_name, image_url,
                category, published_date, read_time, why_it_matters, importance_score, tone, is_opinion, is_roundup, genre, context_primer, reading_levels, created_at,
                COALESCE(importance_score, 3)::float *
                EXP(-LEAST(GREATEST(EXTRACT(EPOCH FROM (NOW() - COALESCE(published_date, created_at))), 0) / 86400.0, 700))
                AS rank_score
         FROM articles
         WHERE category = 'top'
           AND from_search = false
           AND is_opinion = false
           AND is_roundup = false
           AND (genre IS NULL OR genre = 'news')
           AND image_url IS NOT NULL
           AND summary IS NOT NULL AND summary != ''
           AND LOWER(summary) NOT LIKE 'unable to provide%'
           AND (published_date > NOW() - INTERVAL '30 days'
                OR (published_date IS NULL AND created_at > NOW() - INTERVAL '30 days'))
         ORDER BY rank_score DESC
         LIMIT 12
       )
       SELECT id, title, summary, source_url, source_name, image_url,
              category, published_date, read_time, why_it_matters, importance_score, tone, is_opinion, is_roundup, genre, context_primer, reading_levels, created_at
       FROM ranked
       ORDER BY
         CASE WHEN tone IS DISTINCT FROM 'grim'
               AND rank_score >= 0.5 * (SELECT MAX(rank_score) FROM ranked)
              THEN 0 ELSE 1 END,
         rank_score DESC
       LIMIT 1`
    );
    return result.rows[0] ?? null;
  } catch (err) {
    // The landing hero degrades to the static illustration rather than 500ing,
    // but a silent degrade here means an empty homepage nobody is told about.
    reportError("db.getTopStoryForLanding", err);
    return null;
  }
}

export async function getLastRefreshed(category: string): Promise<Date | null> {
  const result = await pool.query(
    "SELECT last_refreshed_at FROM pipeline_state WHERE category = $1",
    [category]
  );
  return result.rows[0]?.last_refreshed_at ?? null;
}

// ─── Bookmarks ─────────────────────────────────────────

export async function getBookmarks(userId: string): Promise<string[]> {
  const result = await pool.query<{ article_id: string }>(
    "SELECT article_id FROM bookmarks WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return result.rows.map((r) => r.article_id);
}

export async function addBookmark(userId: string, articleId: string): Promise<void> {
  await pool.query(
    "INSERT INTO bookmarks (user_id, article_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [userId, articleId]
  );
}

export async function removeBookmark(userId: string, articleId: string): Promise<void> {
  await pool.query(
    "DELETE FROM bookmarks WHERE user_id = $1 AND article_id = $2",
    [userId, articleId]
  );
}

export async function getBookmarkedArticles(userId: string): Promise<DbArticle[]> {
  const result = await pool.query<DbArticle>(
    `SELECT a.id, a.title, a.summary, a.source_url, a.source_name, a.image_url,
            a.category, a.published_date, a.read_time, a.why_it_matters, a.importance_score,
            a.context_primer, a.reading_levels, a.created_at
     FROM articles a
     JOIN bookmarks b ON b.article_id = a.id
     WHERE b.user_id = $1
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return result.rows;
}

// ─── Vector Search ─────────────────────────────────────

export interface DbArticleWithSimilarity extends DbArticle {
  similarity: number;
}

function toVectorString(embedding: number[]): string {
  for (let i = 0; i < embedding.length; i++) {
    if (typeof embedding[i] !== "number" || !Number.isFinite(embedding[i])) {
      throw new Error(`Invalid embedding value at index ${i}: ${embedding[i]}`);
    }
  }
  return `[${embedding.join(",")}]`;
}

export async function searchArticlesByEmbedding(
  embedding: number[],
  similarityThreshold = 0.35,
  limit = 10
): Promise<DbArticleWithSimilarity[]> {
  const vectorStr = toVectorString(embedding);
  const result = await pool.query<DbArticle & { similarity: number }>(
    `SELECT id, title, summary, source_url, source_name, image_url,
            category, published_date, read_time, why_it_matters, importance_score, context_primer, reading_levels, created_at,
            1 - (embedding <=> $1::vector) AS similarity
     FROM articles
     WHERE embedding IS NOT NULL
       AND 1 - (embedding <=> $1::vector) > $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [vectorStr, similarityThreshold, limit]
  );
  return result.rows;
}

export async function insertArticle(article: {
  id: string;
  title: string;
  summary: string;
  source_url: string;
  source_name: string;
  category: string;
  embedding: number[];
  published_date?: Date | null;
  image_url?: string | null;
  read_time?: number;
}): Promise<void> {
  const vectorStr = toVectorString(article.embedding);
  await pool.query(
    `INSERT INTO articles (id, title, summary, source_url, source_name, image_url,
                           category, published_date, embedding, read_time, from_search)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10, true)
     ON CONFLICT (source_url) DO NOTHING`,
    [
      article.id,
      article.title,
      article.summary,
      article.source_url,
      article.source_name,
      article.image_url || null,
      article.category,
      article.published_date || null,
      vectorStr,
      article.read_time || 1,
    ]
  );
}

// ─── AI cost ledger (interim cost-guard for topic search, sift-api#79) ──
// The topic-search route runs paid Claude/Voyage calls on the user path but,
// unlike sift-api, those calls were never recorded in ai_usage_daily or checked
// against the daily ceiling (init.sql flags this as a temporary D35 gap). Until
// the fallback moves into sift-api (#79), the route meters its spend into the
// SAME shared ledger the backend guard reads, so the daily ceiling stays global.

/** Today's combined estimated AI spend (USD) across backend + frontend. */
export async function getTodayAiSpendUsd(): Promise<number> {
  const result = await pool.query<{ total: number | null }>(
    `SELECT COALESCE(SUM(estimated_cost_usd), 0) AS total
       FROM ai_usage_daily
      WHERE usage_date = CURRENT_DATE`
  );
  return Number(result.rows[0]?.total ?? 0);
}

/** Add one paid call's estimated cost to today's ledger (idempotent upsert). */
export async function recordAiUsage(entry: {
  provider: string;
  model: string;
  operation: string;
  costUsd: number;
}): Promise<void> {
  await pool.query(
    `INSERT INTO ai_usage_daily
        (usage_date, provider, model, operation, estimated_cost_usd, call_count)
     VALUES (CURRENT_DATE, $1, $2, $3, $4, 1)
     ON CONFLICT (usage_date, provider, model, operation) DO UPDATE SET
        estimated_cost_usd = ai_usage_daily.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
        call_count = ai_usage_daily.call_count + 1,
        updated_at = NOW()`,
    [entry.provider, entry.model, entry.operation, entry.costUsd]
  );
}

// ─── Custom Topics ────────────────────────────────────

export interface DbCustomTopic {
  id: string;
  user_id: string;
  name: string;
  query: string; // JSON-encoded CustomTopic data
  created_at: Date;
}

export async function getCustomTopics(userId: string): Promise<DbCustomTopic[]> {
  const result = await pool.query<DbCustomTopic>(
    "SELECT id, user_id, name, query, created_at FROM custom_topics WHERE user_id = $1 ORDER BY created_at ASC",
    [userId]
  );
  return result.rows;
}

export async function saveCustomTopic(
  id: string,
  userId: string,
  name: string,
  topicJson: string
): Promise<void> {
  await pool.query(
    `INSERT INTO custom_topics (id, user_id, name, query)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, name) DO UPDATE SET query = $4`,
    [id, userId, name, topicJson]
  );
}

export async function deleteCustomTopic(id: string, userId: string): Promise<void> {
  await pool.query(
    "DELETE FROM custom_topics WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
}

// ─── Outlet Provenance (Phase 2.B) ─────────────────────

/**
 * Lookup map: lowercase `articles.source_name` → curated `OutletProfile`.
 *
 * Built from two relations:
 *   1. `source_name_aliases` — explicit, hand-curated raw_source_name → outlet_slug
 *   2. `outlet_profiles.LOWER(name)` — implicit fallback for outlets whose
 *      RSS source_name happens to match the canonical name verbatim
 *
 * Aliases beat name-fallback when both are present for the same key.
 *
 * Cached at the module level for `OUTLET_CACHE_TTL_MS`. The underlying tables
 * change quarterly (manual hand-curation), so a stale cache is harmless. If
 * either table is missing (typical until sift-api Phase 2.A.1 lands in prod),
 * `getOutletProfilesMap` returns an empty Map and the API mapping degrades to
 * outlet=null, which OutletBadge renders as plain source-name text.
 */
const OUTLET_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
let outletCache: { data: Map<string, OutletProfile>; expiresAt: number } | null = null;
let outletCacheInflight: Promise<Map<string, OutletProfile>> | null = null;

async function loadOutletProfilesMap(): Promise<Map<string, OutletProfile>> {
  const out = new Map<string, OutletProfile>();
  let profilesBySlug: Map<string, OutletProfile>;

  // 1. Load all outlet_profiles. Tolerate missing table.
  try {
    const result = await pool.query<DbOutletProfileRow>(
      `SELECT slug, name, parent_company, parent_company_url, founded_year,
              funding_model, allsides_rating, allsides_url, allsides_last_checked,
              mbfc_factual, mbfc_url, mbfc_last_checked,
              major_funders, external_links, notes
       FROM outlet_profiles`
    );
    profilesBySlug = new Map();
    for (const row of result.rows) {
      const profile = parseDbOutletProfile(row);
      if (!profile) continue;
      profilesBySlug.set(profile.slug, profile);
      // Implicit name-match fallback (case-insensitive, trimmed).
      out.set(profile.name.trim().toLowerCase(), profile);
    }
  } catch (err) {
    if (!isMissingSchemaObject(err, "outlet_profiles")) throw err;
    // outlet_profiles missing — return empty map; aliases lookup also pointless.
    reportError("db.loadOutletProfilesMap.profiles", err, { level: "warning" });
    return out;
  }

  // 2. Layer source_name_aliases on top. Tolerate missing table.
  try {
    const result = await pool.query<{ raw_source_name: string; outlet_slug: string }>(
      `SELECT raw_source_name, outlet_slug FROM source_name_aliases`
    );
    for (const { raw_source_name, outlet_slug } of result.rows) {
      const profile = profilesBySlug.get(outlet_slug);
      if (!profile) continue; // orphan alias; FK should prevent this but defend anyway
      out.set(raw_source_name.trim().toLowerCase(), profile);
    }
  } catch (err) {
    if (!isMissingSchemaObject(err, "source_name_aliases")) throw err;
    // source_name_aliases missing — fall through with name-only matches.
    reportError("db.loadOutletProfilesMap.aliases", err, { level: "warning" });
  }

  return out;
}

/**
 * Returns the cached source_name → OutletProfile map, refreshing if expired.
 * Concurrent callers share a single in-flight fetch promise to avoid
 * duplicate DB round-trips on cold starts.
 */
export async function getOutletProfilesMap(): Promise<Map<string, OutletProfile>> {
  const now = Date.now();
  if (outletCache && outletCache.expiresAt > now) return outletCache.data;
  if (outletCacheInflight) return outletCacheInflight;

  outletCacheInflight = loadOutletProfilesMap()
    .then((data) => {
      outletCache = { data, expiresAt: Date.now() + OUTLET_CACHE_TTL_MS };
      return data;
    })
    .catch((err) => {
      reportError("db.getOutletProfilesMap", err);
      // Don't cache failure; next caller will retry. Return empty map so the
      // API still serves articles, just without outlet provenance.
      return new Map<string, OutletProfile>();
    })
    .finally(() => {
      outletCacheInflight = null;
    });

  return outletCacheInflight;
}

/**
 * Resolve a single source_name to an OutletProfile via the cached map.
 * Returns null when no alias/name match exists. Does not hit the DB itself.
 */
export function resolveOutletForSourceName(
  outletMap: Map<string, OutletProfile>,
  sourceName: string | null | undefined,
): OutletProfile | null {
  if (!sourceName) return null;
  return outletMap.get(sourceName.trim().toLowerCase()) ?? null;
}

/** Test-only: reset the cache between unit-test runs. */
export function _resetOutletCacheForTesting(): void {
  outletCache = null;
  outletCacheInflight = null;
}

// ─── Methodology page (Phase 2.D) ──────────────────────

/**
 * Fetch every curated outlet, sorted alphabetically by name. Used by the
 * methodology page to render the live list of outlets Sift reads from.
 *
 * Returns [] when outlet_profiles doesn't exist (graceful degradation —
 * the methodology page falls back to its prose explanation without the
 * outlet list).
 */
export async function getAllOutletProfiles(): Promise<OutletProfile[]> {
  try {
    const result = await pool.query<DbOutletProfileRow>(
      `SELECT slug, name, parent_company, parent_company_url, founded_year,
              funding_model, allsides_rating, allsides_url, allsides_last_checked,
              mbfc_factual, mbfc_url, mbfc_last_checked,
              major_funders, external_links, notes
       FROM outlet_profiles
       ORDER BY LOWER(name)`
    );
    const out: OutletProfile[] = [];
    for (const row of result.rows) {
      const profile = parseDbOutletProfile(row);
      if (profile) out.push(profile);
    }
    return out;
  } catch (err) {
    if (!isMissingSchemaObject(err, "outlet_profiles")) throw err;
    reportError("db.getAllOutletProfiles", err, { level: "warning" });
    return [];
  }
}

/**
 * Spectrum stats for the curated outlet set — the single server-side source
 * for outlet-count copy (issue #153), read from the same `outlet_profiles`
 * table as the public outlet list. Fully graceful: any DB/table miss degrades
 * to all-zero stats so callers fall back to count-free, still-truthful copy
 * rather than rendering "0".
 */
export async function getOutletStats(): Promise<OutletStats> {
  try {
    return computeOutletStats(await getAllOutletProfiles());
  } catch (err) {
    // Callers fall back to count-free copy; report so the fallback isn't silent.
    reportError("db.getOutletStats", err);
    return { ...EMPTY_OUTLET_STATS };
  }
}

// ─── Entity Links (Phase 3.H) ──────────────────────────

/**
 * Batch-fetch entity_links JSONB for a set of article IDs. Returns a
 * Map keyed on article id for O(1) lookup at API mapping time.
 *
 * Defensive: catches "column entity_links does not exist" so this code
 * is safe to deploy before sift-api Phase 3.G's migration lands in
 * prod. Articles whose ids aren't in the result map render with empty
 * entityLinks (graceful degradation — EntityLinksList renders nothing).
 */
export async function getArticleEntityLinks(
  articleIds: string[],
): Promise<Map<string, unknown>> {
  if (articleIds.length === 0) return new Map();

  try {
    const result = await pool.query<{ id: string; entity_links: unknown }>(
      `SELECT id, entity_links FROM articles WHERE id = ANY($1::text[])`,
      [articleIds]
    );
    return new Map(result.rows.map((r) => [r.id, r.entity_links]));
  } catch (err) {
    if (!isMissingColumn(err, "entity_links")) throw err;
    // Pre-Phase-3.G prod — column not yet added. Fall through with
    // empty map; the UI renders no glossary section.
    reportError("db.getArticleEntityLinks", err, { level: "warning" });
    return new Map();
  }
}

// ─── Politician Dossier (Phase 3.C) ────────────────────

/**
 * Fetch a single politician profile by bioguide_id (Congress.gov canonical
 * identifier, e.g. 'S000148' for Schumer). Returns null when the bioguide
 * isn't curated (caller should call notFound() for the dossier route) or
 * when the politician_profiles table doesn't exist yet (graceful for
 * pre-Phase-3.A-merge prod).
 */
async function getPoliticianByBioguideUncached(
  bioguideId: string,
): Promise<PoliticianProfile | null> {
  const trimmed = bioguideId.trim().toUpperCase();
  if (!trimmed) return null;

  try {
    const result = await pool.query<DbPoliticianProfileRow>(
      `SELECT bioguide_id, name, party, state, chamber,
              committees, top_industries_current_cycle, interest_group_ratings,
              external_links, notes,
              id_source, role_title, role_title_source,
              role_start_date, role_end_date, role_dates_source,
              nomination_date, nomination_url,
              confirmation_date, confirmation_vote_url,
              confirmation_vote_result, predecessor_name, predecessor_source,
              role_verified_at
       FROM politician_profiles
       WHERE bioguide_id = $1
       LIMIT 1`,
      [trimmed]
    );
    if (result.rows.length === 0) return null;
    return parseDbPoliticianProfile(result.rows[0]);
  } catch (err) {
    if (!isMissingSchemaObject(err, "politician_profiles")) throw err;
    reportError("db.getPoliticianByBioguide", err, { level: "warning" });
    return null;
  }
}

// ─── Org Dossier (Phase 3.D) ───────────────────────────

/**
 * Fetch a single org profile by slug (e.g. 'brookings-institution').
 * Returns null when the slug isn't curated (caller should call
 * notFound() for the dossier route) or when the org_profiles table
 * doesn't exist yet.
 */
async function getOrgBySlugUncached(slug: string): Promise<OrgProfile | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const result = await pool.query<DbOrgProfileRow>(
      `SELECT slug, name, type, founded_year,
              annual_budget_usd, annual_budget_fy, annual_budget_source,
              major_funders, fara_registered,
              fara_countries, external_links, notes,
              self_description, self_description_source,
              self_description_checked, governance_structure,
              governance_source
       FROM org_profiles
       WHERE slug = $1
       LIMIT 1`,
      [trimmed]
    );
    if (result.rows.length === 0) return null;
    return parseDbOrgProfile(result.rows[0]);
  } catch (err) {
    if (!isMissingSchemaObject(err, "org_profiles")) throw err;
    reportError("db.getOrgBySlug", err, { level: "warning" });
    return null;
  }
}

// ─── Bill Dossier (Phase 3.E) ──────────────────────────

/**
 * Fetch a single bill profile by canonical id (e.g. 'hr-5376-117').
 * Returns null when the bill_id isn't curated or when the bill_profiles
 * table doesn't exist yet. The route's notFound() renders the global
 * 404 page on null.
 */
async function getBillByIdUncached(billId: string): Promise<BillProfile | null> {
  const trimmed = billId.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const result = await pool.query<DbBillProfileRow>(
      `SELECT bill_id, congress, title, short_title, sponsor_bioguide,
              cosponsors, status, introduced_date,
              lobbying_for_usd, lobbying_against_usd,
              external_links, notes
       FROM bill_profiles
       WHERE bill_id = $1
       LIMIT 1`,
      [trimmed]
    );
    if (result.rows.length === 0) return null;
    return parseDbBillProfile(result.rows[0]);
  } catch (err) {
    if (!isMissingSchemaObject(err, "bill_profiles")) throw err;
    reportError("db.getBillById", err, { level: "warning" });
    return null;
  }
}

// ─── Civic dossier index (`/civic`) ────────────────────

/**
 * Lite list of every curated politician for the civic index page. Pulls
 * only the five fields the index actually renders (no committees / industries
 * / etc.) so 536 rows fit in a small payload.
 *
 * Sorted by state then name so the index can group by state without a
 * second sort pass on the client.
 *
 * Tolerates missing tables (returns []).
 */
export async function listAllPoliticiansLite(): Promise<PoliticianListItem[]> {
  try {
    const result = await pool.query<{
      bioguide_id: string;
      name: string;
      party: string | null;
      state: string | null;
      chamber: string | null;
    }>(
      `SELECT bioguide_id, name, party, state, chamber
       FROM politician_profiles
       ORDER BY state ASC NULLS LAST, name ASC`,
    );
    return result.rows.map((r) => ({
      bioguideId: r.bioguide_id,
      name: r.name,
      party: r.party?.trim() || null,
      state: r.state?.trim() || null,
      chamber: (r.chamber as PoliticianListItem["chamber"]) ?? null,
    }));
  } catch (err) {
    if (!isMissingSchemaObject(err, "politician_profiles")) throw err;
    reportError("db.listPoliticians", err, { level: "warning" });
    return [];
  }
}

/**
 * Lite list of every curated org for the civic index page. Sorted by type
 * then name so the index can group by type without re-sorting client-side.
 */
/**
 * Agencies whose governance is documented AND cited. Powers /agencies.
 *
 * The WHERE clause is the load-bearing part: both the text and its source URL
 * must be present, so a row can never reach the page as an uncited assertion
 * about how a federal agency is controlled. As of migration 012 that is 15 of
 * 93 agency rows — the rest render nothing rather than something unsourced.
 */
export async function listCitedAgencies(): Promise<AgencyGovernance[]> {
  try {
    const result = await pool.query<{
      slug: string;
      name: string;
      governance_structure: string;
      governance_source: string;
    }>(
      `SELECT slug, name, governance_structure, governance_source
       FROM org_profiles
       WHERE type = 'agency'
         AND governance_structure IS NOT NULL
         AND governance_source IS NOT NULL
       ORDER BY name ASC`,
    );
    return result.rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      governanceStructure: r.governance_structure,
      governanceSource: r.governance_source,
      hasPartisanBalanceCap: hasPartisanBalanceCap(r.governance_structure),
    }));
  } catch (err) {
    // Pre-012 databases lack the columns; degrade to an empty page rather
    // than a 500. The page renders its own empty state.
    if (!isMissingSchemaObject(err)) throw err;
    reportError("db.listCitedAgencies", err, { level: "warning" });
    return [];
  }
}

/**
 * Organizations that describe themselves, quoted and cited. Powers /think-tanks.
 *
 * Both the quote and its source must be present — same rule as
 * listCitedAgencies. Excludes agencies: a federal agency does not "describe
 * itself" in the sense this page means, and lumping them together would blur
 * the distinction the page is built on.
 */
export async function listSelfDescribedOrgs(): Promise<SelfDescribedOrg[]> {
  try {
    const result = await pool.query<{
      slug: string;
      name: string;
      type: string | null;
      self_description: string;
      self_description_source: string;
      self_description_checked: Date | string | null;
      fara_registered: boolean | null;
      fara_countries: unknown;
    }>(
      `SELECT slug, name, type, self_description, self_description_source,
              self_description_checked, fara_registered, fara_countries
       FROM org_profiles
       WHERE type <> 'agency'
         AND self_description IS NOT NULL
         AND self_description_source IS NOT NULL
       ORDER BY name ASC`,
    );
    return result.rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      type: (r.type as SelfDescribedOrg["type"]) ?? null,
      selfDescription: r.self_description,
      selfDescriptionSource: r.self_description_source,
      selfDescriptionChecked:
        r.self_description_checked instanceof Date
          ? r.self_description_checked.toISOString().slice(0, 10)
          : (r.self_description_checked?.trim() || null),
      faraRegistered: r.fara_registered === true,
      faraCountries: Array.isArray(r.fara_countries)
        ? (r.fara_countries as unknown[]).filter(
            (v): v is string => typeof v === "string",
          )
        : [],
      claimsNonPartisanship: claimsNonPartisanship(r.self_description),
    }));
  } catch (err) {
    if (!isMissingSchemaObject(err)) throw err;
    reportError("db.listSelfDescribedOrgs", err, { level: "warning" });
    return [];
  }
}

export async function listAllOrgsLite(): Promise<OrgListItem[]> {
  try {
    const result = await pool.query<{
      slug: string;
      name: string;
      type: string | null;
    }>(
      `SELECT slug, name, type
       FROM org_profiles
       ORDER BY type ASC NULLS LAST, name ASC`,
    );
    return result.rows.map((r) => ({
      slug: r.slug,
      name: r.name,
      type: (r.type as OrgListItem["type"]) ?? null,
    }));
  } catch (err) {
    if (!isMissingSchemaObject(err, "org_profiles")) throw err;
    reportError("db.listOrgs", err, { level: "warning" });
    return [];
  }
}

/**
 * Lite list of every curated bill for the civic index page. Currently only
 * one bill (HR 5376-117 / IRA) — sorted newest-introduced-first to age well
 * as more land.
 */
export async function listAllBillsLite(): Promise<BillListItem[]> {
  try {
    const result = await pool.query<{
      bill_id: string;
      congress: number;
      short_title: string | null;
      status: string | null;
    }>(
      `SELECT bill_id, congress, short_title, status
       FROM bill_profiles
       ORDER BY introduced_date DESC NULLS LAST, bill_id ASC`,
    );
    return result.rows.map((r) => ({
      billId: r.bill_id,
      congress: r.congress,
      shortTitle: r.short_title?.trim() || null,
      status: (r.status as BillListItem["status"]) ?? null,
    }));
  } catch (err) {
    if (!isMissingSchemaObject(err, "bill_profiles")) throw err;
    reportError("db.listBills", err, { level: "warning" });
    return [];
  }
}

// ─── Sitemap ───────────────────────────────────────────

export type SitemapEntry = { path: string; lastModified: Date };

/**
 * The `/term/*` branch of the sitemap union.
 *
 * Was a lateral recomputing coverage across the corpus per term. It now reads
 * the count migration 034 stores, which is both far cheaper and the ONLY way
 * this can agree with `isPublishableTerm` — two implementations of the same
 * floor drift, and when they do a page says noindex while the sitemap
 * advertises it.
 *
 * Historical note, kept because it is a trap worth not re-entering:
 *
 * **`String.raw` is mandatory here, not stylistic.** This SQL contains POSIX
 * word-boundary escapes (`\m`, `\M`) and a bracket expression of regex
 * metacharacters. In an ordinary template literal JavaScript eats those
 * backslashes before Postgres ever sees them — `\m` becomes a bare `m`, the
 * boundaries disappear, and the query silently starts matching substrings
 * instead of words. It compiles, it runs, it returns a plausible-looking
 * number. `String.raw` passes the backslashes through untouched.
 *
 * Second, it keeps the SQL comments out of a backtick-delimited string, where
 * a stray backtick terminates the literal mid-query.
 *
 * The term floor is the only one that has to count corpus articles, so this
 * branch is much larger than the other four — see the `listSitemapEntries`
 * header for what the rule is and why.
 */
const SITEMAP_TERM_BRANCH = `
       SELECT '/term/' || slug, updated_at
         FROM term_profiles
        WHERE definition IS NOT NULL
          AND definition_source IS NOT NULL
          -- Stored count (migration 034), the same column isPublishableTerm
          -- reads. NULL is never-measured and is excluded rather than
          -- treated as unknown, so a freshly seeded term stays out of the
          -- sitemap until refresh_term_coverage.py has measured it.
          AND article_count >= ${TERM_MIN_ARTICLES}`;

/**
 * Dossier URLs that are substantial enough to advertise to crawlers.
 *
 * ⚠️ INVARIANT: the WHERE clauses below and the predicates in
 * `lib/publishFloor.ts` express the same rule and must agree. Two
 * implementations exist because the sitemap needs a set-level query while the
 * dossier routes need a check on a profile object already in hand — the
 * routes use the predicates to emit `robots: { index: false }` for anything
 * this query omits. Change one, change the other;
 * `__tests__/publishFloor.test.ts` pins the rule in prose and examples.
 *
 * This is the publish floor, generalised from `listCitedAgencies` above: the
 * catalog the linker knows about and the set we ask Google to index are two
 * different things. A thin row still renders and still resolves a chip; it
 * just isn't advertised. Google's scaled-content-abuse policy targets exactly
 * "one row of data poured into a template", and 838 dossiers of wildly uneven
 * depth is that shape if published wholesale.
 *
 * Only `/outlet/*` renders an article list; politician, org and bill pages are
 * profile-only, so for those three the floor is entirely about how populated
 * the row is.
 *
 * Per type, and why:
 *
 * - **politician** — sitting Congress with committees or PAC industries, OR
 *   an executive/foreign-executive row carrying a sourced statutory role.
 *   The `chamber IN ('house','senate')` restriction that previously excluded
 *   all 102 executive rows was correct for the data as it stood: their only
 *   substantive content was uncited `notes` prose about living people plus a
 *   Wikipedia link, and `founded_year` was dropped from orgs rather than
 *   sourced to Wikipedia (STATUS.md:109-113). Migration 015 removed that
 *   prose and replaced it with primary-record fields, so the gate is now the
 *   thing it always meant — sourcing, not chamber. `role_title_source` is a
 *   statute on uscode.house.gov, a constitutional provision at the National
 *   Archives, or the Senate roll-call that confirmed the appointment; every
 *   one was refetched and asserted to name the office by
 *   `sift-api/scripts/verify_role_sources.py`. Rows still lacking it — the
 *   foreign heads of state, and U.S. staff posts with no statutory record —
 *   keep rendering and keep resolving entity chips, they just aren't
 *   advertised.
 * - **org** — at least one fully-sourced substantive field. Same rule
 *   `listCitedAgencies` applies to /agencies, widened past governance.
 * - **bill** — a status and at least one external link.
 * - **outlet** — at least one rating carrying its source URL.
 * - **term** — a sourced definition AND `TERM_MIN_ARTICLES` corpus articles.
 *   The only floor here that reads a computed value rather than a column:
 *   coverage is not stored, so the SQL recomputes it. Without the coverage
 *   half a term page is a definition Cornell wrote and we cited — strictly
 *   worse than Cornell, and the "one row poured into a template" shape this
 *   whole function exists to keep out of the index. Coverage counts a title/
 *   summary match **or** a primer definition; counting only the former
 *   withheld `prior-restraint` for having "no coverage" while 128 articles
 *   were about it.
 */
export async function listSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    const result = await pool.query<{ path: string; updated_at: Date | null }>(
      `SELECT '/politician/' || bioguide_id AS path, updated_at
         FROM politician_profiles
        WHERE (chamber IN ('house', 'senate')
               AND (jsonb_array_length(COALESCE(committees, '[]'::jsonb)) > 0
                 OR jsonb_array_length(COALESCE(top_industries_current_cycle, '[]'::jsonb)) > 0))
           OR (chamber IN ('executive', 'scotus')
               AND role_title IS NOT NULL
               AND role_title_source IS NOT NULL)
           -- Foreign rows additionally expire. Mirrors
           -- ROLE_VERIFICATION_MAX_AGE_DAYS in lib/publishFloor.ts — change both.
           OR (chamber = 'foreign-executive'
               AND role_title IS NOT NULL
               AND role_title_source IS NOT NULL
               AND role_verified_at IS NOT NULL
               AND role_verified_at >= CURRENT_DATE - INTERVAL '90 days')
       UNION ALL
       SELECT '/org/' || slug, updated_at
         FROM org_profiles
        WHERE (governance_structure IS NOT NULL AND governance_source IS NOT NULL)
           OR (self_description IS NOT NULL AND self_description_source IS NOT NULL)
           OR (annual_budget_usd IS NOT NULL AND annual_budget_source IS NOT NULL)
       UNION ALL
       SELECT '/bill/' || bill_id, updated_at
         FROM bill_profiles
        WHERE status IS NOT NULL
          AND external_links::text NOT IN ('{}', 'null')
       UNION ALL
       SELECT '/outlet/' || slug, updated_at
         FROM outlet_profiles
        WHERE (allsides_rating IS NOT NULL AND allsides_url IS NOT NULL)
           OR (mbfc_factual IS NOT NULL AND mbfc_url IS NOT NULL)
       UNION ALL
       ${SITEMAP_TERM_BRANCH}`,
    );
    return result.rows.map((r) => ({
      path: r.path,
      lastModified: r.updated_at ?? new Date(),
    }));
  } catch (err) {
    // Same graceful degradation as the other profile queries: a pre-Phase-3
    // database yields a static-routes-only sitemap rather than a 500.
    if (!isMissingSchemaObject(err)) throw err;
    reportError("db.listSitemapEntries", err, { level: "warning" });
    return [];
  }
}

/**
 * Dossier params to prerender at build time, for one route's URL prefix.
 *
 * Derived from `listSitemapEntries` rather than queried directly, and that is
 * deliberate: the publish floor already has exactly two implementations (that
 * query and the predicates in `lib/publishFloor.ts`) under an invariant that
 * says change one, change the other. A third copy here would make that pair a
 * trio. Prerendering the advertised set and only the advertised set also keeps
 * the two questions aligned — the URLs we ask Google to crawl are exactly the
 * URLs we pay to build once instead of on every crawl.
 *
 * Thin rows are intentionally absent, and that costs them nothing. Next's
 * `dynamicParams` defaults to true and is left alone, so anything not returned
 * here still renders on demand exactly as before; it just isn't prebuilt.
 *
 * Fails open to `[]`. A build that cannot reach the database should ship a
 * slower site, not no site — an empty list is precisely the pre-prerender
 * behaviour, every dossier generated on first request.
 *
 * @param prefix Route segment without slashes, e.g. `"politician"`.
 * @returns The trailing path segment for each publishable dossier of that type.
 */
export async function listDossierParams(prefix: string): Promise<string[]> {
  const head = `/${prefix}/`;
  try {
    const entries = await listSitemapEntries();
    return entries
      .filter((e) => e.path.startsWith(head))
      .map((e) => e.path.slice(head.length))
      .filter((segment) => segment.length > 0);
  } catch (err) {
    reportError("db.listDossierParams", err, { level: "warning" });
    return [];
  }
}

// ─── Outlet Dossier (Phase 2.C.1) ──────────────────────

/**
 * Fetch a single outlet profile by slug. Returns null when the slug isn't
 * curated (caller should call notFound() for the dossier route) or when the
 * outlet_profiles table doesn't exist yet (pre-Phase-2.A-merge prod).
 */
async function getOutletBySlugUncached(slug: string): Promise<OutletProfile | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const result = await pool.query<DbOutletProfileRow>(
      `SELECT slug, name, parent_company, parent_company_url, founded_year,
              funding_model, allsides_rating, allsides_url, allsides_last_checked,
              mbfc_factual, mbfc_url, mbfc_last_checked,
              major_funders, external_links, notes
       FROM outlet_profiles
       WHERE slug = $1
       LIMIT 1`,
      [trimmed]
    );
    if (result.rows.length === 0) return null;
    return parseDbOutletProfile(result.rows[0]);
  } catch (err) {
    if (!isMissingSchemaObject(err, "outlet_profiles")) throw err;
    reportError("db.getOutletBySlug", err, { level: "warning" });
    return null;
  }
}

/**
 * Fetch the N most recent articles published by an outlet, identified by
 * slug. Resolves the slug → set of source_names via `source_name_aliases`
 * (explicit) ∪ `outlet_profiles.name` (implicit fallback), then queries
 * articles whose lower-cased source_name lands in that set.
 *
 * Tolerates missing tables (returns []) so the dossier can render the
 * outlet's static metadata even before sift-api Phase 2.A.1 lands in prod.
 */
export async function getRecentArticlesByOutletSlug(
  slug: string,
  limit = 20
): Promise<DbArticle[]> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return [];

  try {
    const result = await pool.query<DbArticle>(
      `WITH outlet_source_names AS (
         SELECT LOWER(name) AS sn
         FROM outlet_profiles
         WHERE slug = $1
         UNION
         SELECT LOWER(raw_source_name) AS sn
         FROM source_name_aliases
         WHERE outlet_slug = $1
       )
       SELECT id, title, summary, source_url, source_name, image_url,
              category, published_date, read_time, why_it_matters, importance_score,
              context_primer, reading_levels, created_at
       FROM articles
       WHERE LOWER(source_name) IN (SELECT sn FROM outlet_source_names)
         AND from_search = false
         AND summary IS NOT NULL AND summary != ''
         AND LOWER(summary) NOT LIKE 'unable to provide%'
       ORDER BY COALESCE(published_date, created_at) DESC NULLS LAST
       LIMIT $2`,
      [trimmed, limit]
    );
    return result.rows;
  } catch (err) {
    if (!isMissingSchemaObject(err, ["outlet_profiles", "source_name_aliases"]))
      throw err;
    reportError("db.getRecentArticlesByOutletSlug", err, { level: "warning" });
    return [];
  }
}

// ─── Term dossier (`/term/[slug]`) ─────────────────────

/**
 * The indexed prefilter expression. Must match `idx_articles_fulltext`
 * (sift-api migration 032 / `app/db.py:_apply_migrations`) **character for
 * character**, or Postgres silently falls back to a seq scan.
 */
const TERM_MATCH_TSV =
  "to_tsvector('english', COALESCE(a.title,'') || ' ' || COALESCE(a.summary,''))";
const TERM_MATCH_TEXT = "(COALESCE(a.title,'') || ' ' || COALESCE(a.summary,''))";

/**
 * SQL for "this article involves the term".
 *
 * Two independent signals, OR'd: the term appears in the title or summary, or
 * the article's own context primer defined it. The second is the subject of
 * the long note inside the function — it is what makes the page work for
 * terms that live in article bodies rather than headlines.
 *
 * Note the shift from "mentions" to "involves". Once the primer counts, an
 * article can be covered by a term it never literally prints, which is the
 * point — and it is why the copy says "stories in Sift's index" rather than
 * "stories mentioning".
 *
 * **The text half's two parts are both load-bearing; do not simplify to
 * either one alone.**
 *
 * - The `@@ phraseto_tsquery` half is only there for speed. It rides the GIN
 *   index and cuts 305k rows to a few hundred: measured 1,030 ms and ~52,000
 *   buffers down to 34 ms and 16. But Postgres FTS *stems* — the query for
 *   "temporary protected status" is really `temporari <-> protect <-> status`
 *   — so on its own it would claim coverage the page can't stand behind.
 * - The `~` / `~*` half is the actual predicate. Word-boundary, exact.
 *
 * Verified lossless when the index went in: regex-only and prefilter+regex
 * returned identical counts on all three terms with corpus volume (133 / 66 /
 * 9). If that ever stops holding, the prefilter is wrong, not the regex.
 *
 * Case sensitivity comes from `isAcronym` in lib/term.ts — see the #40 note
 * there for why "TPS" must appear as "TPS".
 */
function termMatchSql(
  patterns: TermPattern[],
  firstParam: number,
): { sql: string; params: string[] } {
  const params: string[] = [];
  const clauses = patterns.map((p) => {
    const phraseIdx = firstParam + params.length;
    params.push(p.phrase);
    const regexIdx = firstParam + params.length;
    params.push(p.regex);
    const op = p.caseSensitive ? "~" : "~*";
    return `(${TERM_MATCH_TSV} @@ phraseto_tsquery('english', $${phraseIdx})
             AND ${TERM_MATCH_TEXT} ${op} $${regexIdx})`;
  });

  // ── The primer half ──
  //
  // An article also counts when Sift's own reading-aid layer defined the term
  // for it, even if the term never reaches the headline. Without this the
  // coverage signal misses exactly the terms most worth a page, because they
  // are what a journalist writes in paragraph nine — measured against the
  // corpus: prior restraint 0 title/summary matches against 128 primer
  // definitions, certiorari 5 vs 83, qualified immunity 6 vs 75, cloture 0 vs
  // 45. `/term/prior-restraint` was withheld from the sitemap for "no
  // coverage" while 128 articles were about it.
  //
  // This does not weaken what the page claims, for two reasons:
  //
  // 1. It is still reportage about Sift's own index, not a claim about the
  //    world — the same footing the text half stands on, and why neither
  //    needs a citation beyond the articles it links.
  // 2. It is the *higher-precision* half. The primer generator read the
  //    article; the regex only sees a string. #40 is the standing reminder of
  //    what a context-free matcher does to a corpus, and it argues for this
  //    signal rather than against it.
  //
  // What the primer still cannot do is define anything: all 72,689 primer
  // terms in the corpus carry `source: null`, which is why term_profiles is
  // hand-written. Coverage, yes; definition, never.
  //
  // Case is folded on both sides — inside `primer_term_keys` (migration 033)
  // and here — because the generator is not consistent ('redistricting' 483,
  // 'Redistricting' 2).
  const primerIdx = firstParam + params.length;
  params.push(
    // Postgres text[] literal. Surface forms are curated and validated by
    // seed_term_profiles.py, but quote-escape anyway — this is string-built
    // SQL touching user-visible counts.
    `{${patterns
      .map((p) => `"${p.phrase.toLowerCase().replace(/(["\\])/g, "\\$1")}"`)
      .join(",")}}`,
  );
  clauses.push(`primer_term_keys(a.context_primer) && $${primerIdx}::text[]`);

  return { sql: `(${clauses.join(" OR ")})`, params };
}

/** The corpus filter every feed query applies — kept identical here. */
const TERM_ARTICLE_FILTER = `a.from_search = false
  AND a.summary IS NOT NULL AND a.summary <> ''
  AND LOWER(a.summary) NOT LIKE 'unable to provide%'`;

/**
 * Every term that clears the publish floor, with its coverage counts.
 *
 * Backs `/glossary`. Applies the same floor as `listSitemapEntries` — a
 * sourced definition and `TERM_MIN_ARTICLES` articles — because an index that
 * advertises pages the sitemap withholds is two different answers to one
 * question. The precedent is `listCitedAgencies`, which has always refused to
 * list an agency whose governance text lacks its source.
 *
 * `unnamed` is the column the page is built around: articles matched *only*
 * by the primer, meaning the story turns on the term without ever printing
 * it. `bool_or` per (term, article) is what makes that computable — an
 * article can match several surface forms, and it counts as named if any one
 * of them appeared in the text.
 *
 * Measured at 785 ms over 24 terms against the prod corpus. That is heavy for
 * a page, and fine for this one: ISR holds it for 30 minutes, and the numbers
 * are the argument rather than decoration.
 */
export async function listPublishedTerms(): Promise<TermListItem[]> {
  try {
    const result = await pool.query<{
      slug: string;
      term: string;
      category: string | null;
      article_count: number | null;
      outlet_count: number | null;
      unnamed_count: number | null;
      coverage_computed_at: Date | string | null;
    }>(GLOSSARY_QUERY);
    return result.rows
      .map((r) => ({
        slug: r.slug,
        term: r.term,
        category: r.category,
        articleCount: r.article_count ?? 0,
        outletCount: r.outlet_count ?? 0,
        unnamedCount: r.unnamed_count ?? 0,
        computedAt: toIsoDate(r.coverage_computed_at),
      }))
      .filter((t) => t.articleCount >= TERM_MIN_ARTICLES);
  } catch (err) {
    if (!isMissingSchemaObject(err, "term_profiles")) throw err;
    reportError("db.listPublishedTerms", err, { level: "warning" });
    return [];
  }
}

/**
 * How many terms carry a sourced definition, floor or no floor.
 *
 * The denominator for `/glossary`'s gap note. Split from
 * `listPublishedTerms` rather than derived from it because that one has
 * already applied the floor — a page that says "N held back" needs to know
 * what was filtered out, and asking the filtered list is how a count like
 * that silently becomes zero.
 */
export async function countDefinedTerms(): Promise<number> {
  try {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM term_profiles
        WHERE definition IS NOT NULL AND definition_source IS NOT NULL`,
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch (err) {
    if (!isMissingSchemaObject(err, "term_profiles")) throw err;
    reportError("db.countDefinedTerms", err, { level: "warning" });
    return 0;
  }
}

/**
 * Reads the counts `scripts/refresh_term_coverage.py` measured (migration
 * 034) instead of recomputing them across the corpus.
 *
 * The query this replaced was a lateral over term x surface-form x corpus:
 * 785 ms at 24 terms, 1,522 ms at 37, and the slope steepened because more
 * terms means more matched rows to aggregate. This is 66 ms and flat — the
 * work no longer depends on corpus size at all.
 *
 * No `String.raw` here any more, and nothing to get wrong: the word-boundary
 * escapes that made the old version fragile now live only in the refresh
 * script.
 */
const GLOSSARY_QUERY = `
  SELECT slug, term, category,
         article_count, outlet_count, unnamed_count, coverage_computed_at
    FROM term_profiles
   WHERE definition IS NOT NULL
     AND definition_source IS NOT NULL
     AND article_count IS NOT NULL
   ORDER BY article_count DESC`;

async function getTermBySlugUncached(slug: string): Promise<TermProfile | null> {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return null;

  try {
    const result = await pool.query<DbTermProfileRow>(
      `SELECT slug, term, definition, definition_source, definition_checked,
              aliases, category, notes, article_count, coverage_computed_at
         FROM term_profiles
        WHERE slug = $1
        LIMIT 1`,
      [trimmed],
    );
    if (result.rows.length === 0) return null;
    return parseDbTermProfile(result.rows[0]);
  } catch (err) {
    if (!isMissingSchemaObject(err, "term_profiles")) throw err;
    reportError("db.getTermBySlug", err, { level: "warning" });
    return null;
  }
}

/**
 * How Sift's corpus covers a term: how many articles, from which outlets, and
 * over what span.
 *
 * Nothing here is stored, and nothing here needs a citation — it is a count of
 * articles Sift holds, not a claim about the world. Which is the whole reason
 * this half of the page can be generated while the definition half has to be
 * hand-sourced. That holds for the primer half of the match too: "our own
 * reading-aid layer flagged this term for this article" is a fact about the
 * index. What the primer cannot do is *define* the term — every primer term
 * in the corpus has `source: null`.
 *
 * Outlet identity resolves the same way `getRecentArticlesByOutletSlug` does
 * (explicit `source_name_aliases`, else `outlet_profiles.name`), so an outlet
 * that publishes under several source names is counted once. An unrecognised
 * source name still appears, with a null slug and no lean — dropping it would
 * quietly understate the count the page prints.
 */
export async function getTermCoverage(term: TermProfile): Promise<TermCoverage> {
  const patterns = termPatterns(term);
  const empty: TermCoverage = {
    articleCount: 0,
    outlets: [],
    firstSeen: null,
    lastSeen: null,
  };
  if (patterns.length === 0) return empty;

  const match = termMatchSql(patterns, 1);

  try {
    const result = await pool.query<{
      source_name: string;
      slug: string | null;
      article_count: string;
      allsides_rating: string | null;
      allsides_url: string | null;
      first_seen: Date | string | null;
      last_seen: Date | string | null;
    }>(
      `WITH matched AS (
         SELECT a.source_name,
                COALESCE(a.published_date, a.created_at) AS dt
           FROM articles a
          WHERE ${TERM_ARTICLE_FILTER}
            AND ${match.sql}
       ),
       resolved AS (
         SELECT m.dt,
                COALESCE(sa.outlet_slug, op.slug) AS slug,
                m.source_name
           FROM matched m
           LEFT JOIN source_name_aliases sa
             ON LOWER(sa.raw_source_name) = LOWER(m.source_name)
           LEFT JOIN outlet_profiles op
             ON LOWER(op.name) = LOWER(m.source_name)
       )
       SELECT COALESCE(o.name, r.source_name) AS source_name,
              r.slug,
              COUNT(*)::text     AS article_count,
              o.allsides_rating,
              o.allsides_url,
              MIN(r.dt)          AS first_seen,
              MAX(r.dt)          AS last_seen
         FROM resolved r
         LEFT JOIN outlet_profiles o ON o.slug = r.slug
        GROUP BY COALESCE(o.name, r.source_name), r.slug,
                 o.allsides_rating, o.allsides_url
        ORDER BY COUNT(*) DESC, COALESCE(o.name, r.source_name) ASC`,
      match.params,
    );

    if (result.rows.length === 0) return empty;

    const outlets: TermOutletCoverage[] = result.rows.map((r) => ({
      sourceName: r.source_name,
      slug: r.slug,
      articleCount: Number(r.article_count),
      // Reuse the outlet parser's enum validation rather than trusting the
      // column: an unknown value renders as no lean, never as a bad label.
      allSidesRating: parseDbOutletProfile({
        slug: r.slug ?? "x",
        name: r.source_name,
        allsides_rating: r.allsides_rating,
        allsides_url: r.allsides_url,
      } as DbOutletProfileRow)?.allSidesRating ?? null,
      // A rating is only shown with its source — the same gate
      // `isPublishableOutlet` applies. D37: surface it verbatim, attributed.
      allSidesUrl: r.allsides_url?.trim() || null,
    }));

    const dates = result.rows
      .flatMap((r) => [r.first_seen, r.last_seen])
      .map(toIsoDate)
      .filter((d): d is string => d !== null)
      .sort();

    return {
      articleCount: outlets.reduce((n, o) => n + o.articleCount, 0),
      outlets,
      firstSeen: dates[0] ?? null,
      lastSeen: dates[dates.length - 1] ?? null,
    };
  } catch (err) {
    if (!isMissingSchemaObject(err, ["outlet_profiles", "source_name_aliases"]))
      throw err;
    reportError("db.getTermCoverage", err, { level: "warning" });
    return empty;
  }
}

/** ISO `YYYY-MM-DD` from a pg DATE/TIMESTAMP value. */
function toIsoDate(v: Date | string | null | undefined): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  }
  const t = v.trim();
  return /^\d{4}-\d{2}-\d{2}/.test(t) ? t.slice(0, 10) : null;
}

/** The N most recent articles mentioning a term. Same matcher as coverage. */
export async function getRecentArticlesByTerm(
  term: TermProfile,
  limit = 12,
): Promise<DbArticle[]> {
  const patterns = termPatterns(term);
  if (patterns.length === 0) return [];
  const match = termMatchSql(patterns, 1);

  try {
    const result = await pool.query<DbArticle>(
      `SELECT a.id, a.title, a.summary, a.source_url, a.source_name, a.image_url,
              a.category, a.published_date, a.read_time, a.why_it_matters,
              a.importance_score, a.context_primer, a.reading_levels, a.created_at
         FROM articles a
        WHERE ${TERM_ARTICLE_FILTER}
          AND ${match.sql}
        ORDER BY COALESCE(a.published_date, a.created_at) DESC NULLS LAST
        LIMIT $${match.params.length + 1}`,
      [...match.params, limit],
    );
    return result.rows;
  } catch (err) {
    if (!isMissingSchemaObject(err, "articles")) throw err;
    reportError("db.getRecentArticlesByTerm", err, { level: "warning" });
    return [];
  }
}

// ─── Daily compare example ─────────────────────────────

/**
 * The anonymous daily compare example — one real comparison per UTC day,
 * written by sift-api after a pipeline run (daily_compare_example, migration
 * 021). Read here (not proxied through Railway) because reads are the
 * frontend's path; sift-api owns only the write. Returns null before the
 * first generation or if the table doesn't exist yet.
 */
export async function getDailyCompareExample(): Promise<DailyCompareExample | null> {
  try {
    const result = await pool.query<{
      payload: CompareResponse;
      generated_at: string;
    }>(
      `SELECT payload, generated_at
       FROM daily_compare_example
       WHERE id = 1
       LIMIT 1`
    );
    if (result.rows.length === 0) return null;
    const { payload, generated_at } = result.rows[0];
    if (!payload || typeof payload !== "object" || !payload.topic) return null;
    return {
      topic: String(payload.topic),
      comparison: String(payload.comparison ?? ""),
      sources_checked: Array.isArray(payload.sources_checked)
        ? payload.sources_checked
        : [],
      claims: Array.isArray(payload.claims) ? payload.claims : [],
      duration_ms: Number(payload.duration_ms ?? 0),
      generatedAt: new Date(generated_at).toISOString(),
    };
  } catch (err) {
    if (!isMissingSchemaObject(err, "daily_compare_example")) throw err;
    reportError("db.getDailyCompareExample", err, { level: "warning" });
    return null;
  }
}

// ─── Funding edges (990 Schedule I / R) ────────────────

/**
 * Publishable outbound edges for one org, plus how many were withheld.
 *
 * Only `ein_name_agrees = 'agrees'` rows render. The counterparty EIN on a
 * 990 is a join key a human typed at the filing organization, and in the
 * first pull one was wrong (Brookings filed a grant to "Urban League of
 * Louisiana" under The Urban Institute's EIN). sift-api's ingest stores that
 * verdict per row; this query is the read side of the same rule that
 * `publishFloor` applies to dossiers — a large catalog, a smaller advertised
 * set. The withheld count comes back so the page can say so out loud.
 *
 * Returns empty when the table doesn't exist (local dev DBs predate
 * migration 027) — same graceful-degrade posture as the profile getters.
 */
export async function getFundingEdgesForOrg(
  ein: string | null,
): Promise<OrgFundingEdges> {
  const empty: OrgFundingEdges = {
    grants: [],
    related: [],
    heldForReview: 0,
    heldEinAbsent: 0,
    heldOther: 0,
    fiscalPeriods: [],
  };
  if (!ein || !/^\d{9}$/.test(ein)) return empty;

  try {
    const result = await pool.query<{
      target_ein: string | null;
      target_name_as_filed: string | null;
      target_name_irs: string | null;
      edge_kind: string;
      amount_usd: string | number | null;
      purpose: string | null;
      exempt_code: string | null;
      fiscal_period: string;
      form: string;
      filing_url: string;
      ein_name_agrees: string;
      review_decision: string | null;
    }>(
      `SELECT target_ein, target_name_as_filed, target_name_irs, edge_kind,
              amount_usd, purpose, exempt_code, fiscal_period, form,
              filing_url, ein_name_agrees, review_decision
       FROM funding_edges
       WHERE source_ein = $1
       ORDER BY amount_usd DESC NULLS LAST, target_name_as_filed ASC`,
      [ein],
    );

    const toEdge = (r: (typeof result.rows)[number]): FundingEdge => ({
      targetEin: r.target_ein,
      targetNameAsFiled: r.target_name_as_filed,
      targetNameIrs: r.target_name_irs,
      // pg returns BIGINT as a string to avoid precision loss; grant amounts
      // are far inside Number range, so coerce for display.
      amountUsd: r.amount_usd === null ? null : Number(r.amount_usd),
      purpose: r.purpose,
      exemptCode: r.exempt_code,
      fiscalPeriod: r.fiscal_period,
      form: r.form,
      filingUrl: r.filing_url,
    });

    // Publishable = the machine passed it, OR a person confirmed it — minus
    // anything a person explicitly rejected. The two layers stay separate in
    // the data (sift-api migration 028) so "the check fired and a human
    // overruled it" remains visible; only this predicate merges them.
    const publishable = result.rows.filter(
      (r) =>
        r.review_decision !== "rejected" &&
        (r.ein_name_agrees === "agrees" || r.review_decision === "confirmed"),
    );
    const undecided = result.rows.filter(
      (r) => r.ein_name_agrees !== "agrees" && r.review_decision === null,
    );
    return {
      grants: publishable.filter((r) => r.edge_kind === "grant").map(toEdge),
      related: publishable
        .filter((r) => r.edge_kind === "related_org")
        .map(toEdge),
      // Only *undecided* edges are reported as withheld. An edge a person
      // has already ruled on is settled, and counting it again would tell a
      // reader work is outstanding when it isn't.
      heldForReview: undecided.filter((r) => r.ein_name_agrees === "review").length,
      heldEinAbsent: undecided.filter((r) => r.ein_name_agrees === "ein_absent")
        .length,
      // A verdict this reader doesn't recognize. sift-api owns the vocabulary
      // and can add to it without this repo shipping; bucketing by name alone
      // would then withhold rows and report zero withheld, which is the exact
      // silent omission the counts exist to prevent. Counted as "held for a
      // reason we can't describe" rather than dropped.
      heldOther: undecided.filter(
        (r) => r.ein_name_agrees !== "review" && r.ein_name_agrees !== "ein_absent",
      ).length,
      fiscalPeriods: [
        ...new Set(publishable.map((r) => r.fiscal_period)),
      ].sort((a, b) => b.localeCompare(a)),
    };
  } catch (err) {
    if (!isMissingSchemaObject(err, "funding_edges")) throw err;
    reportError("db.getFundingEdgesForOrg", err, { level: "warning" });
    return empty;
  }
}

// ─── Per-request dossier fetchers ───────────────────────
//
// Every dossier route calls its fetcher twice per render — once in
// generateMetadata, once in the page body — and neither knows about the other.
// That is two identical round-trips for one page. React's cache() dedupes them
// for the life of a single request, so the second call is free.
//
// Only these four are wrapped, and only because their double-call is
// structural rather than incidental. The opengraph-image routes call the same
// fetchers but are a separate HTTP request, so nothing here helps them — that
// would need a real cache, not a per-request one.

/**
 * Fetch a curated politician dossier by bioguide id (the Congress.gov
 * identifier, e.g. 'S000148' for Schumer). Returns null when the bioguide
 * isn't curated (caller should call notFound() for the dossier route) or when
 * politician_profiles doesn't exist yet.
 */
export const getPoliticianByBioguide = cache(getPoliticianByBioguideUncached);

/**
 * Fetch a curated organization dossier by slug. Returns null when the slug
 * isn't curated or when org_profiles doesn't exist yet.
 */
export const getOrgBySlug = cache(getOrgBySlugUncached);

/**
 * Fetch a curated bill dossier by bill id. Returns null when the bill_id isn't
 * curated or when bill_profiles doesn't exist yet.
 */
export const getBillById = cache(getBillByIdUncached);

/**
 * Fetch a curated outlet dossier by slug. Returns null when the slug isn't
 * curated or when outlet_profiles doesn't exist yet.
 */
export const getOutletBySlug = cache(getOutletBySlugUncached);

export const getTermBySlug = cache(getTermBySlugUncached);

export default pool;
