import { describe, expect, it, vi } from "vitest";
import {
  MUSIC_META_MINIMUM_RECORD_COUNT,
  MUSIC_META_SOURCES,
  makeRegionChartKey
} from "#lib/music-recommender.js";
import { computeMusicMetasRevision, parseMusicMetas } from "#lib/server/music-metas.js";
import {
  loadMusicMetaCatalog,
  loadMusicRecommenderPageData,
  parseMusicRecommenderQuery,
  type MusicMetaFetcher,
  type MusicRecommenderPageData
} from "#lib/server/music-recommender.js";
import type { RegionBoostLoader } from "#lib/server/region-boosts.js";
import type { RegionChartLoader } from "#lib/server/region-charts.js";
import { load as loadMusicRecommenderPage } from "../../routes/music-recommender/+page.server";

const NOW = new Date("2026-09-25T00:00:00.000Z");

const makePayload = (count = MUSIC_META_MINIMUM_RECORD_COUNT) =>
  Array.from({ length: count }, (_, index) => ({
    music_id: index + 1,
    difficulty: "expert",
    music_time: 120,
    event_rate: 100,
    base_score: 100,
    base_score_auto: 80,
    skill_score_solo: [1, 2, 3, 4, 5, 6],
    skill_score_auto: [1, 2, 3, 4, 5, 6],
    skill_score_multi: [1, 2, 3, 4, 5, 6],
    fever_score: 0.2,
    fever_end_time: 100,
    tap_count: 500
  }));

const responseFor = (body: string, headers: Record<string, string> = {}, status = 200): Response =>
  new Response(body, {
    status,
    headers: {
      date: NOW.toUTCString(),
      "last-modified": NOW.toUTCString(),
      ...headers
    }
  });

const makeFetcher = (
  response: Response
): {
  fetcher: MusicMetaFetcher;
  requests: { input: string; init: RequestInit | undefined }[];
} => {
  const requests: { input: string; init: RequestInit | undefined }[] = [];
  const fetcher: MusicMetaFetcher = async (input, init) => {
    requests.push({ input, init });
    return response;
  };
  return { fetcher, requests };
};

