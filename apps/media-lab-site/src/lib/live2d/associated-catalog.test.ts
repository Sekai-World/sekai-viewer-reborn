import { describe, expect, it, vi } from "vitest";
import {
  createLive2dCatalogResolver,
  groupLive2dModelsByCharacterId,
  LIVE2D_ASSOCIATED_CATALOG_URL,
  resolveLive2dAssetRelayUrl,
  parseLive2dAssociatedCatalog,
  resolveLive2dAssetUrl,
  toLive2dAssetBucketUrlFromPath,
  toLive2dAssetRelayUrlFromPath,
  toLive2dAssetRelayUrlFromUpstreamUrl,
  type Live2dCatalogFetchJson,
  validateLive2dAssetPath
} from "./associated-catalog";

const sampleCatalog = [
  {
    characterId: 1,
    character2dId: 101,
    characterType: "sub_game_character",
    modelBase: "01ichika_normal",
    modelFile: "01ichika_normal_3.0_f_t04.model3.json",
    modelName: "01ichika_normal_3.0_f_t04",
    modelPath: "model/v1/main/01_ichika/01ichika_normal",
    motionSets: [
      {
        motionSetId: "normal",
        motionPath: "motion/v1/main/01_ichika/01ichika_normal",
        motionFiles: ["idle.motion3.json", "talk.motion3.json"],
        facialPath: "motion/v1/main/01_ichika/01ichika_normal/facial",
        facialFiles: ["smile.motion3.json"]
      }
    ]
  }
] as const;

