import { describe, expect, it } from "vitest";
import { LIVE2D_ASSOCIATED_CATALOG_URL } from "$lib/live2d/associated-catalog";
import { createLive2dCatalogRouteDataResolver } from "$lib/live2d/catalog-route-data";
import {
  _createLive2dCatalogPageLoad,
  load as defaultCatalogLoad
} from "./live2d/+page.server";
import {
  _createLive2dModelPageLoad,
  load as defaultModelLoad
} from "./live2d/[modelId]/+page.server";

const sampleCatalog = [
  {
    modelBase: "sample",
    modelFile: "sample.model3.json",
    modelName: "sample-model",
    modelPath: "model/sample",
    motionSets: [
      {
        motionSetId: "normal",
        motionPath: "motion/sample",
        motionFiles: ["idle.motion3.json"],
        facialPath: "motion/sample/facial",
        facialFiles: ["smile.motion3.json"]
      }
    ]
  }
] as const;

const createFetch = (payload: unknown, status = 200) =>
  async (url: string): Promise<Response> => {
    expect(url).toBe(LIVE2D_ASSOCIATED_CATALOG_URL);
    return new Response(JSON.stringify(payload), { status });
  };

const createFailingFetch = (message: string) => async (): Promise<Response> => {
  throw new Error(message);
};

const createRouteLoads = () => {
  const resolver = createLive2dCatalogRouteDataResolver();
  return {
    loadCatalog: _createLive2dCatalogPageLoad(resolver.resolve),
    loadModel: _createLive2dModelPageLoad(resolver.resolve)
  };
};

const createRouteLoadsWithResolver = (
  resolver: ReturnType<typeof createLive2dCatalogRouteDataResolver>
) => ({
  loadCatalog: _createLive2dCatalogPageLoad(resolver.resolve),
  loadModel: _createLive2dModelPageLoad(resolver.resolve)
});

const buildModelLoadEvent = (
  params: Record<string, string | undefined>,
  fetch = createFetch(null)
) => ({ params, fetch }) as unknown as Parameters<typeof defaultModelLoad>[0];

const buildCatalogLoadEvent = (fetch: (url: string) => Promise<Response>) =>
  ({ fetch }) as unknown as Parameters<typeof defaultCatalogLoad>[0];