describe("music metadata source loader", () => {
  it("uses sekai.best by default and returns normalized provenance", async () => {
    const { fetcher, requests } = makeFetcher(responseFor(JSON.stringify(makePayload())));

    const result = await loadMusicMetaCatalog(null, fetcher, () => NOW);

    expect(requests).toHaveLength(1);
    expect(requests[0].input).toBe(MUSIC_META_SOURCES["sekai-best"].url);
    expect(requests[0].init).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(result).toMatchObject({
      status: "available",
      source: MUSIC_META_SOURCES["sekai-best"],
      provenance: {
        sourceId: "sekai-best",
        sourceUrl: MUSIC_META_SOURCES["sekai-best"].url,
        recordCount: MUSIC_META_MINIMUM_RECORD_COUNT,
        fetchedAt: NOW.toISOString(),
        lastModifiedAt: NOW.toISOString()
      }
    });
    if (result.status === "available") {
      expect(result.provenance.contentHash).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("fetches only the explicitly selected Moesekai source", async () => {
    const { fetcher, requests } = makeFetcher(responseFor(JSON.stringify(makePayload())));

    const result = await loadMusicMetaCatalog("moesekai", fetcher, () => NOW);

    expect(result).toMatchObject({
      status: "available",
      source: MUSIC_META_SOURCES.moesekai,
      provenance: { sourceId: "moesekai", sourceUrl: MUSIC_META_SOURCES.moesekai.url }
    });
    expect(requests.map(({ input }) => input)).toEqual([MUSIC_META_SOURCES.moesekai.url]);
  });

  it("does not fall back to another source when the selected source fails", async () => {
    const { fetcher, requests } = makeFetcher(responseFor("unavailable", {}, 503));

    const result = await loadMusicMetaCatalog("moesekai", fetcher, () => NOW);

    expect(result).toMatchObject({ status: "unavailable", reasonCode: "http-error" });
    expect(requests.map(({ input }) => input)).toEqual([MUSIC_META_SOURCES.moesekai.url]);
  });

  it("reports a network rejection without requesting the default source", async () => {
    const requests: string[] = [];
    const fetcher: MusicMetaFetcher = async (input) => {
      requests.push(input);
      throw new Error("offline");
    };

    const result = await loadMusicMetaCatalog("moesekai", fetcher, () => NOW);

    expect(result).toMatchObject({ status: "unavailable", reasonCode: "fetch-failed" });
    expect(requests).toEqual([MUSIC_META_SOURCES.moesekai.url]);
  });

  it("rejects unknown or user-supplied URL sources without fetching", async () => {
    const requests: string[] = [];
    const fetcher: MusicMetaFetcher = async (input) => {
      requests.push(input);
      return responseFor("{}");
    };

    const result = await loadMusicMetaCatalog(
      "https://attacker.example/data.json",
      fetcher,
      () => NOW
    );

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-source",
      source: null
    });
    expect(requests).toEqual([]);
  });

  it("does not reject a source for its age or missing freshness headers", async () => {
    const aged = makeFetcher(
      responseFor(JSON.stringify(makePayload()), {
        age: "90000",
        "last-modified": "Wed, 01 Jan 2020 00:00:00 GMT"
      })
    );
    const agedResult = await loadMusicMetaCatalog("sekai-best", aged.fetcher, () => NOW);
    expect(agedResult).toMatchObject({
      status: "available",
      provenance: { lastModifiedAt: "2020-01-01T00:00:00.000Z" }
    });

    const undated = makeFetcher(new Response(JSON.stringify(makePayload()), { status: 200 }));
    const undatedResult = await loadMusicMetaCatalog("sekai-best", undated.fetcher, () => NOW);
    expect(undatedResult).toMatchObject({
      status: "available",
      provenance: { lastModifiedAt: null }
    });
  });

  it("records an unreadable Last-Modified as absent instead of failing", async () => {
    const { fetcher } = makeFetcher(
      responseFor(JSON.stringify(makePayload()), { "last-modified": "not a date" })
    );

    const result = await loadMusicMetaCatalog("sekai-best", fetcher, () => NOW);

    expect(result).toMatchObject({ status: "available", provenance: { lastModifiedAt: null } });
  });

  it("reports the contract revision as the content hash", async () => {
    const payload = makePayload();
    const parsed = parseMusicMetas(payload);
    if (parsed.status !== "ready") throw new Error("Expected a valid fixture payload.");
    const { fetcher } = makeFetcher(responseFor(JSON.stringify(payload.slice().reverse())));

    const result = await loadMusicMetaCatalog("sekai-best", fetcher, () => NOW);

    expect(result).toMatchObject({
      status: "available",
      provenance: { contentHash: `sha256:${computeMusicMetasRevision(parsed.records)}` }
    });
  });

  it.each([
    ["a non-array payload", {}, { missingFields: ["music_metas[]"], invalidFields: [] }],
    [
      "a record with an invalid skill array",
      [{ ...makePayload(1)[0], skill_score_solo: [1, 2, 3] }],
      { missingFields: [], invalidFields: ["music_metas[0].skill_score_solo"] }
    ],
    [
      "duplicate song and difficulty records",
      [makePayload(1)[0], makePayload(1)[0]],
      { missingFields: [], invalidFields: ["music_metas[1].music_id/difficulty"] }
    ]
  ])("fails closed for %s", async (_label, payload, fields) => {
    const { fetcher, requests } = makeFetcher(responseFor(JSON.stringify(payload)));

    const result = await loadMusicMetaCatalog("sekai-best", fetcher, () => NOW);

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-schema",
      ...fields
    });
    expect(requests).toHaveLength(1);
  });

  it("treats an empty catalog as incomplete", async () => {
    const { fetcher } = makeFetcher(responseFor("[]"));

    const result = await loadMusicMetaCatalog("sekai-best", fetcher, () => NOW);

    expect(result).toMatchObject({ status: "unavailable", reasonCode: "incomplete-data" });
  });

  it("reports invalid JSON and incomplete schema without trying a second source", async () => {
    const invalidJson = makeFetcher(responseFor("not-json"));
    const invalidJsonResult = await loadMusicMetaCatalog(
      "sekai-best",
      invalidJson.fetcher,
      () => NOW
    );
    expect(invalidJsonResult).toMatchObject({ status: "unavailable", reasonCode: "invalid-json" });
    expect(invalidJson.requests).toHaveLength(1);

    const incomplete = makeFetcher(responseFor(JSON.stringify(makePayload(10))));
    const incompleteResult = await loadMusicMetaCatalog(
      "sekai-best",
      incomplete.fetcher,
      () => NOW
    );
    expect(incompleteResult).toMatchObject({
      status: "unavailable",
      reasonCode: "incomplete-data",
      missingFields: ["music_metas records (minimum 3727)"]
    });
    expect(incomplete.requests).toHaveLength(1);
  });

  it("uses the route query parameter as the sole explicit source selection", async () => {
    const { fetcher, requests } = makeFetcher(responseFor("{}", {}, 503));
    const event = {
      url: new URL(
        "https://tools.example.test/music-recommender?source=moesekai&mode=jp-solo&deckPower=200000&deckBonus=0&boostMultiplier=1&skillRates=0,0,0,0,0,0&noSkill=false"
      ),
      fetch: fetcher
    };
    const load = loadMusicRecommenderPage as unknown as (
      value: typeof event
    ) => Promise<MusicRecommenderPageData>;

    const result = await load(event);

    expect(result).toMatchObject({ status: "unavailable", reasonCode: "http-error" });
    expect(requests.map(({ input }) => input)).toEqual([MUSIC_META_SOURCES.moesekai.url]);
  });

  it("keeps an invalid source unavailable instead of substituting the default", async () => {
    const { fetcher, requests } = makeFetcher(responseFor(JSON.stringify(makePayload())));

    const result = await loadMusicRecommenderPageData(
      new URLSearchParams("source=unknown-source"),
      fetcher,
      () => NOW
    );

    expect(result).toMatchObject({
      status: "unavailable",
      source: null,
      reasonCode: "invalid-source",
      inputs: { source: null }
    });
    expect(requests).toEqual([]);
  });
});

