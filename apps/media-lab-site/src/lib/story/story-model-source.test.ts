import { beforeEach, describe, expect, it, vi } from "vitest";

const live2dFetchMock = vi.hoisted(() => vi.fn());
vi.mock("./player/rate-limited-fetch", () => ({
  live2dFetch: live2dFetchMock
}));

import { createStoryModelSource } from "./story-model-source";

const BUCKET = "https://live2d.test";
const live2dUrl = (path: string) => `${BUCKET}/${path}`;

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status < 400,
  status,
  json: async () => body
});
const headResponse = (status = 200) => ({ ok: status < 400, status });

const modelListItem = {
  modelBase: "v2_01ichika",
  modelPath: "v2/01ichika",
  modelFile: "01ichika.model3.json"
};

const model3 = () => ({
  url: "",
  FileReferences: {
    Moc: "01ichika.moc3",
    Physics: "physics.json",
    Textures: ["tex_00.png"],
    Motions: {}
  }
});

const MODEL3_PATH = "live2d/model/v2/01ichika/01ichika.model3.json";
const BUILD_MODEL_PATH = "live2d/model/v2/01ichika/buildmodeldata.asset";
const MOTION_BASE_PATH = "live2d/motion/v2/v2_01ichika_motion_base/BuildMotionData.json";

/** Routes GET/HEAD requests by path; unmatched calls fail the test. */
const routeRequests = (routes: {
  list?: unknown;
  onHead?: (path: string) => number;
  onGet?: (path: string) => { status?: number; json?: unknown } | undefined;
}) => {
  live2dFetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
    const path = url.slice(BUCKET.length + 1);
    if (path === "live2d/model_list.json") return jsonResponse(routes.list ?? [modelListItem]);
    if (init?.method === "HEAD") {
      const status = routes.onHead?.(path) ?? 200;
      return headResponse(status);
    }
    const hit = routes.onGet?.(path);
    if (hit) return jsonResponse(hit.json, hit.status ?? 200);
    if (path === MODEL3_PATH) return jsonResponse(model3());
    if (path === BUILD_MODEL_PATH) return jsonResponse({ AdditionalMotionData: [] });
    throw new Error(`unrouted fetch: ${init?.method ?? "GET"} ${url}`);
  });
};

beforeEach(() => {
  live2dFetchMock.mockReset();
});

