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

  it("passes the planner's unavailable reasons through", async () => {
    const missing = await load(
      "target=100&objective=fewestPlays&maxPlays=10&repeats=true&required=999999:master"
    );
    const tooFewLives = await load(
      "metric=score&target=800000000&objective=fewestPlays&maxPlays=5&repeats=true"
    );
    const tooLarge = await load(
      "metric=score&target=90000000000&objective=leastOvershoot&maxPlays=10000&repeats=true"
    );

    expect(missing.result.plan).toMatchObject({
      status: "unavailable",
      reason: "required-unavailable"
    });
    expect(tooFewLives.result.plan).toMatchObject({ status: "unavailable", reason: "plays-limit" });
    expect(tooLarge.result.plan).toMatchObject({
      status: "unavailable",
      reason: "out-of-bounds",
      bound: { name: "sumSpan" }
    });
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