describe("music recommender query and page loader", () => {
  it("keeps an initial no-query load unavailable until raw deck power is supplied", async () => {
    const { fetcher, requests } = makeFetcher(responseFor(JSON.stringify(makePayload())));

    const result = await loadMusicRecommenderPageData(new URLSearchParams(), fetcher, () => NOW);

    expect(result).toMatchObject({
      status: "unavailable",
      source: MUSIC_META_SOURCES["sekai-best"],
      metric: "score",
      inputs: {
        source: "sekai-best",
        metric: "score",
        mode: "jp-solo",
        deckPower: null,
        deckBonus: 0,
        boostMultiplier: 1,
        skillRates: [0, 0, 0, 0, 0, 0],
        noSkill: false
      },
      reasonCode: "missing-inputs",
      reason: "A raw JP Solo deck power total is required for this calculation.",
      missingFields: ["deckPower"],
      formulaVersion: "jp-solo-community-v1"
    });
    expect(result.items).toEqual([]);
    expect(requests).toEqual([]);
  });

  it("parses submitted controls into typed JP Solo inputs and preserves normalized state", () => {
    const query = new URLSearchParams(
      "source=moesekai&metric=eventPoints&mode=jp-solo&deckPower=200000&deckBonus=20&boostMultiplier=3&skillRates=10,20,30,40,50,60&noSkill=false&eventRate=1"
    );

    const result = parseMusicRecommenderQuery(query);

    expect(result).toMatchObject({
      status: "available",
      source: MUSIC_META_SOURCES.moesekai,
      metric: "eventPoints",
      inputs: {
        source: "moesekai",
        metric: "eventPoints",
        mode: "jp-solo",
        deckPower: 200_000,
        deckBonus: 20,
        boostMultiplier: 3,
        skillRates: [10, 20, 30, 40, 50, 60],
        noSkill: false
      },
      domainInputs: {
        region: "jp",
        mode: "solo",
        cardLength: 6,
        deckPower: 200_000,
        deckBonus: 20,
        boostMultiplier: 3,
        skillAllocation: { strategy: "default", skillEffects: [10, 20, 30, 40, 50, 60] }
      }
    });
  });

  it("accepts finite effective skill rates above 100", () => {
    const result = parseMusicRecommenderQuery(
      new URLSearchParams(
        "mode=jp-solo&deckPower=1&deckBonus=0&boostMultiplier=1&skillRates=125,150,175,200,225,250&noSkill=false"
      )
    );

    expect(result).toMatchObject({
      status: "available",
      inputs: { deckPower: 1, skillRates: [125, 150, 175, 200, 225, 250] },
      domainInputs: {
        deckPower: 1,
        skillAllocation: { strategy: "default", skillEffects: [125, 150, 175, 200, 225, 250] }
      }
    });
  });

  it("preserves the accepted decimal query syntax", () => {
    const result = parseMusicRecommenderQuery(
      new URLSearchParams({
        mode: "jp-solo",
        deckPower: "+2e2",
        deckBonus: ".5",
        boostMultiplier: "1.",
        skillRates: "+1E0,2.,.3,4e-1,5,6",
        noSkill: "false"
      })
    );

    expect(result).toMatchObject({
      status: "available",
      inputs: {
        deckPower: 200,
        deckBonus: 0.5,
        boostMultiplier: 1,
        skillRates: [1, 2, 0.3, 0.4, 5, 6]
      }
    });
  });

  it("accepts long finite decimal inputs without imposing a length limit", () => {
    const result = parseMusicRecommenderQuery(
      new URLSearchParams({
        mode: "jp-solo",
        deckPower: "1",
        deckBonus: "0".repeat(10_000),
        boostMultiplier: "1",
        skillRates: "0,0,0,0,0,0",
        noSkill: "false"
      })
    );

    expect(result).toMatchObject({ status: "available", inputs: { deckBonus: 0 } });
  });

  it("rejects long adversarial invalid decimal inputs", () => {
    const adversarialNumber = `${"9".repeat(10_000)}e+`;
    const result = parseMusicRecommenderQuery(
      new URLSearchParams({
        mode: "jp-solo",
        deckPower: "1",
        deckBonus: adversarialNumber,
        boostMultiplier: "1",
        skillRates: `${adversarialNumber},0,0,0,0,0`,
        noSkill: "false"
      })
    );

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-inputs",
      invalidFields: ["deckBonus", "skillRates[0]"]
    });
  });

  it("keeps missing and invalid diagnostics in deterministic order", () => {
    const result = parseMusicRecommenderQuery(
      new URLSearchParams(
        "source=unknown&metric=invalid&deckPower=invalid&boostMultiplier=0&noSkill=maybe"
      )
    );
    const reorderedResult = parseMusicRecommenderQuery(
      new URLSearchParams(
        "noSkill=maybe&boostMultiplier=0&deckPower=invalid&metric=invalid&source=unknown"
      )
    );

    expect(result).toMatchObject({
      status: "unavailable",
      missingFields: ["deckBonus", "mode", "skillRates"],
      invalidFields: ["boostMultiplier", "deckPower", "metric", "noSkill", "source"]
    });
    expect(reorderedResult).toEqual(result);
  });

  it.each(["2.5", "9007199254740992"])(
    "rejects a non-positive-safe-integer deck power query (%s)",
    (deckPower) => {
      const result = parseMusicRecommenderQuery(
        new URLSearchParams(
          `mode=jp-solo&deckPower=${deckPower}&deckBonus=0&boostMultiplier=1&skillRates=0,0,0,0,0,0&noSkill=false`
        )
      );

      expect(result).toMatchObject({
        status: "unavailable",
        reasonCode: "invalid-inputs",
        invalidFields: ["deckPower"]
      });
    }
  );

  it("marks partial and malformed inputs unavailable without coercing values to zero", () => {
    const partial = parseMusicRecommenderQuery(new URLSearchParams("source=moesekai&deckPower=2"));
    expect(partial).toMatchObject({
      status: "unavailable",
      reasonCode: "missing-inputs",
      inputs: { deckPower: 2, deckBonus: null, skillRates: null },
      missingFields: expect.arrayContaining([
        "mode",
        "deckBonus",
        "boostMultiplier",
        "skillRates",
        "noSkill"
      ])
    });

    const malformed = parseMusicRecommenderQuery(
      new URLSearchParams(
        "mode=jp-solo&deckPower=oops&deckBonus=0&boostMultiplier=2.5&skillRates=0,0,nope,0,0,0&noSkill=false"
      )
    );
    expect(malformed).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-inputs",
      inputs: {
        deckPower: "oops",
        boostMultiplier: "2.5",
        skillRates: ["0", "0", "nope", "0", "0", "0"]
      },
      invalidFields: expect.arrayContaining(["deckPower", "boostMultiplier", "skillRates[2]"])
    });
  });

  it("maps explicit no-skill controls to six zero rates", () => {
    const result = parseMusicRecommenderQuery(
      new URLSearchParams(
        "mode=jp-solo&deckPower=1&deckBonus=0&boostMultiplier=1&skillRates=&noSkill=true"
      )
    );

    expect(result).toMatchObject({
      status: "available",
      inputs: { noSkill: true, skillRates: [0, 0, 0, 0, 0, 0] },
      domainInputs: { skillAllocation: { strategy: "default", skillEffects: [0, 0, 0, 0, 0, 0] } }
    });
  });

  it("returns ranked source-provenanced items and uses each song's own event rate", async () => {
    const payload = makePayload();
    payload[1].base_score = 200;
    payload[1].event_rate = 250;
    const { fetcher, requests } = makeFetcher(responseFor(JSON.stringify(payload)));
    const query = new URLSearchParams(
      "source=moesekai&metric=eventPoints&mode=jp-solo&deckPower=200000&deckBonus=0&boostMultiplier=1&skillRates=0,0,0,0,0,0&noSkill=false&eventRate=1"
    );

    const result = await loadMusicRecommenderPageData(query, fetcher, () => NOW);

    expect(result).toMatchObject({
      status: "available",
      source: MUSIC_META_SOURCES.moesekai,
      metric: "eventPoints",
      inputs: { deckPower: 200_000 },
      provenance: {
        sourceId: "moesekai",
        sourceUrl: MUSIC_META_SOURCES.moesekai.url,
        recordCount: MUSIC_META_MINIMUM_RECORD_COUNT
      },
      sourceHash: expect.stringMatching(/^sha256:[0-9a-f]{64}$/)
    });
    expect(result.items[0]).toMatchObject({
      rank: 1,
      musicId: 2,
      difficulty: "expert",
      musicTime: 120,
      score: 160_000_000,
      eventPoints: 20_250
    });
    expect(requests.map(({ input }) => input)).toEqual([MUSIC_META_SOURCES.moesekai.url]);
    expect(result.items[0]).not.toHaveProperty("baseScore");
  });

  it("does not fetch or calculate for malformed numeric query values", async () => {
    const requests: string[] = [];
    const fetcher: MusicMetaFetcher = async (input) => {
      requests.push(input);
      return responseFor(JSON.stringify(makePayload()));
    };

    const result = await loadMusicRecommenderPageData(
      new URLSearchParams("source=moesekai&deckPower=invalid"),
      fetcher,
      () => NOW
    );

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "invalid-inputs",
      inputs: { source: "moesekai", deckPower: "invalid" },
      invalidFields: ["deckPower"]
    });
    expect(requests).toEqual([]);
  });
});