describe("media-lab-site Live2D catalog route", () => {
  it("returns a serializable catalog model list with separate body and facial motion arrays", async () => {
    const { loadCatalog } = createRouteLoads();
    const loaded = await loadCatalog(buildCatalogLoadEvent(createFetch(sampleCatalog)));

    expect(loaded).toMatchObject({
      track: "live2d",
      catalog: {
        status: "ready",
        source: "network",
        models: [
          {
            id: "sample-model",
            modelId: "sample-model",
            modelUrl:
              "https://storage.sekai.best/sekai-live2d-assets/model/sample/sample.model3.json",
            motionSets: [
              {
                bodyMotions: [
                  {
                    id: "idle.motion3.json",
                    url: "https://storage.sekai.best/sekai-live2d-assets/motion/sample/idle.motion3.json"
                  }
                ],
                facialMotions: [
                  {
                    id: "smile.motion3.json",
                    url: "https://storage.sekai.best/sekai-live2d-assets/motion/sample/facial/smile.motion3.json"
                  }
                ]
              }
            ]
          }
        ]
      }
    });
    expect(() => JSON.stringify(loaded)).not.toThrow();
  });

  it("returns an explicit unavailable catalog result", async () => {
    const { loadCatalog } = createRouteLoads();
    await expect(
      loadCatalog(buildCatalogLoadEvent(createFetch(null)))
    ).resolves.toMatchObject({
      catalog: { status: "unavailable", reason: "Live2D catalog is unavailable", models: [] }
    });
  });

  it("returns an explicit error catalog result without exposing an Error object", async () => {
    const { loadCatalog } = createRouteLoads();
    const loaded = await loadCatalog(buildCatalogLoadEvent(createFailingFetch("offline")));

    expect(loaded).toMatchObject({
      catalog: { status: "error", reason: "offline", models: [] }
    });
    expect(() => JSON.stringify(loaded)).not.toThrow();
  });

  it("resolves a model descriptor only after the catalog is available", async () => {
    const { loadModel } = createRouteLoads();
    const loaded = await loadModel(
      buildModelLoadEvent({ modelId: "sample-model" }, createFetch(sampleCatalog))
    );

    expect(loaded).toMatchObject({
      identity: { modelId: "sample-model" },
      viewerStatus: "catalog-model-available",
      catalog: {
        status: "ready",
        model: { modelName: "sample-model" },
        descriptor: {
          modelId: "sample-model",
          motionSets: [
            {
              bodyMotions: [{ id: "idle.motion3.json" }],
              facialMotions: [{ id: "smile.motion3.json" }]
            }
          ]
        }
      }
    });
    expect(() => JSON.stringify(loaded)).not.toThrow();
  });

  it("trims the model id before returning the identity", async () => {
    const { loadModel } = createRouteLoads();
    const catalog = [{ ...sampleCatalog[0], modelName: "normal_miku_v3" }];
    await expect(
      loadModel(buildModelLoadEvent({ modelId: " normal_miku_v3 " }, createFetch(catalog)))
    ).resolves.toMatchObject({
      identity: { modelId: "normal_miku_v3" },
      catalog: {
        status: "ready",
        descriptor: { modelId: "normal_miku_v3" }
      }
    });
  });

  it("returns the catalog failure instead of a 404 when the catalog is unavailable", async () => {
    const { loadModel } = createRouteLoads();
    await expect(
      loadModel(buildModelLoadEvent({ modelId: "sample-model" }, createFetch(null)))
    ).resolves.toMatchObject({
      catalog: { status: "unavailable" },
      descriptor: null,
      viewerStatus: "unavailable-model-contract"
    });
  });

  it("returns the catalog error instead of a 404 when fetching fails", async () => {
    const { loadModel } = createRouteLoads();
    await expect(
      loadModel(buildModelLoadEvent({ modelId: "sample-model" }, createFailingFetch("offline")))
    ).resolves.toMatchObject({
      catalog: { status: "error", reason: "offline" },
      descriptor: null,
      viewerStatus: "unavailable-model-contract"
    });
  });

  it("returns 404 for a missing model only after a catalog succeeds", async () => {
    const { loadModel } = createRouteLoads();
    await expect(
      loadModel(buildModelLoadEvent({ modelId: "missing-model" }, createFetch(sampleCatalog)))
    ).rejects.toMatchObject({ status: 404 });
  });

  it.each([undefined, "", "../escape", "a b"])(
    "rejects an unsafe model id (%s)",
    async (modelId) => {
      const { loadModel } = createRouteLoads();
      await expect(
        loadModel(buildModelLoadEvent({ modelId }))
      ).rejects.toMatchObject({ status: 404 });
    }
  );

  it("reuses a fresh catalog across landing and model route loads", async () => {
    const { loadCatalog, loadModel } = createRouteLoads();
    let requestCount = 0;
    const fetchCatalog = createFetch(sampleCatalog);
    const fetcher = async (url: string): Promise<Response> => {
      requestCount += 1;
      return fetchCatalog(url);
    };

    await loadCatalog(buildCatalogLoadEvent(fetcher));
    const loaded = await loadModel(buildModelLoadEvent({ modelId: "sample-model" }, fetcher));

    expect(requestCount).toBe(1);
    expect(loaded).toMatchObject({
      catalog: { status: "ready", source: "cache", model: { modelName: "sample-model" } }
    });
  });

  it("deduplicates concurrent fresh route loads", async () => {
    const { loadCatalog, loadModel } = createRouteLoads();
    let requestCount = 0;
    let release!: (response: Response) => void;
    const fetcher = async (url: string): Promise<Response> => {
      expect(url).toBe(LIVE2D_ASSOCIATED_CATALOG_URL);
      requestCount += 1;
      return new Promise((resolve) => {
        release = resolve;
      });
    };

    const landing = loadCatalog(buildCatalogLoadEvent(fetcher));
    const model = loadModel(buildModelLoadEvent({ modelId: "sample-model" }, fetcher));
    release(new Response(JSON.stringify(sampleCatalog)));

    const [landingData, modelData] = await Promise.all([landing, model]);
    expect(requestCount).toBe(1);
    expect(landingData).toMatchObject({ catalog: { status: "ready", source: "network" } });
    expect(modelData).toMatchObject({
      catalog: { status: "ready", source: "network", model: { modelName: "sample-model" } }
    });
  });

  it("serves the last known good route data after an expired refresh fails", async () => {
    let timestamp = 1_000;
    const resolver = createLive2dCatalogRouteDataResolver({
      ttlMs: 100,
      now: () => timestamp
    });
    const { loadCatalog } = createRouteLoadsWithResolver(resolver);

    await loadCatalog(buildCatalogLoadEvent(createFetch(sampleCatalog)));
    timestamp += 101;

    await expect(
      loadCatalog(buildCatalogLoadEvent(createFailingFetch("temporarily offline")))
    ).resolves.toMatchObject({
      catalog: {
        status: "ready",
        source: "last-known-good",
        reason: "temporarily offline"
      }
    });
  });
});
