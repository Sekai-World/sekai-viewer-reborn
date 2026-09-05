import { describe, expect, it, vi } from "vitest";
import {
  createLive2dCatalogResolver,
  LIVE2D_ASSOCIATED_CATALOG_URL,
  parseLive2dAssociatedCatalog,
  resolveLive2dAssetUrl,
  type Live2dCatalogFetchJson
} from "./associated-catalog";

const sampleCatalog = [
  {
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
          modelBase: "01ichika_normal",
          modelFile: "01ichika_normal_3.0_f_t04.model3.json",
          modelName: "01ichika_normal_3.0_f_t04",
          modelPath: "model/v1/main/01_ichika/01ichika_normal",
          modelUrl:
            "https://storage.sekai.best/sekai-live2d-assets/model/v1/main/01_ichika/01ichika_normal/01ichika_normal_3.0_f_t04.model3.json",
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
                  url: "https://storage.sekai.best/sekai-live2d-assets/motion/v1/main/01_ichika/01ichika_normal/idle.motion3.json"
                },
                {
                  id: "talk.motion3.json",
                  url: "https://storage.sekai.best/sekai-live2d-assets/motion/v1/main/01_ichika/01ichika_normal/talk.motion3.json"
                }
              ],
              facialMotions: [
                {
                  id: "smile.motion3.json",
                  url: "https://storage.sekai.best/sekai-live2d-assets/motion/v1/main/01_ichika/01ichika_normal/facial/smile.motion3.json"
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

  it("rejects unsafe paths and file values", () => {
    for (const modelPath of ["../escape", "https://evil.example/models", "//evil.example/models"]) {
      expect(parseLive2dAssociatedCatalog([{ ...sampleCatalog[0], modelPath }])).toMatchObject({
        status: "invalid"
      });
    }

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
  });

  it("constructs URLs only for safe bucket-relative path/file pairs", () => {
    expect(resolveLive2dAssetUrl("motion/v1/main", "idle.motion3.json")).toBe(
      "https://storage.sekai.best/sekai-live2d-assets/motion/v1/main/idle.motion3.json"
    );
    expect(resolveLive2dAssetUrl("motion/v1/main/", "idle.motion3.json")).toBe(
      "https://storage.sekai.best/sekai-live2d-assets/motion/v1/main/idle.motion3.json"
    );
    expect(resolveLive2dAssetUrl("../outside", "idle.motion3.json")).toBeNull();
    expect(resolveLive2dAssetUrl("motion/v1", "../idle.motion3.json")).toBeNull();
    expect(resolveLive2dAssetUrl("//evil.example", "idle.motion3.json")).toBeNull();
    expect(resolveLive2dAssetUrl("motion/v1?x=1", "idle.motion3.json")).toBeNull();
  });

  it("rejects duplicate model identities, names, motion sets, and files", () => {
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