describe("target plan in the page data", () => {
  // Every fixture song yields 80,000,000 score and 4,100 event points for this deck.
  const deck =
    "mode=jp-solo&deckPower=200000&deckBonus=0&boostMultiplier=1&skillRates=0,0,0,0,0,0&noSkill=false";

  const load = async (extra: string, response = responseFor(JSON.stringify(makePayload()))) => {
    const { fetcher, requests } = makeFetcher(response);
    const result = await loadMusicRecommenderPageData(
      new URLSearchParams(`${deck}&${extra}`),
      fetcher,
      () => NOW
    );
    return { result, requests };
  };

  it("stays idle and plans nothing when no plan control is present", async () => {
    const { result, requests } = await load("metric=score");

    expect(result.status).toBe("available");
    expect(result.plan).toMatchObject({ status: "idle", inputs: { objective: "fewestPlays" } });
    expect(requests).toHaveLength(1);
  });

  it("plans the fewest event-point lives from the calculated yields", async () => {
    const { result } = await load(
      "metric=eventPoints&target=10000&objective=fewestPlays&maxPlays=10&repeats=true"
    );

    expect(result.plan).toMatchObject({
      status: "ready",
      plan: {
        metric: "eventPoints",
        plays: 3,
        total: 12_300,
        overshoot: 2_300,
        totals: { score: 240_000_000, eventPoints: 12_300 },
        items: [{ musicId: 1, difficulty: "expert", plays: 3, yieldPerPlay: 4_100 }]
      }
    });
  });

  it("uses the score metric when it is selected", async () => {
    const { result } = await load(
      "metric=score&target=100000000&objective=fewestPlays&maxPlays=10&repeats=true"
    );

    expect(result.plan).toMatchObject({ status: "ready", plan: { metric: "score", plays: 2 } });
  });

  it("plans the least overshoot exactly", async () => {
    const { result } = await load(
      "metric=eventPoints&target=8200&objective=leastOvershoot&maxPlays=10&repeats=true"
    );

    expect(result.plan).toMatchObject({
      status: "ready",
      plan: { objective: "leastOvershoot", overshoot: 0, plays: 2 }
    });
  });

  it("reports invalid plan controls without hiding the recommendations", async () => {
    const { result } = await load("target=abc&objective=fewestPlays&maxPlays=10&repeats=true");

    expect(result.status).toBe("available");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.plan).toMatchObject({
      status: "invalid",
      invalidFields: ["target"],
      inputs: { target: "abc" }
    });
  });

  it("passes the planner's results through", async () => {
    const missing = await load(
      "target=100&objective=fewestPlays&maxPlays=10&repeats=true&required=999999:master"
    );
    const tooFewLives = await load(
      "metric=score&target=800000000&objective=fewestPlays&maxPlays=5&repeats=true"
    );
    const hugeTarget = await load(
      "metric=score&target=90000000000&objective=leastOvershoot&maxPlays=10000&repeats=true"
    );

    expect(missing.result.plan).toMatchObject({
      status: "unavailable",
      reason: "required-unavailable"
    });
    expect(tooFewLives.result.plan).toMatchObject({ status: "unavailable", reason: "plays-limit" });
    expect(hugeTarget.result.plan).toMatchObject({ status: "ready" });
  });

  it("does not plan when the yields cannot be calculated", async () => {
    const failed = await load(
      "target=100&objective=fewestPlays&maxPlays=10&repeats=true",
      responseFor("unavailable", {}, 503)
    );
    const noDeck = await loadMusicRecommenderPageData(
      new URLSearchParams(
        "deckPower=bad&target=100&objective=fewestPlays&maxPlays=10&repeats=true"
      ),
      makeFetcher(responseFor(JSON.stringify(makePayload()))).fetcher,
      () => NOW
    );

    expect(failed.result.status).toBe("unavailable");
    expect(failed.result.plan).toMatchObject({
      status: "unavailable",
      reason: "yields-unavailable"
    });
    expect(noDeck.plan).toMatchObject({ status: "unavailable", reason: "yields-unavailable" });
  });

  it("still reports the plan's own input errors when the yields are unavailable", async () => {
    const { result } = await load("target=abc", responseFor("unavailable", {}, 503));

    expect(result.status).toBe("unavailable");
    expect(result.plan).toMatchObject({ status: "invalid", invalidFields: ["target"] });
  });
});

