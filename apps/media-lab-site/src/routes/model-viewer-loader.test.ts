import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({ env: {} }));

import { LIVE2D_ASSOCIATED_CATALOG_URL } from "$lib/live2d/associated-catalog";
import {
  createLive2dCatalogRouteDataResolver,
  type Live2dCatalogRouteData
} from "$lib/live2d/catalog-route-data";
import { _createLive2dCatalogPageLoad, load as defaultCatalogLoad } from "./live2d/+page.server";
import {
  _createLive2dModelPageLoad,
  load as defaultModelLoad
} from "./live2d/[modelId]/+page.server";

const sampleCatalog = [
  {
    characterId: 1,
    character2dId: 101,
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

const duplicateNameCatalog = [
  sampleCatalog[0],
  {
    ...sampleCatalog[0],
    modelBase: "sample-alt",
    modelFile: "sample-alt.model3.json",
    modelName: sampleCatalog[0].modelName,
    modelPath: "model/sample-alt"
  }
] as const;

const reportedModelName = "01ichika_normal_3.0_f_t04";
const reportedModelCatalog = [{ ...sampleCatalog[0], modelName: reportedModelName }] as const;

type ReadyCatalogModels = Extract<Live2dCatalogRouteData, { status: "ready" }>["models"];

const createStaticModelLoad = (models: ReadyCatalogModels) =>
  _createLive2dModelPageLoad(async () => ({
    status: "ready" as const,
    source: "network" as const,
    models
  }));

const createFetch =
  (payload: unknown, status = 200) =>
  async (url: string): Promise<Response> => {
    expect(url).toBe(LIVE2D_ASSOCIATED_CATALOG_URL);
    return new Response(JSON.stringify(payload), { status });
  };

const resolveLocalModels = async (payload: unknown): Promise<ReadyCatalogModels> => {
  const routeData = await createLive2dCatalogRouteDataResolver().resolve(createFetch(payload));
  if (routeData.status !== "ready") {
    throw new Error("Expected the local fixture to produce a ready catalog");
  }

  return routeData.models;
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

const getStreamedCatalog = (
  loaded: Awaited<ReturnType<typeof defaultCatalogLoad>>
): Promise<Live2dCatalogRouteData> =>
  (loaded as unknown as { catalog: Promise<Live2dCatalogRouteData> }).catalog;

describe("media-lab-site Live2D catalog route", () => {
  it("returns a serializable catalog model list with separate body and facial motion arrays", async () => {
    const { loadCatalog } = createRouteLoads();
    const loaded = await loadCatalog(buildCatalogLoadEvent(createFetch(sampleCatalog)));

    await expect(getStreamedCatalog(loaded)).resolves.toMatchObject({
      status: "ready",
      source: "network",
      models: [
        {
          id: "sample-model",
          modelId: "sample-model",
          modelUrl: "/live2d/assets/model/sample/sample.model3.json",
          motionSets: [
            {
              bodyMotions: [
                {
                  id: "idle.motion3.json",
                  url: "/live2d/assets/motion/sample/idle.motion3.json"
                }
              ],
              facialMotions: [
                {
                  id: "smile.motion3.json",
                  url: "/live2d/assets/motion/sample/facial/smile.motion3.json"
                }
              ]
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(loaded)).not.toContain("https://storage.sekai.best");
    expect(() => JSON.stringify(loaded)).not.toThrow();
  });

  it("emits canonical relay URLs for asset filenames containing spaces", async () => {
    const { loadCatalog } = createRouteLoads();
    const catalog = [
      {
        ...sampleCatalog[0],
        modelFile: "sample model.model3.json",
        motionSets: [
          {
            ...sampleCatalog[0].motionSets[0],
            motionFiles: ["face_ worry_01.motion3.json"]
          }
        ]
      }
    ];

    const loaded = await loadCatalog(buildCatalogLoadEvent(createFetch(catalog)));

    await expect(getStreamedCatalog(loaded)).resolves.toMatchObject({
      status: "ready",
      models: [
        {
          modelUrl: "/live2d/assets/model/sample/sample%20model.model3.json",
          motionSets: [
            {
              bodyMotions: [
                {
                  id: "face_ worry_01.motion3.json",
                  url: "/live2d/assets/motion/sample/face_%20worry_01.motion3.json"
                }
              ]
            }
          ]
        }
      ]
    });
    expect(JSON.stringify(loaded)).not.toContain("https://storage.sekai.best");
  });

  it("resolves the reported modelName URL as a legacy compatibility route", async () => {
    const models = await resolveLocalModels(reportedModelCatalog);
    const catalogModel = models[0];
    if (!catalogModel) throw new Error("Expected the local report fixture to contain a model");

    const canonicalId = `${reportedModelName}-canonical`;
    const loadModel = createStaticModelLoad([
      { ...catalogModel, id: canonicalId, modelId: canonicalId }
    ]);

    await expect(
      loadModel(buildModelLoadEvent({ modelId: reportedModelName }))
    ).resolves.toMatchObject({
      identity: { modelId: reportedModelName },
      viewerStatus: "catalog-model-available",
      catalog: {
        status: "ready",
        model: {
          id: canonicalId,
          modelId: canonicalId,
          modelName: reportedModelName
        },
        descriptor: { modelId: canonicalId, modelName: reportedModelName }
      }
    });
  });

  it("retains a dotted model name in the resolved route descriptor", async () => {
    const { loadModel } = createRouteLoads();

    await expect(
      loadModel(
        buildModelLoadEvent({ modelId: reportedModelName }, createFetch(reportedModelCatalog))
      )
    ).resolves.toMatchObject({
      identity: { modelId: reportedModelName },
      catalog: {
        status: "ready",
        model: {
          id: reportedModelName,
          modelId: reportedModelName,
          modelName: reportedModelName
        },
        descriptor: { modelId: reportedModelName, modelName: reportedModelName }
      }
    });
  });

  it("assigns deterministic route IDs to distinct duplicate model names", async () => {
    const { loadCatalog, loadModel } = createRouteLoads();
    const loaded = await loadCatalog(buildCatalogLoadEvent(createFetch(duplicateNameCatalog)));

    await expect(getStreamedCatalog(loaded)).resolves.toMatchObject({
      status: "ready",
      models: [
        { id: "sample-model", modelId: "sample-model", modelName: "sample-model" },
        {
          id: "sample-model-2",
          modelId: "sample-model-2",
          modelName: "sample-model",
          modelBase: "sample-alt"
        }
      ]
    });

    await expect(
      loadModel(
        buildModelLoadEvent({ modelId: "sample-model-2" }, createFetch(duplicateNameCatalog))
      )
    ).resolves.toMatchObject({
      identity: { modelId: "sample-model-2" },
      catalog: {
        status: "ready",
        model: { id: "sample-model-2", modelBase: "sample-alt" },
        descriptor: { modelId: "sample-model-2" }
      }
    });
  });

  it("rejects an ambiguous modelName compatibility fallback", async () => {
    const models = await resolveLocalModels(duplicateNameCatalog);
    const ambiguousModels = models.map((model, index) => ({
      ...model,
      id: `canonical-${index + 1}`,
      modelId: `canonical-${index + 1}`
    }));
    const loadModel = createStaticModelLoad(ambiguousModels);

    await expect(
      loadModel(buildModelLoadEvent({ modelId: sampleCatalog[0].modelName }))
    ).rejects.toMatchObject({ status: 404 });
  });

  it("returns an explicit unavailable catalog result", async () => {
    const { loadCatalog } = createRouteLoads();
    const loaded = await loadCatalog(buildCatalogLoadEvent(createFetch(null)));
    await expect(getStreamedCatalog(loaded)).resolves.toMatchObject({
      status: "unavailable",
      reason: "Live2D catalog is unavailable",
      models: []
    });
  });

  it("returns an explicit error catalog result without exposing an Error object", async () => {
    const { loadCatalog } = createRouteLoads();
    const loaded = await loadCatalog(buildCatalogLoadEvent(createFailingFetch("offline")));

    await expect(getStreamedCatalog(loaded)).resolves.toMatchObject({
      status: "error",
      reason: "offline",
      models: []
    });
    expect(() => JSON.stringify(loaded)).not.toThrow();
  });

  it("resolves a canonical generated route ID", async () => {
    const { loadModel } = createRouteLoads();
    const loaded = await loadModel(
      buildModelLoadEvent({ modelId: "sample-model" }, createFetch(sampleCatalog))
    );

    expect(loaded).toMatchObject({
      identity: { modelId: "sample-model" },
      viewerStatus: "catalog-model-available",
      catalog: {
        status: "ready",
        model: { id: "sample-model", modelId: "sample-model", modelName: "sample-model" },
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
    async (modelId: string | undefined) => {
      const { loadModel } = createRouteLoads();
      await expect(loadModel(buildModelLoadEvent({ modelId }))).rejects.toMatchObject({
        status: 404
      });
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

    const landing = await loadCatalog(buildCatalogLoadEvent(fetcher));
    await getStreamedCatalog(landing);
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
    await expect(getStreamedCatalog(landingData)).resolves.toMatchObject({
      status: "ready",
      source: "network"
    });
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

    const initial = await loadCatalog(buildCatalogLoadEvent(createFetch(sampleCatalog)));
    await getStreamedCatalog(initial);
    timestamp += 101;

    const loaded = await loadCatalog(
      buildCatalogLoadEvent(createFailingFetch("temporarily offline"))
    );
    await expect(getStreamedCatalog(loaded)).resolves.toMatchObject({
      status: "ready",
      source: "last-known-good",
      reason: "temporarily offline"
    });
  });
});
