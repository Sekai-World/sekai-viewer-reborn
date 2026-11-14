import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ SEKAI_MASTER_API_BASE_URL: "https://master.example/api/v1/" }));
vi.mock("$app/env/private", () => env);

import type { resolveLive2dCharacterData } from "#lib/server/live2d-characters.js";
import { resolveChibiCatalog } from "./chibi-catalog";

type Row = { character2dId?: number; spineAssetbundleName?: string };
type CharacterResolver = typeof resolveLive2dCharacterData;

const createFetcher = (pages: readonly (readonly Row[] | "fail")[]) => {
  const requestedUrls: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requestedUrls.push(url.toString());
    const page = Number(url.searchParams.get("page"));
    const rows = pages[page - 1];
    if (!rows || rows === "fail") return new Response("{}", { status: 500 });
    return Response.json({
      items: rows,
      pagination: { page, page_size: 100, total_pages: pages.length }
    });
  }) as typeof fetch;
  return { fetcher, requestedUrls };
};

/** Resolves characters from a `character2dId -> [characterId, type]` table. */
const createCharacterResolver = (
  table: Record<number, readonly [number, string]>,
  names: Record<number, string>
): CharacterResolver =>
  (async (models) => ({
    models: models.map((model) => {
      const entry = table[model.character2dId ?? -1];
      return { ...model, characterId: entry?.[0] ?? null, characterType: entry?.[1] ?? null };
    }),
    characters: Object.values(table).map(([id, characterType]) => ({
      id,
      characterType,
      name: names[id] ?? null,
      modelCount: 1
    }))
  })) as CharacterResolver;

describe("resolveChibiCatalog", () => {
  beforeEach(() => {
    env.SEKAI_MASTER_API_BASE_URL = "https://master.example/api/v1/";
  });

  it("is unavailable without a master API base URL", async () => {
    env.SEKAI_MASTER_API_BASE_URL = "  ";
    const { fetcher, requestedUrls } = createFetcher([[]]);

    await expect(resolveChibiCatalog(fetcher)).resolves.toEqual({ status: "unavailable" });
    expect(requestedUrls).toEqual([]);
  });

  it("reads every page of JP rows that have a Spine asset name", async () => {
    const { fetcher, requestedUrls } = createFetcher([
      [{ character2dId: 1, spineAssetbundleName: "sd_01ichika_normal" }],
      [{ character2dId: 2, spineAssetbundleName: "v2_sd_02saki_school" }]
    ]);

    const catalog = await resolveChibiCatalog(fetcher, createCharacterResolver({}, {}));

    expect(requestedUrls).toEqual([
      "https://master.example/api/v1/costume2ds/jp/list?page=1&page_size=100&has_spine=true",
      "https://master.example/api/v1/costume2ds/jp/list?page=2&page_size=100&has_spine=true"
    ]);
    expect(catalog).toMatchObject({
      status: "ready",
      models: [
        { modelName: "sd_01ichika_normal", family: "main" },
        { modelName: "v2_sd_02saki_school", family: "v2" }
      ]
    });
  });

  it("lists a shared asset name once and drops names outside the known families", async () => {
    const { fetcher } = createFetcher([
      [
        { spineAssetbundleName: "sd_22rin_idol" },
        { character2dId: 27, spineAssetbundleName: "sd_22rin_idol" },
        { character2dId: 165, spineAssetbundleName: "sd_22rin_idol" },
        { character2dId: 3, spineAssetbundleName: "unknown_model" },
        { character2dId: 4, spineAssetbundleName: "sd_" },
        { character2dId: 5 }
      ]
    ]);

    const resolveCharacters = createCharacterResolver({ 27: [22, "game_character"] }, {});
    const catalog = await resolveChibiCatalog(fetcher, resolveCharacters);

    // The first row that names a character supplies it.
    expect(catalog).toMatchObject({
      status: "ready",
      models: [{ modelName: "sd_22rin_idol", characterId: 22 }]
    });
    expect(catalog.status === "ready" && catalog.models).toHaveLength(1);
  });

  it("groups game characters and keeps a mob with the same ID out of the group", async () => {
    const { fetcher } = createFetcher([
      [
        { character2dId: 330, spineAssetbundleName: "v2_sd_26kaito_idol" },
        { character2dId: 57, spineAssetbundleName: "sd_staff001" }
      ]
    ]);
    const resolveCharacters = createCharacterResolver(
      { 330: [26, "game_character"], 57: [26, "mob"] },
      { 26: "KAITO" }
    );

    await expect(resolveChibiCatalog(fetcher, resolveCharacters)).resolves.toEqual({
      status: "ready",
      characters: [{ id: 26, name: "KAITO" }],
      models: [
        { modelName: "v2_sd_26kaito_idol", family: "v2", characterId: 26 },
        { modelName: "sd_staff001", family: "main", characterId: null }
      ]
    });
  });

  it("still lists the models when the character lookup fails", async () => {
    const { fetcher } = createFetcher([
      [{ character2dId: 1, spineAssetbundleName: "sd_01ichika_normal" }]
    ]);
    const resolveCharacters = (async () => {
      throw new Error("character lookup failed");
    }) as CharacterResolver;

    await expect(resolveChibiCatalog(fetcher, resolveCharacters)).resolves.toEqual({
      status: "ready",
      characters: [],
      models: [{ modelName: "sd_01ichika_normal", family: "main", characterId: null }]
    });
  });

  it.each([
    ["the first page", ["fail"] as const],
    ["a later page", [[{ spineAssetbundleName: "sd_01ichika_normal" }], "fail"] as const]
  ])("reports an error when %s fails", async (_label, pages) => {
    const { fetcher } = createFetcher(pages);

    await expect(resolveChibiCatalog(fetcher, createCharacterResolver({}, {}))).resolves.toEqual({
      status: "error"
    });
  });
});