describe("play time in the target plan", () => {
  // Every fixture song yields 4,100 event points per live. Song 5 is the short one: 74.8 s
  // against 120 s for the rest.
  const deck =
    "mode=jp-solo&deckPower=200000&deckBonus=0&boostMultiplier=1&skillRates=0,0,0,0,0,0&noSkill=false&metric=eventPoints";
  const planFor = (objective: string, target = 10_000, maxPlays = 10) =>
    `target=${target}&objective=${objective}&maxPlays=${maxPlays}&repeats=true`;
  const payload = () =>
    makePayload().map((record) =>
      record.music_id === 5 ? { ...record, music_time: 74.8 } : record
    );
  const boosts: RegionBoostLoader = async () => ({
    status: "available",
    boosts: [
      { costBoost: 0, eventPointRate: 1 },
      { costBoost: 1, eventPointRate: 5 }
    ]
  });
  const allCharts: RegionChartLoader = async () => ({
    status: "available",
    charts: new Set(
      Array.from({ length: MUSIC_META_MINIMUM_RECORD_COUNT }, (_, index) =>
        makeRegionChartKey(index + 1, "expert")
      )
    )
  });

  const load = async (query: string) => {
    const { fetcher } = makeFetcher(responseFor(JSON.stringify(payload())));
    const result = await loadMusicRecommenderPageData(
      new URLSearchParams(query),
      fetcher,
      () => NOW,
      allCharts,
      boosts
    );
    return result.plan;
  };

  it("states no play time when no overhead was entered", async () => {
    expect(await load(`${deck}&${planFor("fewestPlays")}`)).toMatchObject({
      status: "ready",
      plan: { plays: 3, time: null },
      playTime: { status: "no-overhead" }
    });
  });

  it("adds the overhead to every live's song time, in tenths of a second", async () => {
    // Fewest lives plays song 1 three times: 3 x (120.0 s + 60 s).
    expect(await load(`${deck}&${planFor("fewestPlays")}&overhead=60`)).toMatchObject({
      status: "ready",
      plan: { plays: 3, time: 5_400, items: [{ musicId: 1, plays: 3 }] },
      playTime: { status: "available", overhead: 60, total: 5_400 }
    });
    expect(await load(`${deck}&${planFor("fewestPlays")}&overhead=0`)).toMatchObject({
      playTime: { status: "available", overhead: 0, total: 3_600 }
    });
  });

  it("rounds a song time to the nearest tenth of a second", async () => {
    const { fetcher } = makeFetcher(
      responseFor(
        JSON.stringify(
          makePayload().map((record) =>
            record.music_id === 6 ? { ...record, music_time: 119.96 } : record
          )
        )
      )
    );
    const result = await loadMusicRecommenderPageData(
      new URLSearchParams(`${deck}&${planFor("fewestPlays", 4_100)}&overhead=0&required=6:expert`),
      fetcher,
      () => NOW,
      allCharts,
      boosts
    );

    expect(result.plan).toMatchObject({ status: "ready", plan: { plays: 1, time: 1_200 } });
  });

  it("plans the shortest play time with the quickest songs", async () => {
    // Song 5 three times: 3 x (74.8 s + 60 s).
    expect(await load(`${deck}&${planFor("shortestTime")}&overhead=60`)).toMatchObject({
      status: "ready",
      plan: {
        objective: "shortestTime",
        plays: 3,
        time: 4_044,
        objectiveValue: 4_044,
        items: [{ musicId: 5, plays: 3 }]
      },
      playTime: { status: "available", overhead: 60, total: 4_044 }
    });
  });

  it("counts a required song's time in the shortest plan", async () => {
    const plan = await load(`${deck}&${planFor("shortestTime")}&overhead=60&required=2:expert`);

    expect(plan).toMatchObject({
      status: "ready",
      plan: {
        plays: 3,
        time: 1_800 + 2 * 1_348,
        items: [
          { musicId: 2, plays: 1, required: true },
          { musicId: 5, plays: 2 }
        ]
      }
    });
  });

  it("plans the shortest play time for Auto lives too", async () => {
    const plan = await load(
      `${deck.replace("mode=jp-solo", "mode=auto")}&${planFor("shortestTime", 1_000)}&overhead=60`
    );

    if (plan.status !== "ready") throw new Error("Expected an Auto plan.");
    expect(plan.plan.items.map((item) => item.musicId)).toEqual([5]);
    expect(plan.playTime).toEqual({
      status: "available",
      overhead: 60,
      total: plan.plan.plays * 1_348
    });
  });

  it("keeps the lives and live bonus limits under the shortest play time", async () => {
    expect(await load(`${deck}&${planFor("shortestTime", 10_000, 2)}&overhead=60`)).toMatchObject({
      status: "unavailable",
      reason: "plays-limit"
    });
    // At multiplier 5 a live yields 20,500 and costs 1 live bonus; 50,000 needs three.
    const boosted = deck.replace("boostMultiplier=1", "boostMultiplier=5");
    const plan = `${planFor("shortestTime", 50_000)}&overhead=60`;
    expect(await load(`${boosted}&${plan}&maxLiveBonus=2`)).toMatchObject({
      status: "unavailable",
      reason: "live-bonus-limit"
    });
    expect(await load(`${boosted}&${plan}&maxLiveBonus=3`)).toMatchObject({
      status: "ready",
      plan: { plays: 3, time: 4_044 },
      liveBonus: { status: "available", total: 3, limit: 3 }
    });
  });

  it("refuses the shortest play time outside JP, where song lengths are unverified", async () => {
    expect(await load(`${deck}&region=kr&${planFor("shortestTime")}&overhead=60`)).toMatchObject({
      status: "unavailable",
      reason: "time-region-unverified",
      inputs: { objective: "shortestTime", overhead: "60" }
    });
  });

  it("states no play time outside JP but still plans the other objectives", async () => {
    expect(await load(`${deck}&region=kr&${planFor("fewestPlays")}&overhead=60`)).toMatchObject({
      status: "ready",
      plan: { plays: 3, time: null },
      playTime: { status: "region-unverified" }
    });
  });

  it("reports the plan's own input errors for the shortest play time", async () => {
    expect(await load(`${deck}&${planFor("shortestTime")}`)).toMatchObject({
      status: "invalid",
      missingFields: ["overhead"]
    });
  });
});

