import { afterEach, describe, expect, it, vi } from "vitest";

import { preloadModels } from "./load";
import { Live2DLoadProgressType } from "./player-types";
import type { ILive2DControllerData, ILive2DModelDataCollection } from "./player-types";

const modelData = (costume: string): ILive2DModelDataCollection =>
  ({
    cid: 1,
    costume,
    data: {
      url: `https://assets.example.com/${costume}/`,
      FileReferences: {
        Textures: ["texture_00.png"],
        Moc: "model.moc3",
        Physics: "physics.json3"
      }
    }
  }) as unknown as ILive2DModelDataCollection;

const controllerData = (costumes: string[]): ILive2DControllerData =>
  ({
    scenarioData: {},
    scenarioResource: { image: [], video: [], audio: [] },
    modelData: costumes.map(modelData)
  }) as unknown as ILive2DControllerData;

describe("preloadModels progress", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the completed file count, ending at total", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 }))
    );
    const calls: {
      type: Live2DLoadProgressType;
      count: number;
      total: number;
    }[] = [];

    await preloadModels(controllerData(["costume_a", "costume_b"]), (type, count, total) => {
      calls.push({ type, count, total });
    });

    // two models x (texture + moc + physics)
    expect(calls).toHaveLength(6);
    expect(calls.map((call) => call.type)).toEqual(
      Array(6).fill(Live2DLoadProgressType.ModelAssets)
    );
    expect(calls.map((call) => call.total)).toEqual([6, 6, 6, 6, 6, 6]);
    expect(calls.map((call) => call.count)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(calls.at(-1)).toEqual({
      type: Live2DLoadProgressType.ModelAssets,
      count: 6,
      total: 6
    });
  });
});
