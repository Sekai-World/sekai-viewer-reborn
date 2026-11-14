import { describe, expect, it, vi } from "vitest";
import { resolveChibiModelDescriptor, type ChibiModelDescriptor } from "./chibi-model";
import {
  ChibiAssetLoadError,
  createChibiPlayer,
  readChibiAtlasPageNames,
  type ChibiAssetResponse,
  type ChibiRuntimeFacade,
  type ChibiSpineModel,
  type ChibiStage
} from "./chibi-player";

const ATLAS_TEXT = "sekai_atlas.png\nsize:1024,512\npma:true\nB_armL\nbounds:1,1,2,2\n";
const SKELETON_BYTES = new Uint8Array([1, 2, 3]);
const HOST = {} as HTMLElement;

const describeModel = (modelName: string): ChibiModelDescriptor => {
  const result = resolveChibiModelDescriptor(modelName);
  if (result.status !== "ok") throw new Error(result.reason);
  return result.descriptor;
};

const response = (body: {
  text?: string;
  bytes?: Uint8Array;
  status?: number;
}): ChibiAssetResponse => {
  const status = body.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body.text ?? "",
    arrayBuffer: async () => (body.bytes ?? new Uint8Array()).slice().buffer
  };
};

const createHarness = (
  overrides: { atlasText?: string; atlasStatus?: number; skeletonStatus?: number } = {}
) => {
  const model = {
    animationNames: ["idle", "walk"],
    setAnimation: vi.fn<ChibiSpineModel["setAnimation"]>(),
    destroy: vi.fn<ChibiSpineModel["destroy"]>()
  };
  const stage = {
    show: vi.fn<ChibiStage["show"]>(),
    resize: vi.fn<ChibiStage["resize"]>(),
    destroy: vi.fn<ChibiStage["destroy"]>()
  };
  const spine = {
    createStage: vi.fn(() => stage),
    createModel: vi.fn(async () => model)
  };
  const fetchAsset = vi.fn<ChibiRuntimeFacade["fetchAsset"]>(async (url) =>
    url.endsWith(".skel")
      ? response({ bytes: SKELETON_BYTES, status: overrides.skeletonStatus })
      : response({ text: overrides.atlasText ?? ATLAS_TEXT, status: overrides.atlasStatus })
  );
  const player = createChibiPlayer({ loadSpine: async () => spine, fetchAsset });

  return { player, model, stage, spine, fetchAsset };
};

const skeletonFetches = (fetchAsset: { mock: { calls: unknown[][] } }): unknown[] =>
  fetchAsset.mock.calls.map(([url]) => url).filter((url) => String(url).endsWith(".skel"));

describe("readChibiAtlasPageNames", () => {
  it("reads the first line and each line that follows a blank line", () => {
    expect(readChibiAtlasPageNames("\na.png\nsize:1,1\nregion\n\r\nb.png\nsize:2,2\n")).toEqual([
      "a.png",
      "b.png"
    ]);
  });

  it("returns nothing for an empty atlas", () => {
    expect(readChibiAtlasPageNames("")).toEqual([]);
  });
});

