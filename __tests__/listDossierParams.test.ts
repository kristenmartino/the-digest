/**
 * `listDossierParams` decides which dossiers get prebuilt at deploy time.
 *
 * Both of its failure modes are silent, which is why they are pinned here
 * rather than left to the build:
 *
 * - Return too FEW and the pages still work — they just fall back to the
 *   on-demand rendering this function exists to avoid, and the only symptom
 *   is a compute bill.
 * - Throw instead of failing open and a database blip during `next build`
 *   takes the whole deploy down.
 *
 * `lib/db` throws at import without DATABASE_URL and opens a real Pool with
 * one, so `pg` is mocked here rather than `@/lib/db` — the point is to
 * exercise the real function, not a stand-in for it.
 */
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/test";

const mockQuery = jest.fn();

jest.mock("pg", () => ({
  Pool: jest.fn(() => ({ query: mockQuery })),
}));

// Imported dynamically, not statically: the `import` statement is hoisted
// above the assignment above, so a static import re-throws the guard on
// lib/db.ts:48 before the env var is ever set.
let listDossierParams: typeof import("@/lib/db").listDossierParams;

beforeAll(async () => {
  ({ listDossierParams } = await import("@/lib/db"));
});

type Row = { path: string; updated_at: Date | null };

function rows(...paths: string[]): { rows: Row[] } {
  return { rows: paths.map((path) => ({ path, updated_at: null })) };
}

beforeEach(() => {
  mockQuery.mockReset();
});

describe("listDossierParams", () => {
  it("returns only the segments for the requested prefix", async () => {
    mockQuery.mockResolvedValue(
      rows(
        "/politician/A000001",
        "/politician/B000002",
        "/org/aclu",
        "/bill/s-5-119",
      ),
    );

    await expect(listDossierParams("politician")).resolves.toEqual([
      "A000001",
      "B000002",
    ]);
  });

  it("does not confuse prefixes that share a leading substring", async () => {
    // Guards the difference between startsWith("/org") and startsWith("/org/").
    mockQuery.mockResolvedValue(rows("/org/aclu", "/organizer/not-a-dossier"));

    await expect(listDossierParams("org")).resolves.toEqual(["aclu"]);
  });

  it("keeps a slug containing further slashes intact", async () => {
    // slice(), not split() — a bill id like "hr-1-2-119" is one segment, but
    // anything that ever carries a slash must survive whole rather than be
    // truncated at the first one.
    mockQuery.mockResolvedValue(rows("/bill/s-5-119/amended"));

    await expect(listDossierParams("bill")).resolves.toEqual([
      "s-5-119/amended",
    ]);
  });

  it("drops a bare prefix row rather than emitting an empty param", async () => {
    // An empty param would prerender the route with an empty segment.
    mockQuery.mockResolvedValue(rows("/politician/", "/politician/A000001"));

    await expect(listDossierParams("politician")).resolves.toEqual(["A000001"]);
  });

  it("returns an empty list when nothing clears the publish floor", async () => {
    mockQuery.mockResolvedValue(rows("/org/aclu"));

    await expect(listDossierParams("politician")).resolves.toEqual([]);
  });

  it("fails open when the database is unreachable", async () => {
    // The build must survive this: an unreachable DB should cost prerendering,
    // not the deploy. ECONNREFUSED is not a missing-schema error, so
    // listSitemapEntries re-throws it and this catch is the only thing
    // standing between a blip and a failed build.
    mockQuery.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), {
        code: "ECONNREFUSED",
      }),
    );

    await expect(listDossierParams("politician")).resolves.toEqual([]);
  });

  it("fails open when the table is missing entirely", async () => {
    // The pre-Phase-3 database case listSitemapEntries already degrades on.
    mockQuery.mockRejectedValue(
      Object.assign(new Error('relation "term_profiles" does not exist'), {
        code: "42P01",
      }),
    );

    await expect(listDossierParams("term")).resolves.toEqual([]);
  });
});
