import { afterEach, describe, expect, it, vi } from "vitest";

const { envState, getCharacter2DsByRegionBatch, getGameCharactersByRegionList } = vi.hoisted(
  () => ({
    envState: { SEKAI_MASTER_API_BASE_URL: undefined as string | undefined },
    getCharacter2DsByRegionBatch: vi.fn(),
    getGameCharactersByRegionList: vi.fn()
  })
);

vi.mock("$env/dynamic/private", () => ({ env: envState }));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getCharacter2DsByRegionBatch,
  getGameCharactersByRegionList
}));

import { LIVE2D_CATALOG_REGION } from "$lib/live2d/associated-catalog";
import {
  createLive2dCharacterOptions,
  resolveLive2dCharacterData,
  resolveLive2dCharacterOptions
} from "./live2d-characters";

const models = [
  { characterId: 2 },
  { characterId: 1 },
  { characterId: 2 },
  {},
  { characterId: null }
] as const;

describe("Live2D character options", () => {
  afterEach(() => {
    vi.clearAllMocks();
    envState.SEKAI_MASTER_API_BASE_URL = undefined;
  });

  it("combines master API firstName and givenName in catalog order", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1/";
    getGameCharactersByRegionList.mockResolvedValue({
      data: {
        items: [
          { id: 1, firstName: "Hatsune", givenName: "Miku" },
          { id: 2, firstName: "Hoshino", givenName: "Ichika" }
        ]
      }
    });
    const fetcher = vi.fn() as unknown as typeof fetch;

    await expect(resolveLive2dCharacterOptions(models, fetcher)).resolves.toEqual([
      { id: 2, name: "Hoshino Ichika", modelCount: 2 },
      { id: 1, name: "Hatsune Miku", modelCount: 1 },
      { id: null, name: null, modelCount: 2 }
    ]);
    expect(getGameCharactersByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      fetch: fetcher,
      path: { region: LIVE2D_CATALOG_REGION },
      query: { page: 1, page_size: 100, sort_by: "seq", sort_order: "asc" }
    });
  });

  it("maps Character2D IDs to game character IDs before grouping and naming", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getCharacter2DsByRegionBatch.mockResolvedValue({
      data: {
        items: [
          { id: 101, gameCharacterId: 2 },
          { id: 102, gameCharacterId: 1 }
        ],
        missingIds: []
      }
    });
    getGameCharactersByRegionList.mockResolvedValue({
      data: {
        items: [
          { id: 1, firstName: "Hatsune", givenName: "Miku" },
          { id: 2, firstName: "Hoshino", givenName: "Ichika" },
          { id: 3, firstName: "Shinonome", givenName: "Akito" }
        ]
      }
    });

    await expect(
      resolveLive2dCharacterOptions(
        [
          { character2dId: 101, characterId: 99 },
          { character2dId: 102 },
          { character2dId: 101, characterId: 2 },
          { characterId: 3 }
        ],
        fetcher,
        "tw"
      )
    ).resolves.toEqual([
      { id: 2, name: "Hoshino Ichika", modelCount: 2 },
      { id: 1, name: "Hatsune Miku", modelCount: 1 },
      { id: 3, name: "Shinonome Akito", modelCount: 1 }
    ]);
    expect(getCharacter2DsByRegionBatch).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      fetch: fetcher,
      path: { region: "tw" },
      query: { ids: "101,102" }
    });
    expect(getGameCharactersByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      fetch: fetcher,
      path: { region: "tw" },
      query: { page: 1, page_size: 100, sort_by: "seq", sort_order: "asc" }
    });
  });

  it("resolves explicit game_character mappings through ordinary character names", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getCharacter2DsByRegionBatch.mockResolvedValue({
      data: {
        items: [{ id: 101, gameCharacterId: 1, characterType: "game_character" }],
        missingIds: []
      }
    });
    getGameCharactersByRegionList.mockResolvedValue({
      data: { items: [{ id: 1, firstName: "Hatsune", givenName: "Miku" }] }
    });

    await expect(resolveLive2dCharacterOptions([{ character2dId: 101 }], fetcher)).resolves.toEqual(
      [{ id: 1, characterType: "game_character", name: "Hatsune Miku", modelCount: 1 }]
    );
    expect(getCharacter2DsByRegionBatch).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      fetch: fetcher,
      path: { region: LIVE2D_CATALOG_REGION },
      query: { ids: "101" }
    });
    expect(getGameCharactersByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test/api/v1",
      fetch: fetcher,
      path: { region: LIVE2D_CATALOG_REGION },
      query: { page: 1, page_size: 100, sort_by: "seq", sort_order: "asc" }
    });
  });

  it.each(["omitted", "empty"])(
    "retains a catalog sub-game-character type when the Character2D type is %s",
    async (responseType) => {
      envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
      const fetcher = vi.fn() as unknown as typeof fetch;
      getCharacter2DsByRegionBatch.mockResolvedValue({
        data: {
          items: [
            {
              id: 101,
              gameCharacterId: 1,
              ...(responseType === "empty" ? { characterType: "" } : {})
            }
          ],
          missingIds: []
        }
      });

      await expect(
        resolveLive2dCharacterData(
          [{ id: "sub", character2dId: 101, characterType: "sub_game_character" }],
          fetcher
        )
      ).resolves.toEqual({
        models: [
          { id: "sub", character2dId: 101, characterId: 1, characterType: "sub_game_character" }
        ],
        characters: [{ id: 1, characterType: "sub_game_character", name: "#1", modelCount: 1 }]
      });
      expect(getGameCharactersByRegionList).not.toHaveBeenCalled();
    }
  );

  it("prefers API display names for mob and sub-game-character mappings", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getCharacter2DsByRegionBatch.mockResolvedValue({
      data: {
        items: [
          {
            id: 101,
            gameCharacterId: 1,
            characterType: "mob",
            displayName: "Street Character",
            assetName: "sub_foo"
          },
          {
            id: 102,
            gameCharacterId: 2,
            characterType: "sub_game_character",
            displayName: "Sub Character",
            assetName: "sub_bar"
          }
        ],
        missingIds: []
      }
    });

    await expect(
      resolveLive2dCharacterOptions([{ character2dId: 101 }, { character2dId: 102 }], fetcher)
    ).resolves.toEqual([
      { id: 1, characterType: "mob", name: "Street Character", modelCount: 1 },
      { id: 2, characterType: "sub_game_character", name: "Sub Character", modelCount: 1 }
    ]);
    expect(getGameCharactersByRegionList).not.toHaveBeenCalled();
  });

  it("falls back from malformed or missing display names to asset names and IDs", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getCharacter2DsByRegionBatch.mockResolvedValue({
      data: {
        items: [
          {
            id: 101,
            gameCharacterId: 1,
            characterType: "mob",
            displayName: 42,
            assetName: "sub_foo"
          },
          {
            id: 102,
            gameCharacterId: 2,
            characterType: "sub_game_character",
            displayName: " ",
            assetName: "sub_bar"
          },
          {
            id: 103,
            gameCharacterId: 3,
            characterType: "mob",
            displayName: {},
            assetName: null
          },
          {
            id: 104,
            gameCharacterId: 4,
            characterType: "sub_game_character",
            displayName: null,
            assetName: null
          }
        ],
        missingIds: []
      }
    });

    await expect(
      resolveLive2dCharacterOptions(
        [
          { character2dId: 101 },
          { character2dId: 102 },
          { character2dId: 103 },
          { character2dId: 104 }
        ],
        fetcher
      )
    ).resolves.toEqual([
      { id: 1, characterType: "mob", name: "sub_foo", modelCount: 1 },
      { id: 2, characterType: "sub_game_character", name: "sub_bar", modelCount: 1 },
      { id: 3, characterType: "mob", name: "#3", modelCount: 1 },
      { id: 4, characterType: "sub_game_character", name: "#4", modelCount: 1 }
    ]);
    expect(getGameCharactersByRegionList).not.toHaveBeenCalled();
  });

  it("keeps mob and game-character models separate when their IDs collide", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getCharacter2DsByRegionBatch.mockResolvedValue({
      data: {
        items: [
          {
            id: 101,
            gameCharacterId: 1,
            characterType: "mob",
            displayName: "Street Character",
            assetName: "sub_foo"
          },
          {
            id: 102,
            gameCharacterId: 1,
            characterType: "game_character",
            displayName: "Not the ordinary game name"
          }
        ],
        missingIds: []
      }
    });
    getGameCharactersByRegionList.mockResolvedValue({
      data: { items: [{ id: 1, firstName: "Hatsune", givenName: "Miku" }] }
    });

    await expect(
      resolveLive2dCharacterData(
        [
          { id: "mob", character2dId: 101 },
          { id: "game", character2dId: 102 }
        ],
        fetcher
      )
    ).resolves.toEqual({
      models: [
        { id: "mob", character2dId: 101, characterId: 1, characterType: "mob" },
        { id: "game", character2dId: 102, characterId: 1, characterType: "game_character" }
      ],
      characters: [
        { id: 1, characterType: "mob", name: "Street Character", modelCount: 1 },
        { id: 1, characterType: "game_character", name: "Hatsune Miku", modelCount: 1 }
      ]
    });
  });

  it("returns mapped character2d-only models in stable catalog order", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getCharacter2DsByRegionBatch.mockResolvedValue({
      data: {
        items: [
          { id: 101, gameCharacterId: 2 },
          { id: 102, gameCharacterId: 1 }
        ],
        missingIds: []
      }
    });
    getGameCharactersByRegionList.mockResolvedValue({ data: { items: [] } });
    const models = [
      { id: "first", character2dId: 101, modelName: "First" },
      { id: "second", character2dId: 102, modelName: "Second", characterId: 9 },
      { id: "third", character2dId: 101, modelName: "Third" }
    ] as const;

    const result = await resolveLive2dCharacterData(models, fetcher);

    expect(result.models).toEqual([
      { id: "first", character2dId: 101, modelName: "First", characterId: 2 },
      { id: "second", character2dId: 102, modelName: "Second", characterId: 1 },
      { id: "third", character2dId: 101, modelName: "Third", characterId: 2 }
    ]);
    expect(result.characters).toEqual([
      { id: 2, name: "#2", modelCount: 2 },
      { id: 1, name: "#1", modelCount: 1 }
    ]);
  });

  it("uses the explicit catalog character ID when Character2D lookup fails", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    getCharacter2DsByRegionBatch.mockRejectedValue(new Error("offline"));

    const result = await resolveLive2dCharacterData([
      { id: "explicit", character2dId: 101, characterId: 7 },
      { id: "unresolved", character2dId: 102 },
      { id: "plain", characterId: 3 }
    ]);

    expect(result.models).toEqual([
      { id: "explicit", character2dId: 101, characterId: 7 },
      { id: "unresolved", character2dId: 102, characterId: null },
      { id: "plain", characterId: 3 }
    ]);
  });

  it("deduplicates valid Character2D IDs and chunks requests at 100 IDs", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getCharacter2DsByRegionBatch.mockResolvedValue({
      data: { items: [], missingIds: [] }
    });
    const models = [
      ...Array.from({ length: 205 }, (_, index) => ({ character2dId: index + 1 })),
      { character2dId: 1 },
      { character2dId: 0 },
      { character2dId: -1 },
      { character2dId: null },
      { character2dId: Number.MAX_SAFE_INTEGER + 1 },
      {}
    ];

    await resolveLive2dCharacterOptions(models, fetcher);

    expect(getCharacter2DsByRegionBatch).toHaveBeenCalledTimes(3);
    expect(getCharacter2DsByRegionBatch.mock.calls.map(([options]) => options.query.ids)).toEqual([
      Array.from({ length: 100 }, (_, index) => index + 1).join(","),
      Array.from({ length: 100 }, (_, index) => index + 101).join(","),
      Array.from({ length: 5 }, (_, index) => index + 201).join(",")
    ]);
    expect(getGameCharactersByRegionList).not.toHaveBeenCalled();
  });

  it.each(["request failure", "error response", "malformed response"])(
    "falls back to catalog character IDs after a Character2D batch %s",
    async (failure: string) => {
      envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
      if (failure === "request failure") {
        getCharacter2DsByRegionBatch.mockRejectedValue(new Error("offline"));
      } else if (failure === "error response") {
        getCharacter2DsByRegionBatch.mockResolvedValue({ error: { status: 503 } });
      } else {
        getCharacter2DsByRegionBatch.mockResolvedValue({
          data: { items: "invalid", missingIds: [] }
        });
      }
      getGameCharactersByRegionList.mockResolvedValue({
        data: { items: [{ id: 7, firstName: "Shinonome", givenName: "Ena" }] }
      });

      await expect(
        resolveLive2dCharacterOptions([
          { character2dId: 101, characterId: 7 },
          { character2dId: 102 },
          { characterId: 1 }
        ])
      ).resolves.toEqual([
        { id: 7, name: "Shinonome Ena", modelCount: 1 },
        { id: null, name: null, modelCount: 1 },
        { id: 1, name: "#1", modelCount: 1 }
      ]);
    }
  );

  it("falls back to an ID when master API name fields are missing", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    getGameCharactersByRegionList.mockResolvedValue({
      data: {
        items: [
          { id: 1, firstName: null, givenName: "" },
          { id: 2, firstName: " ", givenName: undefined }
        ]
      }
    });

    await expect(resolveLive2dCharacterOptions(models)).resolves.toEqual([
      { id: 2, name: "#2", modelCount: 2 },
      { id: 1, name: "#1", modelCount: 1 },
      { id: null, name: null, modelCount: 2 }
    ]);
  });

  it("loads every character page and keeps the first positive-ID record", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    const fetcher = vi.fn() as unknown as typeof fetch;
    getGameCharactersByRegionList
      .mockResolvedValueOnce({
        data: {
          items: [
            { id: 2, firstName: "First", givenName: "Two" },
            { id: 0, firstName: "Invalid", givenName: "Zero" },
            { id: 1, firstName: "First", givenName: "One" }
          ],
          pagination: { page: 1, has_next: true, total_pages: 3 }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [
            { id: 1, firstName: "Later", givenName: "One" },
            { id: 3, firstName: "First", givenName: "Three" }
          ],
          pagination: { page: 2, has_next: true, total_pages: 3 }
        }
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ id: 2, firstName: "Later", givenName: "Two" }],
          pagination: { page: 3, has_next: false, total_pages: 3 }
        }
      });

    await expect(
      resolveLive2dCharacterOptions(
        [{ characterId: 2 }, { characterId: 3 }, { characterId: 1 }],
        fetcher
      )
    ).resolves.toEqual([
      { id: 2, name: "First Two", modelCount: 1 },
      { id: 3, name: "First Three", modelCount: 1 },
      { id: 1, name: "First One", modelCount: 1 }
    ]);
    expect(getGameCharactersByRegionList).toHaveBeenCalledTimes(3);
    expect(getGameCharactersByRegionList).toHaveBeenNthCalledWith(2, {
      baseUrl: "https://master-api.test/api/v1",
      fetch: fetcher,
      path: { region: LIVE2D_CATALOG_REGION },
      query: { page: 2, page_size: 100, sort_by: "seq", sort_order: "asc" }
    });
    expect(getGameCharactersByRegionList).toHaveBeenNthCalledWith(3, {
      baseUrl: "https://master-api.test/api/v1",
      fetch: fetcher,
      path: { region: LIVE2D_CATALOG_REGION },
      query: { page: 3, page_size: 100, sort_by: "seq", sort_order: "asc" }
    });
  });

  it("terminates safely when pagination never reports its end", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
    getGameCharactersByRegionList.mockResolvedValue({
      data: {
        items: [{ id: 1, firstName: "Hatsune", givenName: "Miku" }],
        pagination: { has_next: true }
      }
    });

    await expect(resolveLive2dCharacterOptions([{ characterId: 1 }])).resolves.toEqual([
      { id: 1, name: "Hatsune Miku", modelCount: 1 }
    ]);
    expect(getGameCharactersByRegionList).toHaveBeenCalledTimes(20);
  });

  it.each(["missing configuration", "request failure", "malformed response"])(
    "keeps ID fallbacks after a master API %s",
    async (failure: string) => {
      if (failure === "missing configuration") {
        getGameCharactersByRegionList.mockImplementation(() => {
          throw new Error("should not fetch");
        });
      } else if (failure === "request failure") {
        envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
        getGameCharactersByRegionList.mockRejectedValue(new Error("offline"));
      } else {
        envState.SEKAI_MASTER_API_BASE_URL = "https://master-api.test/api/v1";
        getGameCharactersByRegionList.mockResolvedValue({ data: { items: "invalid" } });
      }

      await expect(resolveLive2dCharacterOptions(models)).resolves.toEqual([
        { id: 2, name: "#2", modelCount: 2 },
        { id: 1, name: "#1", modelCount: 1 },
        { id: null, name: null, modelCount: 2 }
      ]);
    }
  );

  it("groups missing character IDs into the null option", () => {
    expect(createLive2dCharacterOptions([{ characterId: 7 }, {}, { characterId: 7 }])).toEqual([
      { id: 7, name: "#7", modelCount: 2 },
      { id: null, name: null, modelCount: 1 }
    ]);
  });
});