describe("live bonus in the target plan", () => {
  // Every fixture song yields 4,100 event points at multiplier 1, so 143,500 at multiplier 35.
  const deckAt = (boostMultiplier: number) =>
    `mode=jp-solo&deckPower=200000&deckBonus=0&boostMultiplier=${boostMultiplier}&skillRates=0,0,0,0,0,0&noSkill=false&metric=eventPoints`;
  const planFor = (target: number, maxPlays = 10) =>
    `target=${target}&objective=fewestPlays&maxPlays=${maxPlays}&repeats=true`;

  // The JP `boosts.json` pairs of 2026-11-12.
  const boostTable = (): RegionBoostLoader =>
    vi.fn(async () => ({
      status: "available" as const,
      boosts: [1, 5, 10, 15, 20, 25, 27, 29, 31, 33, 35].map((eventPointRate, costBoost) => ({
        costBoost,
        eventPointRate
      }))
    }));
  const noBoostTable = (): RegionBoostLoader =>
    vi.fn(async () => ({ status: "unavailable" as const }));
  const allCharts: RegionChartLoader = async () => ({
    status: "available",
    charts: new Set(
      Array.from({ length: MUSIC_META_MINIMUM_RECORD_COUNT }, (_, index) =>
        makeRegionChartKey(index + 1, "expert")
      )
    )
  });

  const load = async (query: string, loadBoosts: RegionBoostLoader = boostTable()) => {
    const { fetcher } = makeFetcher(responseFor(JSON.stringify(makePayload())));
    const result = await loadMusicRecommenderPageData(
      new URLSearchParams(query),
      fetcher,
      () => NOW,
      allCharts,
      loadBoosts
    );
    return { result, loadBoosts };
  };

  it("reports the lives times the cost of the entered boost", async () => {
    const { result } = await load(`${deckAt(35)}&${planFor(300_000)}`);

    expect(result.plan).toMatchObject({
      status: "ready",
      plan: { plays: 3, total: 430_500 },
      liveBonus: { status: "available", perLive: 10, total: 30, limit: null }
    });
  });

  it("plans within a live bonus limit that still allows enough lives", async () => {
    const { result } = await load(`${deckAt(35)}&${planFor(300_000)}&maxLiveBonus=30`);

    expect(result.plan).toMatchObject({
      status: "ready",
      plan: { plays: 3 },
      liveBonus: { status: "available", perLive: 10, total: 30, limit: 30 }
    });
  });

  it("refuses a plan that needs more live bonus than allowed, naming that limit", async () => {
    // 29 live bonus allows two lives of 10, which reach 287,000.
    const oneShort = await load(`${deckAt(35)}&${planFor(300_000)}&maxLiveBonus=29`);
    const lessThanOneLive = await load(`${deckAt(35)}&${planFor(300_000)}&maxLiveBonus=9`);

    expect(oneShort.result.plan).toMatchObject({
      status: "unavailable",
      reason: "live-bonus-limit"
    });
    expect(lessThanOneLive.result.plan).toMatchObject({
      status: "unavailable",
      reason: "live-bonus-limit"
    });
  });

  it("names the live bonus limit when required songs alone exceed it", async () => {
    // Three required lives of 10 against 20 live bonus, well within ten lives.
    const { result } = await load(
      `${deckAt(35)}&${planFor(300_000)}&maxLiveBonus=20&required=1:expert,2:expert,3:expert`
    );

    expect(result.plan).toMatchObject({ status: "unavailable", reason: "live-bonus-limit" });
  });

  it("applies the limit to the other objective, without repeats, and in Auto mode", async () => {
    const exact = "target=287000&objective=leastOvershoot&maxPlays=10&repeats=false";
    const fits = await load(`${deckAt(35)}&${exact}&maxLiveBonus=20`);
    const tooTight = await load(`${deckAt(35)}&${exact}&maxLiveBonus=19`);
    const auto = await load(
      `${deckAt(35).replace("mode=jp-solo", "mode=auto")}&${planFor(300_000, 100)}&maxLiveBonus=1000`
    );

    expect(fits.result.plan).toMatchObject({
      status: "ready",
      plan: { objective: "leastOvershoot", allowRepeats: false, plays: 2, overshoot: 0 },
      liveBonus: { total: 20, limit: 20 }
    });
    expect(tooTight.result.plan).toMatchObject({ reason: "live-bonus-limit" });
    if (auto.result.plan.status !== "ready") throw new Error("Expected an Auto plan.");
    expect(auto.result.plan.liveBonus).toEqual({
      status: "available",
      perLive: 10,
      total: auto.result.plan.plan.plays * 10,
      limit: 1000
    });
  });

  it("names the lives limit when that is the tighter one", async () => {
    const { result } = await load(`${deckAt(35)}&${planFor(300_000, 2)}&maxLiveBonus=1000`);

    expect(result.plan).toMatchObject({ status: "unavailable", reason: "plays-limit" });
  });

  it("does not limit lives that use no live bonus", async () => {
    const { result } = await load(`${deckAt(1)}&${planFor(10_000)}&maxLiveBonus=1`);

    expect(result.plan).toMatchObject({
      status: "ready",
      plan: { plays: 3 },
      liveBonus: { status: "available", perLive: 0, total: 0, limit: 1 }
    });
  });

  it("still plans for a multiplier outside the table, without a live bonus", async () => {
    const { result } = await load(`${deckAt(4)}&${planFor(10_000)}`);

    expect(result.plan).toMatchObject({
      status: "ready",
      plan: { plays: 1, total: 16_400 },
      liveBonus: { status: "not-in-table" }
    });
  });

  it("refuses a live bonus limit for a multiplier outside the table", async () => {
    const { result } = await load(`${deckAt(4)}&${planFor(10_000)}&maxLiveBonus=50`);

    expect(result.plan).toMatchObject({
      status: "unavailable",
      reason: "boost-not-in-table",
      invalidFields: ["boostMultiplier"]
    });
  });

  it("plans without a live bonus when the table cannot be read, and refuses a limit", async () => {
    const plain = await load(`${deckAt(5)}&${planFor(10_000)}`, noBoostTable());
    const limited = await load(`${deckAt(5)}&${planFor(10_000)}&maxLiveBonus=50`, noBoostTable());

    expect(plain.result.plan).toMatchObject({
      status: "ready",
      liveBonus: { status: "unavailable" }
    });
    expect(limited.result.plan).toMatchObject({
      status: "unavailable",
      reason: "live-bonus-unavailable"
    });
  });

  it("reads the table of the selected region, and JP when none is selected", async () => {
    const jp = await load(`${deckAt(5)}&${planFor(10_000)}`);
    const kr = await load(`${deckAt(5)}&region=kr&${planFor(10_000)}`);

    expect(jp.loadBoosts).toHaveBeenCalledExactlyOnceWith("jp");
    expect(kr.loadBoosts).toHaveBeenCalledExactlyOnceWith("kr");
    expect(kr.result.plan).toMatchObject({ status: "ready", liveBonus: { total: 1 } });
  });

  it("does not read the table when there is no plan to describe", async () => {
    const idle = await load(deckAt(5));
    const invalid = await load(`${deckAt(5)}&target=0&objective=fewestPlays&maxPlays=1`);
    const noYields = await load(`mode=jp-solo&${planFor(10_000)}`);

    expect(idle.result.plan.status).toBe("idle");
    expect(invalid.result.plan.status).toBe("invalid");
    expect(noYields.result.plan).toMatchObject({ reason: "yields-unavailable" });
    for (const { loadBoosts } of [idle, invalid, noYields]) {
      expect(loadBoosts).not.toHaveBeenCalled();
    }
  });
});

