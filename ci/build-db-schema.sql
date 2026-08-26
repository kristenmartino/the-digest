-- Minimal CI schema for the Next.js production build prerender.
--
-- This is NOT the production migration source of truth — that lives in the
-- sift-api repo (init.sql + app/db.py migrations). It exists only so that
-- `next build` can prerender the three DB-backed ISR pages against an empty,
-- throwaway Postgres in CI instead of a live database. No production secrets,
-- no real data.
--
-- The build PRERENDERS (static, ISR) "/" and "/methodology", which read:
--   getTopStoryForLanding -> articles          (app/page.tsx)
--   getAllOutletProfiles  -> outlet_profiles   (app/methodology/page.tsx)
-- "/civic" currently renders DYNAMICALLY (it reads searchParams), so its
-- queries run at request time, not at build. Its tables are included
-- defensively so this fixture stays valid if /civic becomes static again:
--   listAllPoliticiansLite -> politician_profiles  (app/civic/page.tsx)
--   listAllOrgsLite        -> org_profiles         (app/civic/page.tsx)
--   listAllBillsLite       -> bill_profiles        (app/civic/page.tsx)
-- Keep in sync with those query functions in sift/lib/db.ts.
--
-- The dossier routes (/politician, /org, /bill, /outlet, /term) additionally
-- prerender via generateStaticParams -> listDossierParams -> listSitemapEntries,
-- so that query's publish-floor columns are declared below too. It returns zero
-- rows here like everything else; what matters is that it EXECUTES, because a
-- query that errors is caught and failed open to zero params, which looks
-- identical to an empty result and would let a broken prerender path pass CI.
--
-- Tables are intentionally EMPTY: prerender only needs the queries to execute
-- (returning zero rows), not real data. Only the columns each query selects,
-- filters, or orders by are declared.
--
-- Beyond the prerendered pages, the request-time read paths a local session
-- actually exercises are declared too, so a DB built from this file serves
-- them instead of 500ing:
--   getStoriesWithArticles / getArticles -> stories, pipeline_state, and the
--     ranking columns on articles (tone, is_opinion, is_roundup, genre,
--     story_id, entity_links)          (/news, /api/news)
--   getFundingEdgesForOrg -> funding_edges  (/org/[slug] money-out sections)
--   getOrgBySlug / listCitedAgencies / listSelfDescribingOrgs -> the dossier
--     columns on org_profiles           (/org/[slug], /agencies, /think-tanks)
-- Tables the read path tolerates as missing (bookmarks, custom_topics,
-- ai_usage_daily, source aliases) are deliberately left out: their absence is
-- a supported state, and declaring them here would stop exercising it.

-- "/" landing lead story — getTopStoryForLanding()
CREATE TABLE IF NOT EXISTS articles (
  id               TEXT PRIMARY KEY,
  title            TEXT,
  summary          TEXT,
  source_url       TEXT,
  source_name      TEXT,
  image_url        TEXT,
  category         TEXT,
  published_date   TIMESTAMPTZ,
  read_time        INTEGER,
  why_it_matters   TEXT,
  importance_score NUMERIC,
  context_primer   JSONB,
  reading_levels   JSONB,
  created_at       TIMESTAMPTZ,
  from_search      BOOLEAN,
  tone             TEXT,
  is_opinion       BOOLEAN DEFAULT false,
  is_roundup       BOOLEAN DEFAULT false,
  genre            TEXT,
  story_id         TEXT,
  entity_links     JSONB
);

-- "/news" clusters — getStoriesWithArticles()
CREATE TABLE IF NOT EXISTS stories (
  id                       TEXT PRIMARY KEY,
  headline                 TEXT,
  summary                  TEXT,
  category                 TEXT,
  framings                 JSONB,
  entities                 JSONB,
  article_count            INTEGER,
  representative_image_url TEXT,
  published_date           TIMESTAMPTZ,
  created_at               TIMESTAMPTZ,
  synthesis_status         TEXT
);

-- "/news" freshness line — getLastRefreshedAt()
CREATE TABLE IF NOT EXISTS pipeline_state (
  category          TEXT PRIMARY KEY,
  last_refreshed_at TIMESTAMPTZ
);