describe("Live2D associated catalog parser", () => {
  it("normalizes the verified model and motion-set shape", () => {
    const result = parseLive2dAssociatedCatalog(sampleCatalog);

    expect(result).toEqual({
      status: "ok",
      catalog: [
        {
          region: "jp",
          characterId: 1,
          character2dId: 101,
          characterType: "sub_game_character",
          modelBase: "01ichika_normal",
          modelFile: "01ichika_normal_3.0_f_t04.model3.json",
          modelName: "01ichika_normal_3.0_f_t04",
          modelPath: "model/v1/main/01_ichika/01ichika_normal",
          modelUrl:
            "https://storage.sekai.best/sekai-live2d-assets/live2d/model/v1/main/01_ichika/01ichika_normal/01ichika_normal_3.0_f_t04.model3.json",
          motionSets: [
            {
              motionSetId: "normal",
              motionPath: "motion/v1/main/01_ichika/01ichika_normal",
              motionFiles: ["idle.motion3.json", "talk.motion3.json"],
              facialPath: "motion/v1/main/01_ichika/01ichika_normal/facial",
              facialFiles: ["smile.motion3.json"],
              bodyMotions: [
                {
                  id: "idle.motion3.json",
                  url: "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/main/01_ichika/01ichika_normal/idle.motion3.json"
                },
                {
                  id: "talk.motion3.json",
                  url: "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/main/01_ichika/01ichika_normal/talk.motion3.json"
                }
              ],
              facialMotions: [
                {
                  id: "smile.motion3.json",
                  url: "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/main/01_ichika/01ichika_normal/facial/smile.motion3.json"
                }
              ]
            }
          ]
        }
      ]
    });
  });

  it("rejects malformed roots, records, and motion-set fields", () => {
    expect(parseLive2dAssociatedCatalog({})).toMatchObject({ status: "invalid" });
    expect(parseLive2dAssociatedCatalog([null])).toMatchObject({ status: "invalid" });
    expect(
      parseLive2dAssociatedCatalog([
        {
          ...sampleCatalog[0],
          motionSets: "normal"
        }
      ])
    ).toMatchObject({ status: "invalid" });
    expect(
      parseLive2dAssociatedCatalog([
        {
          ...sampleCatalog[0],
          motionSets: [
            { ...sampleCatalog[0].motionSets[0], facialFiles: ["smile.motion3.json", 1] }
          ]
        }
      ])
    ).toMatchObject({ status: "invalid" });
  });

  it("accepts missing or null character identifiers and rejects present invalid values", () => {
    for (const field of ["characterId", "character2dId"] as const) {
      const missingField = { ...sampleCatalog[0] };
      Reflect.deleteProperty(missingField, field);
      expect(parseLive2dAssociatedCatalog([missingField])).toMatchObject({ status: "ok" });

      expect(parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], [field]: null }])).toMatchObject({
        status: "ok"
      });

      for (const value of [
        undefined,
        0,
        -1,
        1.5,
        Number.NaN,
        Number.POSITIVE_INFINITY,
        Number.MAX_SAFE_INTEGER + 1,
        "1",
        true
      ]) {
        expect(
          parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], [field]: value }])
        ).toMatchObject({
          status: "invalid",
          reason: expect.stringContaining(`catalog[0].${field}`)
        });
      }
    }

    const missingCharacterId = { ...sampleCatalog[0] };
    Reflect.deleteProperty(missingCharacterId, "characterId");
    const nullCharacterId = {
      ...sampleCatalog[0],
      characterId: null,
      character2dId: null,
      modelBase: "uncategorized_null",
      modelFile: "uncategorized_null.model3.json",
      modelName: "uncategorized_null",
      modelPath: "model/v1/main/uncategorized_null"
    };
    const parsed = parseLive2dAssociatedCatalog([missingCharacterId, nullCharacterId]);

    expect(parsed.status).toBe("ok");
    if (parsed.status !== "ok") return;

    expect(parsed.catalog.map((model) => model.characterId)).toEqual([undefined, undefined]);
    expect(parsed.catalog.map((model) => model.character2dId)).toEqual([101, undefined]);
    expect(groupLive2dModelsByCharacterId(parsed.catalog)).toEqual([
      { characterId: null, models: parsed.catalog }
    ]);
  });

  it("preserves valid character types and validates optional values", () => {
    expect(
      parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], characterType: "sub_game_character" }])
    ).toMatchObject({
      status: "ok",
      catalog: [{ characterType: "sub_game_character" }]
    });

    const missingCharacterType = { ...sampleCatalog[0] };
    Reflect.deleteProperty(missingCharacterType, "characterType");
    const missing = parseLive2dAssociatedCatalog([missingCharacterType]);
    expect(missing.status).toBe("ok");
    if (missing.status !== "ok") return;
    expect(missing.catalog[0]).not.toHaveProperty("characterType");

    const nullValue = parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], characterType: null }]);
    expect(nullValue.status).toBe("ok");
    if (nullValue.status !== "ok") return;
    expect(nullValue.catalog[0]).not.toHaveProperty("characterType");

    for (const value of [
      undefined,
      "",
      " ",
      "sub/game_character",
      "sub?game_character",
      42,
      true
    ]) {
      expect(
        parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], characterType: value }])
      ).toMatchObject({
        status: "invalid",
        reason: expect.stringContaining("catalog[0].characterType")
      });
    }
  });

  it("rejects unsafe paths and file values", () => {
    for (const override of [
      { modelBase: "model base" },
      { modelName: "model name" },
      { modelPath: "model path" },
      { motionSets: [{ ...sampleCatalog[0].motionSets[0], motionPath: "motion path" }] }
    ]) {
      expect(parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], ...override }])).toMatchObject({
        status: "invalid"
      });
    }

    for (const modelPath of ["../escape", "https://evil.example/models", "//evil.example/models"]) {
      expect(parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], modelPath }])).toMatchObject({
        status: "invalid"
      });
    }
    expect(
      parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], modelPath: "motion/v1/\u0000" }])
    ).toMatchObject({ status: "invalid" });

    expect(
      parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], modelPath: "model/v1/😀" }])
    ).toMatchObject({
      status: "ok",
      catalog: [{ modelPath: "model/v1/😀" }]
    });

    for (const override of [
      { motionPath: "motion\\v1" },
      { motionPath: "motion/v1?cache=1" },
      { facialPath: "motion/v1#facial" },
      { motionFiles: ["%2e%2e.motion3.json"] }
    ]) {
      const motionSet = { ...sampleCatalog[0].motionSets[0], ...override };
      const record = { ...sampleCatalog[0], motionSets: [motionSet] };
      expect(parseLive2dAssociatedCatalog([record])).toMatchObject({ status: "invalid" });
    }

    for (const motionFile of [
      "../face.motion3.json",
      "face/motion3.json",
      "face:motion.motion3.json",
      "face.motion3.json?cache=1",
      "face.motion3.json#fragment",
      "face%20motion.motion3.json",
      "face.motion.json",
      "face.motion3.json\u0000"
    ]) {
      const motionSet = { ...sampleCatalog[0].motionSets[0], motionFiles: [motionFile] };
      const record = { ...sampleCatalog[0], motionSets: [motionSet] };
      expect(parseLive2dAssociatedCatalog([record])).toMatchObject({ status: "invalid" });
    }
  });

  it("rejects leading or trailing whitespace in catalog directory paths", () => {
    for (const modelPath of [` ${sampleCatalog[0].modelPath}`, `${sampleCatalog[0].modelPath} `]) {
      expect(parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], modelPath }])).toMatchObject({
        status: "invalid"
      });
    }

    for (const pathField of ["motionPath", "facialPath"] as const) {
      for (const path of [
        ` ${sampleCatalog[0].motionSets[0][pathField]}`,
        `${sampleCatalog[0].motionSets[0][pathField]} `
      ]) {
        const motionSet = { ...sampleCatalog[0].motionSets[0], [pathField]: path };
        expect(
          parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], motionSets: [motionSet] }])
        ).toMatchObject({ status: "invalid" });
      }
    }
  });

  it("accepts spaces inside validated motion file names", () => {
    const motionFile = "face_ worry_01.motion3.json";
    const motionSet = { ...sampleCatalog[0].motionSets[0], motionFiles: [motionFile] };

    expect(
      parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], motionSets: [motionSet] }])
    ).toMatchObject({
      status: "ok",
      catalog: [
        {
          motionSets: [
            {
              motionFiles: [motionFile],
              bodyMotions: [
                {
                  id: motionFile,
                  url: "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/main/01_ichika/01ichika_normal/face_%20worry_01.motion3.json"
                }
              ]
            }
          ]
        }
      ]
    });
  });

  it("rejects leading or trailing whitespace in model and motion file names", () => {
    for (const fileName of [" sample.model3.json", "sample.model3.json "]) {
      expect(
        parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], modelFile: fileName }])
      ).toMatchObject({ status: "invalid" });
    }

    for (const fileName of [" face.motion3.json", "face.motion3.json "]) {
      const motionSet = { ...sampleCatalog[0].motionSets[0], motionFiles: [fileName] };
      expect(
        parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], motionSets: [motionSet] }])
      ).toMatchObject({ status: "invalid" });
    }
  });

  it("constructs URLs only for safe bucket-relative path/file pairs", () => {
    expect(resolveLive2dAssetUrl("motion/v1/main", "idle.motion3.json")).toBe(
      "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/main/idle.motion3.json"
    );
    expect(resolveLive2dAssetUrl("motion/v1/main///", "idle.motion3.json")).toBe(
      "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/main/idle.motion3.json"
    );
    expect(resolveLive2dAssetUrl("../outside", "idle.motion3.json")).toBeNull();
    expect(resolveLive2dAssetUrl("motion/v1", "../idle.motion3.json")).toBeNull();
    expect(resolveLive2dAssetUrl("//evil.example", "idle.motion3.json")).toBeNull();
    expect(resolveLive2dAssetUrl("motion/v1?x=1", "idle.motion3.json")).toBeNull();
  });

  it("shares canonical relay and bucket URL validation", () => {
    const assetPath = "motion/v1/main/01_ichika/01ichika_normal/face_ worry_01.motion3.json";
    const collabModelPath = "model/v1/collabo/23_len/clb01_23len";
    const collabModelFile = "23len_collabo01_t01.model3.json";
    const collabModelUrl =
      "https://storage.sekai.best/sekai-live2d-assets/live2d/model/v1/collabo/23_len/clb01_23len/23len_collabo01_t01.model3.json";
    const validation = validateLive2dAssetPath(assetPath);

    expect(validation).toEqual({
      status: "ok",
      asset: {
        path: assetPath,
        namespace: "motion",
        fileName: "face_ worry_01.motion3.json"
      }
    });
    expect(toLive2dAssetRelayUrlFromPath(assetPath)).toBe(
      "/live2d/assets/motion/v1/main/01_ichika/01ichika_normal/face_%20worry_01.motion3.json"
    );
    expect(toLive2dAssetBucketUrlFromPath(assetPath)).toBe(
      "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/main/01_ichika/01ichika_normal/face_%20worry_01.motion3.json"
    );
    expect(resolveLive2dAssetUrl(collabModelPath, collabModelFile)).toBe(collabModelUrl);
    expect(toLive2dAssetRelayUrlFromUpstreamUrl(collabModelUrl)).toBe(
      "/live2d/assets/model/v1/collabo/23_len/clb01_23len/23len_collabo01_t01.model3.json"
    );
    expect(
      toLive2dAssetRelayUrlFromUpstreamUrl(collabModelUrl.replace("/live2d/model/", "/model/"))
    ).toBeNull();
    expect(
      resolveLive2dAssetRelayUrl(
        "motion/v1/main/01_ichika/01ichika_normal",
        "face_ worry_01.motion3.json"
      )
    ).toBe("/live2d/assets/motion/v1/main/01_ichika/01ichika_normal/face_%20worry_01.motion3.json");
    expect(
      toLive2dAssetRelayUrlFromUpstreamUrl(
        "https://storage.sekai.best/sekai-live2d-assets/live2d/" +
          "motion/v1/main/01_ichika/01ichika_normal/face_%20worry_01.motion3.json"
      )
    ).toBe("/live2d/assets/motion/v1/main/01_ichika/01ichika_normal/face_%20worry_01.motion3.json");

    for (const invalidPath of [
      "",
      "model",
      "model/",
      "model//file.moc3",
      "model/./file.moc3",
      "model/../file.moc3",
      "model/path with spaces/file.moc3",
      "other/file.moc3",
      "model/file%20name.moc3",
      "model/file.moc3?cache=1",
      "model/file.moc3#fragment",
      "/model/file.moc3",
      "//storage.sekai.best/model/file.moc3",
      "https://storage.sekai.best/sekai-live2d-assets/model/file.moc3",
      " model/file.moc3",
      "model/file.moc3 "
    ]) {
      expect(validateLive2dAssetPath(invalidPath)).toMatchObject({ status: "invalid" });
    }
    expect(toLive2dAssetRelayUrlFromUpstreamUrl("https://evil.example/model/file.moc3")).toBeNull();
    expect(
      toLive2dAssetRelayUrlFromUpstreamUrl(
        "https://storage.sekai.best/sekai-live2d-assets/live2d/model/v1/../file.moc3"
      )
    ).toBeNull();
  });

  it("accepts distinct model records that share a model name", () => {
    const duplicateNameCatalog = [
      sampleCatalog[0],
      {
        ...sampleCatalog[0],
        modelBase: "01ichika_normal_alt",
        modelFile: "01ichika_normal_alt.model3.json",
        modelName: sampleCatalog[0].modelName,
        modelPath: "model/v1/main/01_ichika/01ichika_normal_alt"
      }
    ];

    expect(parseLive2dAssociatedCatalog(duplicateNameCatalog)).toMatchObject({
      status: "ok",
      catalog: [
        { modelName: "01ichika_normal_3.0_f_t04" },
        {
          modelName: "01ichika_normal_3.0_f_t04",
          modelBase: "01ichika_normal_alt",
          modelUrl:
            "https://storage.sekai.best/sekai-live2d-assets/live2d/model/v1/main/01_ichika/01ichika_normal_alt/01ichika_normal_alt.model3.json"
        }
      ]
    });
  });

  it("groups route models stably when one character has multiple 2D IDs", () => {
    const parsed = parseLive2dAssociatedCatalog([
      sampleCatalog[0],
      {
        ...sampleCatalog[0],
        character2dId: 102,
        modelBase: "01ichika_normal_alt",
        modelFile: "01ichika_normal_alt.model3.json",
        modelName: "01ichika_normal_alt",
        modelPath: "model/v1/main/01_ichika/01ichika_normal_alt"
      },
      {
        ...sampleCatalog[0],
        characterId: 2,
        character2dId: 201,
        modelBase: "02saki_normal",
        modelFile: "02saki_normal.model3.json",
        modelName: "02saki_normal",
        modelPath: "model/v1/main/02_saki/02saki_normal"
      }
    ]);

    expect(parsed.status).toBe("ok");
    if (parsed.status !== "ok") return;

    const routeModels = parsed.catalog.map((model, index) => ({
      ...model,
      modelId: `route-model-${index}`
    }));
    const groups = groupLive2dModelsByCharacterId(routeModels);

    expect(
      groups.map(({ characterId, models }) => ({
        characterId,
        modelIds: models.map((model) => model.modelId),
        character2dIds: models.map((model) => model.character2dId)
      }))
    ).toEqual([
      {
        characterId: 1,
        modelIds: ["route-model-0", "route-model-1"],
        character2dIds: [101, 102]
      },
      {
        characterId: 2,
        modelIds: ["route-model-2"],
        character2dIds: [201]
      }
    ]);
  });

  it("rejects duplicate model identities, motion sets, and files", () => {
    expect(parseLive2dAssociatedCatalog([sampleCatalog[0], sampleCatalog[0]])).toMatchObject({
      status: "invalid"
    });
    expect(
      parseLive2dAssociatedCatalog([
        sampleCatalog[0],
        { ...sampleCatalog[0], modelName: "other-name" }
      ])
    ).toMatchObject({ status: "invalid" });
    expect(
      parseLive2dAssociatedCatalog([
        {
          ...sampleCatalog[0],
          motionSets: [sampleCatalog[0].motionSets[0], sampleCatalog[0].motionSets[0]]
        }
      ])
    ).toMatchObject({ status: "invalid" });
    expect(
      parseLive2dAssociatedCatalog([
        {
          ...sampleCatalog[0],
          motionSets: [
            {
              ...sampleCatalog[0].motionSets[0],
              motionFiles: ["idle.motion3.json", "idle.motion3.json"]
            }
          ]
        }
      ])
    ).toMatchObject({ status: "invalid" });
    expect(
      parseLive2dAssociatedCatalog([
        {
          ...sampleCatalog[0],
          motionSets: [
            {
              ...sampleCatalog[0].motionSets[0],
              facialFiles: ["smile.motion3.json", "smile.motion3.json"]
            }
          ]
        }
      ])
    ).toMatchObject({ status: "invalid" });
  });
});