describe("region selection in the page data", () => {
  const deck =
    "mode=jp-solo&deckPower=200000&deckBonus=0&boostMultiplier=1&skillRates=0,0,0,0,0,0&noSkill=false";

  const chartsOf = (...ids: number[]): RegionChartLoader =>
    vi.fn(async () => ({
      status: "available" as const,
      charts: new Set(ids.map((id) => makeRegionChartKey(id, "expert")))
    }));

  const load = async (extra: string, loadCharts: RegionChartLoader) => {
    const { fetcher } = makeFetcher(responseFor(JSON.stringify(makePayload())));
    return loadMusicRecommenderPageData(
      new URLSearchParams(`${deck}&${extra}`),
      fetcher,
      () => NOW,
      loadCharts
    );
  };

  it("treats a missing region as JP and does not load a chart list", async () => {
    const loadCharts = chartsOf(1);

    const result = await load("metric=score", loadCharts);

    expect(result).toMatchObject({ status: "available", inputs: { region: "jp" } });
    expect(result.items).toHaveLength(MUSIC_META_MINIMUM_RECORD_COUNT);
    expect(loadCharts).not.toHaveBeenCalled();
  });

  it.each(["tw", "en", "kr"] as const)(
    "ranks only the %s songs with the JP values",
    async (region) => {
      const loadCharts = chartsOf(2, 5);

      const result = await load(`region=${region}&metric=score`, loadCharts);

      expect(loadCharts).toHaveBeenCalledWith(region);
      expect(result).toMatchObject({ status: "available", inputs: { region } });
      expect(result.items.map((item) => item.musicId)).toEqual([2, 5]);
      expect(result.items[0]).toMatchObject({ score: 80_000_000 });
    }
  );

  it("plans only from the songs of the selected region", async () => {
    const result = await load(
      "region=tw&metric=eventPoints&target=10000&objective=fewestPlays&maxPlays=10&repeats=true",
      chartsOf(7, 9)
    );

    expect(result.plan.status).toBe("ready");
    if (result.plan.status !== "ready") throw new Error("Expected a plan.");
    expect(result.plan.plan.items.map((item) => item.musicId)).toEqual([7]);
  });

  it("is unavailable, with no figures, when the region's song list cannot be loaded", async () => {
    const loadCharts: RegionChartLoader = async () => ({ status: "unavailable" });

    const result = await load("region=kr&metric=score", loadCharts);

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "region-data-unavailable",
      inputs: { region: "kr" },
      items: []
    });
    expect(result.plan.status).toBe("idle");
  });

  it.each(["cn", "TW", ""])(
    "rejects the unknown region %j without substituting JP",
    async (region) => {
      const loadCharts = chartsOf(1);

      const result = await load(`region=${region}`, loadCharts);

      expect(result).toMatchObject({
        status: "unavailable",
        reasonCode: "invalid-inputs",
        invalidFields: ["region"],
        inputs: { region: null }
      });
      expect(loadCharts).not.toHaveBeenCalled();
    }
  );

  it("rejects a repeated region parameter", async () => {
    const result = await load("region=tw&region=en", chartsOf(1));

    expect(result).toMatchObject({ status: "unavailable", invalidFields: ["region"] });
  });
});