-- "/methodology" outlet list — getAllOutletProfiles()
CREATE TABLE IF NOT EXISTS outlet_profiles (
  slug                  TEXT PRIMARY KEY,
  name                  TEXT,
  parent_company        TEXT,
  parent_company_url    TEXT,
  founded_year          INTEGER,
  funding_model         TEXT,
  allsides_rating       TEXT,
  allsides_url          TEXT,
  allsides_last_checked  DATE,
  mbfc_factual          TEXT,
  mbfc_url              TEXT,
  mbfc_last_checked     DATE,
  major_funders         JSONB,
  external_links        JSONB,
  notes                 TEXT,
  updated_at            TIMESTAMPTZ
);

-- "/civic" politician index — listAllPoliticiansLite()
CREATE TABLE IF NOT EXISTS politician_profiles (
  bioguide_id TEXT PRIMARY KEY,
  name        TEXT,
  party       TEXT,
  state       TEXT,
  chamber     TEXT,
  -- Publish-floor columns, read by listSitemapEntries() at build time.
  committees                    JSONB,
  top_industries_current_cycle  JSONB,
  role_title                    TEXT,
  role_title_source             TEXT,
  role_verified_at              DATE,
  updated_at                    TIMESTAMPTZ
);

-- "/civic" organization index — listAllOrgsLite(); the rest of the columns
-- back the "/org/[slug]" dossier, "/agencies", and "/think-tanks".
CREATE TABLE IF NOT EXISTS org_profiles (
  slug                    TEXT PRIMARY KEY,
  name                    TEXT,
  type                    TEXT,
  political_lean          TEXT,
  founded_year            INTEGER,
  annual_budget_usd       NUMERIC,
  annual_budget_fy        TEXT,
  annual_budget_source    TEXT,
  major_funders           JSONB,
  fara_registered         BOOLEAN,
  fara_countries          JSONB,
  external_links          JSONB,
  notes                   TEXT,
  self_description        TEXT,
  self_description_source TEXT,
  self_description_checked DATE,
  governance_structure    TEXT,
  governance_source       TEXT,
  updated_at              TIMESTAMPTZ
);

-- "/org/[slug]" money paid out — getFundingEdgesForOrg(). Mirrors sift-api
-- migration 027 (edges) + 028 (the two-layer verdict columns); amount_usd is
-- BIGINT there, which pg returns as a string, hence the coercion in lib/db.ts.
CREATE TABLE IF NOT EXISTS funding_edges (
  source_ein           TEXT,
  target_ein           TEXT,
  target_name_as_filed TEXT,
  target_name_irs      TEXT,
  edge_kind            TEXT,
  amount_usd           BIGINT,
  purpose              TEXT,
  exempt_code          TEXT,
  fiscal_period        TEXT,
  form                 TEXT,
  filing_url           TEXT,
  ein_name_agrees      TEXT,
  review_decision      TEXT
);

-- "/civic" bill index — listAllBillsLite()
CREATE TABLE IF NOT EXISTS bill_profiles (
  bill_id         TEXT PRIMARY KEY,
  congress        INTEGER,
  short_title     TEXT,
  status          TEXT,
  introduced_date DATE,
  external_links  JSONB,
  updated_at      TIMESTAMPTZ
);

-- Dossier prerender + sitemap — listSitemapEntries(), via listDossierParams();
-- also /glossary (listPublishedTerms) and /term/[slug] (getTermBySlug).
--
-- Declared because the publish-floor query UNIONs a /term/ branch, and that
-- query now runs at build time for every dossier route's generateStaticParams.
-- Left out, the whole UNION fails on a missing relation and every dossier
-- route fails open to zero params — which is indistinguishable from an empty
-- result, so CI would silently stop covering the prerender path.
--
-- ⚠️ This does cost one thing, and it is the tradeoff the header note warns
-- about: `term_profiles` being ABSENT is a supported runtime state
-- (`isMissingSchemaObject(err, "term_profiles")` in lib/db.ts) and a build
-- against this fixture no longer exercises it. That is why EVERY column the
-- three term queries touch is declared here — a table that exists with the
-- wrong columns is not a supported state, it is a missing-column error that
-- takes the build down, which is exactly what happened when this table was
-- first added with only the publish-floor subset.
CREATE TABLE IF NOT EXISTS term_profiles (
  slug                 TEXT PRIMARY KEY,
  term                 TEXT,
  definition           TEXT,
  definition_source    TEXT,
  definition_checked   DATE,
  aliases              JSONB,
  category             TEXT,
  notes                TEXT,
  article_count        INTEGER,
  outlet_count         INTEGER,
  unnamed_count        INTEGER,
  coverage_computed_at TIMESTAMPTZ,
  updated_at           TIMESTAMPTZ
);