describe("Live2D associated catalog resolver", () => {
  it("reports fetch errors and explicit unavailable responses", async () => {
    const failedResolver = createLive2dCatalogResolver({
      fetchJson: vi.fn<Live2dCatalogFetchJson>().mockRejectedValue(new Error("offline"))
    });
    await expect(failedResolver.resolve()).resolves.toMatchObject({
      status: "error",
      error: new Error("offline")
    });

    const unavailableResolver = createLive2dCatalogResolver({
      fetchJson: vi.fn<Live2dCatalogFetchJson>().mockResolvedValue(undefined)
    });
    await expect(unavailableResolver.resolve()).resolves.toEqual({
      status: "unavailable",
      reason: "Live2D catalog is unavailable"
    });
  });

  it("reuses fresh cache entries and invalidates them on demand", async () => {
    let timestamp = 1_000;
    const fetchJson = vi.fn<Live2dCatalogFetchJson>().mockResolvedValue(sampleCatalog);
    const resolver = createLive2dCatalogResolver({
      fetchJson,
      ttlMs: 100,
      now: () => timestamp
    });

    await expect(resolver.resolve()).resolves.toMatchObject({
      status: "available",
      source: "network"
    });
    timestamp += 50;
    await expect(resolver.resolve()).resolves.toMatchObject({
      status: "available",
      source: "cache"
    });
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson).toHaveBeenCalledWith(LIVE2D_ASSOCIATED_CATALOG_URL);

    resolver.invalidate();
    await expect(resolver.resolve()).resolves.toMatchObject({
      status: "available",
      source: "network"
    });
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("serves the last known good catalog after an expired refresh fails", async () => {
    let timestamp = 1_000;
    const fetchJson = vi
      .fn<Live2dCatalogFetchJson>()
      .mockResolvedValueOnce(sampleCatalog)
      .mockRejectedValueOnce(new Error("temporarily offline"));
    const resolver = createLive2dCatalogResolver({
      fetchJson,
      ttlMs: 100,
      now: () => timestamp
    });

    const first = await resolver.resolve();
    timestamp += 101;
    const stale = await resolver.resolve();

    expect(first.status).toBe("available");
    expect(stale).toMatchObject({
      status: "available",
      source: "last-known-good",
      reason: "temporarily offline"
    });
    if (first.status === "available" && stale.status === "available") {
      expect(stale.catalog).toEqual(first.catalog);
    }
  });

  it("does not cache malformed payloads", async () => {
    const fetchJson = vi
      .fn<Live2dCatalogFetchJson>()
      .mockResolvedValueOnce({ malformed: true })
      .mockResolvedValueOnce(sampleCatalog);
    const resolver = createLive2dCatalogResolver({ fetchJson, ttlMs: 10_000 });

    await expect(resolver.resolve()).resolves.toMatchObject({ status: "error" });
    await expect(resolver.resolve()).resolves.toMatchObject({
      status: "available",
      source: "network"
    });
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });
});