describe("createStoryModelSource", () => {
  it("assembles model data with motion base entries for an exact costume", async () => {
    routeRequests({
      onGet: (path) => {
        if (path === MOTION_BASE_PATH) {
          return { json: { motions: ["m1", "m2"], expressions: ["e1"] } };
        }
        return undefined;
      }
    });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("v2_01ichika", 3);
    expect(collection).toEqual({
      costume: "v2_01ichika",
      cid: 3,
      data: {
        url: `${BUCKET}/live2d/model/v2/01ichika/`,
        FileReferences: {
          Moc: "01ichika.moc3",
          Physics: "physics.json",
          Textures: ["tex_00.png"],
          Motions: {
            Motion: [
              {
                Name: "m1",
                File: `${BUCKET}/live2d/motion/v2/v2_01ichika_motion_base/motion/m1.motion3.json`,
                FadeInTime: 0.5,
                FadeOutTime: 0.1
              },
              {
                Name: "m2",
                File: `${BUCKET}/live2d/motion/v2/v2_01ichika_motion_base/motion/m2.motion3.json`,
                FadeInTime: 0.5,
                FadeOutTime: 0.1
              }
            ],
            Expression: [
              {
                Name: "e1",
                File: `${BUCKET}/live2d/motion/v2/v2_01ichika_motion_base/facial/e1.motion3.json`,
                FadeInTime: 0.1,
                FadeOutTime: 0.1
              }
            ]
          }
        }
      }
    });
  });

  it("matches a costume case-insensitively when the list has no exact hit", async () => {
    routeRequests({ list: [{ ...modelListItem, modelBase: "V2_01ichika" }] });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("v2_01ichika", 1);
    expect(collection?.costume).toBe("v2_01ichika");
    expect(collection?.data.FileReferences.Motions.Motion).toEqual([]);
  });

  it("returns null for a costume that is not in the model list", async () => {
    routeRequests({});
    const source = createStoryModelSource({ live2dUrl });
    await expect(source.getModelDataForCostume("unknown_base", 1)).resolves.toBeNull();
  });

  it("reduces underscore-separated base names until a motion base resolves", async () => {
    routeRequests({
      list: [{ ...modelListItem, modelBase: "v2_01ichika_ice" }],
      onHead: (path) => (path.includes("v2_01ichika_ice_motion_base") ? 404 : 200),
      onGet: (path) => {
        if (path === MOTION_BASE_PATH) {
          return { json: { motions: ["m1"], expressions: [] } };
        }
        return undefined;
      }
    });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("v2_01ichika_ice", 1);
    expect(collection?.data.FileReferences.Motions.Motion[0]?.File).toBe(
      `${BUCKET}/live2d/motion/v2/v2_01ichika_motion_base/motion/m1.motion3.json`
    );
  });

  it("skips the motion data fetch for normal_* bases and keeps empty motions", async () => {
    routeRequests({
      list: [{ ...modelListItem, modelBase: "normal_01ichika" }],
      onGet: (path) => {
        if (path === MOTION_BASE_PATH) throw new Error("must not fetch motion data");
        return undefined;
      }
    });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("normal_01ichika", 1);
    expect(collection?.data.FileReferences.Motions).toEqual({ Motion: [], Expression: [] });
  });

  it("falls back to lowercase model paths after a 404", async () => {
    const upperModel3 = "live2d/model/V2/ICHICA/01ichika.model3.json";
    const lowerModel3 = "live2d/model/v2/ichica/01ichika.model3.json";
    const upperBuild = "live2d/model/V2/ICHICA/buildmodeldata.asset";
    const lowerBuild = "live2d/model/v2/ichica/buildmodeldata.asset";
    live2dFetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const path = url.slice(BUCKET.length + 1);
      if (path === "live2d/model_list.json") {
        return jsonResponse([{ ...modelListItem, modelPath: "V2/ICHICA" }]);
      }
      const isLower = path === path.toLowerCase();
      if (init?.method === "HEAD") return headResponse(isLower ? 200 : 404);
      if (path === upperModel3 || path === upperBuild) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      if (path === lowerModel3) return jsonResponse(model3());
      if (path === lowerBuild) return jsonResponse({ AdditionalMotionData: [] });
      if (path === "live2d/motion/v2/v2_01ichika_motion_base/BuildMotionData.json") {
        return jsonResponse({ motions: [], expressions: [] });
      }
      throw new Error(`unrouted fetch: ${init?.method ?? "GET"} ${url}`);
    });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("v2_01ichika", 1);
    expect(collection?.data.FileReferences.Moc).toBe("01ichika.moc3");
    expect(collection?.data.url).toBe(`${BUCKET}/live2d/model/V2/ICHICA/`);
  });

  it("rewrites file references to lowercase when only the lowercase path exists", async () => {
    routeRequests({
      onHead: (path) => (path === path.toLowerCase() ? 200 : 404)
    });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("v2_01ichika", 1);
    expect(collection?.data.FileReferences.Moc).toBe("01ichika.moc3");
    expect(collection?.data.FileReferences.Textures).toEqual(["tex_00.png"]);
  });

  it("keeps relative paths when both cases of an asset are missing", async () => {
    routeRequests({
      onHead: () => 404,
      onGet: (path) => {
        if (path === MOTION_BASE_PATH) {
          return { json: { motions: [], expressions: [] } };
        }
        return undefined;
      }
    });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("v2_01ichika", 1);
    expect(collection?.data.FileReferences.Moc).toBe("01ichika.moc3");
    expect(collection?.data.FileReferences.Textures).toEqual(["tex_00.png"]);
    expect(collection?.data.FileReferences.Motions.Motion).toEqual([]);
  });

  it("appends additional motions from build model data", async () => {
    live2dFetchMock.mockImplementation(async (url: string, init?: { method?: string }) => {
      const path = url.slice(BUCKET.length + 1);
      if (path === "live2d/model_list.json") return jsonResponse([modelListItem]);
      if (init?.method === "HEAD") return headResponse(200);
      if (path === MODEL3_PATH) return jsonResponse(model3());
      if (path === BUILD_MODEL_PATH) return jsonResponse({ AdditionalMotionData: ["am1"] });
      if (path === "live2d/model/v2/01ichika/motions/BuildMotionData.json") {
        return jsonResponse({ motions: ["am1"], expressions: [] });
      }
      if (path === MOTION_BASE_PATH) return jsonResponse({ motions: [], expressions: [] });
      throw new Error(`unrouted fetch: ${init?.method ?? "GET"} ${url}`);
    });
    const source = createStoryModelSource({ live2dUrl });
    const collection = await source.getModelDataForCostume("v2_01ichika", 1);
    expect(collection?.data.FileReferences.Motions.Motion).toEqual([
      {
        Name: "am1-additional",
        File: `${BUCKET}/live2d/model/v2/01ichika/motions/am1.motion3.json`,
        FadeInTime: 0.5,
        FadeOutTime: 0.1
      }
    ]);
  });

  it("rejects when the model list endpoint fails", async () => {
    live2dFetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
    const source = createStoryModelSource({ live2dUrl });
    await expect(source.getModelDataForCostume("v2_01ichika", 1)).rejects.toThrow(
      /Failed to fetch model list/
    );
  });

  it("rejects when the model list is not an array", async () => {
    routeRequests({ list: { modelBase: "v2_01ichika" } });
    const source = createStoryModelSource({ live2dUrl });
    await expect(source.getModelDataForCostume("v2_01ichika", 1)).rejects.toThrow(
      /model list is malformed/
    );
  });
});