describe("Auto mode in the page data", () => {
  const deck =
    "deckPower=200000&deckBonus=0&boostMultiplier=1&skillRates=0,0,0,0,0,0&noSkill=false";

  const load = async (mode: string, extra = "metric=score") => {
    const { fetcher } = makeFetcher(responseFor(JSON.stringify(makePayload())));
    return loadMusicRecommenderPageData(
      new URLSearchParams(`mode=${mode}&${deck}&${extra}`),
      fetcher,
      () => NOW
    );
  };

  it("calculates with the Auto base term and reports the Auto formula", async () => {
    // The fixture records have base_score 100 and base_score_auto 80.
    const solo = await load("jp-solo");
    const auto = await load("auto");

    expect(solo).toMatchObject({ status: "available", formulaVersion: "jp-solo-community-v1" });
    expect(solo.items[0]).toMatchObject({ score: 80_000_000 });
    expect(auto).toMatchObject({
      status: "available",
      formulaVersion: "jp-auto-community-v1",
      inputs: { mode: "auto" }
    });
    expect(auto.items[0]).toMatchObject({ score: 64_000_000, eventPoints: 3_300 });
  });

  it("plans from the Auto yields", async () => {
    const result = await load(
      "auto",
      "metric=eventPoints&target=10000&objective=fewestPlays&maxPlays=10&repeats=true"
    );

    // Each Auto live yields 3,300 event points for this deck, so 10,000 takes four lives.
    expect(result.plan).toMatchObject({ status: "ready", plan: { plays: 4, total: 13_200 } });
  });

  it.each(["multi", "challenge", "cheerful-carnival", "world-bloom"])(
    "keeps %s unavailable and shows the Solo formula with no figures",
    async (mode) => {
      const result = await load(mode);

      expect(result).toMatchObject({
        status: "unavailable",
        reasonCode: "unsupported-mode",
        formulaVersion: "jp-solo-community-v1",
        items: []
      });
    }
  );

  it("keeps an unavailable Auto request on the Auto formula", async () => {
    const result = await loadMusicRecommenderPageData(
      new URLSearchParams("mode=auto&deckPower=abc"),
      makeFetcher(responseFor("{}")).fetcher,
      () => NOW
    );

    expect(result).toMatchObject({ status: "unavailable", formulaVersion: "jp-auto-community-v1" });
  });
});