describe("createChibiPlayer", () => {
  it("loads a model from the descriptor URLs and shows it on a stage", async () => {
    const { player, model, stage, spine, fetchAsset } = createHarness();
    const descriptor = describeModel("sd_01ichika_normal");

    const resource = await player.load(descriptor, HOST, new AbortController().signal);

    expect(fetchAsset.mock.calls.map(([url]) => url).sort()).toEqual(
      [descriptor.atlasUrl, descriptor.skeletonUrl].sort()
    );
    expect(spine.createModel).toHaveBeenCalledWith({
      atlasText: ATLAS_TEXT,
      textureUrl: descriptor.textureUrl,
      skeletonBytes: SKELETON_BYTES
    });
    expect(spine.createStage).toHaveBeenCalledWith(HOST);
    expect(stage.show).toHaveBeenCalledWith(model);
    expect(resource.descriptor).toBe(descriptor);
    expect(resource.animations).toEqual(["idle", "walk"]);
  });

  it("sets a known animation, looping by default, and rejects an unknown one", async () => {
    const { player, model } = createHarness();
    const resource = await player.load(
      describeModel("sd_mob001"),
      HOST,
      new AbortController().signal
    );

    expect(resource.setAnimation("walk")).toBe(true);
    expect(resource.setAnimation("idle", { loop: false })).toBe(true);
    expect(resource.setAnimation("missing")).toBe(false);
    expect(model.setAnimation.mock.calls).toEqual([
      ["walk", true],
      ["idle", false]
    ]);
  });

  it("downloads a shared skeleton once for two models of the same family", async () => {
    const { player, fetchAsset } = createHarness();
    const signal = new AbortController().signal;

    await player.load(describeModel("v2_sd_01ichika_casual"), HOST, signal);
    await player.load(describeModel("v2_sd_01ichika_school"), HOST, signal);

    expect(skeletonFetches(fetchAsset)).toHaveLength(1);
  });

  it("downloads a shared skeleton once for two concurrent loads", async () => {
    const { player, fetchAsset } = createHarness();
    const signal = new AbortController().signal;

    await Promise.all([
      player.load(describeModel("v2_sd_01ichika_casual"), HOST, signal),
      player.load(describeModel("v2_sd_01ichika_school"), HOST, signal)
    ]);

    expect(skeletonFetches(fetchAsset)).toHaveLength(1);
  });

  it("stops waiting for the shared skeleton when the load is aborted", async () => {
    const { player, spine, fetchAsset } = createHarness();
    const controller = new AbortController();
    let finishSkeleton: (() => void) | undefined;
    fetchAsset.mockImplementation(async (url) => {
      if (!url.endsWith(".skel")) return response({ text: ATLAS_TEXT });
      await new Promise<void>((resolve) => (finishSkeleton = resolve));
      return response({ bytes: SKELETON_BYTES });
    });
    const descriptor = describeModel("sd_01ichika_normal");

    const aborted = player.load(descriptor, HOST, controller.signal);
    controller.abort(new Error("switched model"));
    await expect(aborted).rejects.toThrow("switched model");
    expect(spine.createModel).not.toHaveBeenCalled();

    // The download keeps running and serves the next load.
    const next = player.load(descriptor, HOST, new AbortController().signal);
    await vi.waitFor(() => expect(finishSkeleton).toBeDefined());
    finishSkeleton!();
    await next;
    expect(skeletonFetches(fetchAsset)).toHaveLength(1);
  });

  it("downloads the skeleton again after a failed attempt", async () => {
    const { player, fetchAsset } = createHarness({ skeletonStatus: 503 });
    const descriptor = describeModel("sd_01ichika_normal");
    const signal = new AbortController().signal;

    await expect(player.load(descriptor, HOST, signal)).rejects.toThrow(
      "Failed to load Chibi skeleton (503)"
    );
    await expect(player.load(descriptor, HOST, signal)).rejects.toThrow();

    expect(skeletonFetches(fetchAsset)).toHaveLength(2);
  });

  it("fails when the atlas cannot be fetched", async () => {
    const { player, spine } = createHarness({ atlasStatus: 404 });

    const failure = await player
      .load(describeModel("sd_01ichika_normal"), HOST, new AbortController().signal)
      .catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(ChibiAssetLoadError);
    expect(failure).toMatchObject({
      asset: "atlas",
      status: 404,
      message: "Failed to load Chibi atlas (404)"
    });
    expect(spine.createModel).not.toHaveBeenCalled();
  });

  it.each([
    ["another texture file", "other.png\nsize:1,1\n"],
    ["two texture pages", "sekai_atlas.png\nsize:1,1\n\nsekai_atlas2.png\nsize:1,1\n"],
    ["no texture page", ""]
  ])("refuses an atlas that names %s", async (_label, atlasText) => {
    const { player, spine } = createHarness({ atlasText });

    await expect(
      player.load(describeModel("sd_01ichika_normal"), HOST, new AbortController().signal)
    ).rejects.toThrow("Chibi atlas must name exactly one texture page");
    expect(spine.createModel).not.toHaveBeenCalled();
  });

  it("does nothing when the signal is already aborted", async () => {
    const { player, fetchAsset } = createHarness();
    const controller = new AbortController();
    controller.abort();

    await expect(
      player.load(describeModel("sd_01ichika_normal"), HOST, controller.signal)
    ).rejects.toThrow();
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it("destroys the model when the load is aborted while the model is created", async () => {
    const { player, model, spine } = createHarness();
    const controller = new AbortController();
    spine.createModel.mockImplementationOnce(async () => {
      controller.abort();
      return model;
    });

    await expect(
      player.load(describeModel("sd_01ichika_normal"), HOST, controller.signal)
    ).rejects.toThrow();
    expect(model.destroy).toHaveBeenCalledTimes(1);
    expect(spine.createStage).not.toHaveBeenCalled();
  });

  it("destroys the model and the stage when the model cannot be shown", async () => {
    const { player, model, stage } = createHarness();
    stage.show.mockImplementationOnce(() => {
      throw new Error("no WebGL");
    });

    await expect(
      player.load(describeModel("sd_01ichika_normal"), HOST, new AbortController().signal)
    ).rejects.toThrow("no WebGL");
    expect(model.destroy).toHaveBeenCalledTimes(1);
    expect(stage.destroy).toHaveBeenCalledTimes(1);
  });

  it("releases the model and the stage once and ignores later calls", async () => {
    const { player, model, stage } = createHarness();
    const resource = await player.load(
      describeModel("sd_01ichika_normal"),
      HOST,
      new AbortController().signal
    );

    resource.resize(300, 200);
    resource.destroy();
    resource.destroy();
    resource.resize(10, 10);

    expect(stage.resize.mock.calls).toEqual([[300, 200]]);
    expect(model.destroy).toHaveBeenCalledTimes(1);
    expect(stage.destroy).toHaveBeenCalledTimes(1);
    expect(resource.setAnimation("idle")).toBe(false);
  });
});
