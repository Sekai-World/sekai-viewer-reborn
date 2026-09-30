import { describe, expect, it } from "vitest";
import { MUSIC_META_MINIMUM_RECORD_COUNT, MUSIC_META_SOURCES } from "$lib/music-recommender";
import {
  loadMusicMetaCatalog,
  loadMusicRecommenderPageData,
  parseMusicRecommenderQuery,
  type MusicMetaFetcher,
  type MusicRecommenderPageData
} from "$lib/server/music-recommender";
import { load as loadMusicRecommenderPage } from "../../routes/music-recommender/+page.server";

const NOW = new Date("2026-09-25T00:00:00.000Z");

const makePayload = (count = MUSIC_META_MINIMUM_RECORD_COUNT) =>
  Array.from({ length: count }, (_, index) => ({
    music_id: index + 1,
    difficulty: "expert",
    music_time: 120,
    event_rate: 100,
    base_score: 100,
    skill_score_solo: [1, 2, 3, 4, 5, 6]
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

const staleHeaderCases: { name: string; headers: Record<string, string> }[] = [
  { name: "an aged response", headers: { age: "90000" } },
  {
    name: "old source content",
    headers: { "last-modified": "Wed, 01 Jan 2025 00:00:00 GMT" }
  }
];

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
        freshness: { status: "fresh", checkedAt: NOW.toISOString() }
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

  it.each(staleHeaderCases)("returns unavailable for $name", async ({ headers }) => {
    const { fetcher } = makeFetcher(responseFor(JSON.stringify(makePayload()), headers));

    const result = await loadMusicMetaCatalog("sekai-best", fetcher, () => NOW);

    expect(result).toMatchObject({ status: "unavailable", reasonCode: "stale-data" });
  });

  it("rejects a response without a Date header", async () => {
    const response = new Response(JSON.stringify(makePayload()), {
      status: 200,
      headers: { "last-modified": NOW.toUTCString() }
    });
    const { fetcher } = makeFetcher(response);

    const result = await loadMusicMetaCatalog("sekai-best", fetcher, () => NOW);

    expect(result).toMatchObject({
      status: "unavailable",
      reasonCode: "freshness-metadata-missing",
      missingFields: ["headers.date"]
    });
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
