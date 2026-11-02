import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("$app/env/private", () => ({ SEKAI_MASTER_API_BASE_URL: "", SEKAI_API_BASE_URL: "" }));

import type {
  Live2dCatalogRouteData,
  Live2dCatalogSummary
} from "#lib/live2d/catalog-route-data.js";
import type { Live2dCharacterOverride } from "#lib/live2d/character-grouping.js";
import {
  createLive2dCharacterOptions,
  resolveLive2dCharacterData,
  type Live2dCharacterOption
} from "#lib/server/live2d-characters.js";
import { _createLive2dCatalogPageLoad } from "./+page.server";

type ReadyCatalog = Extract<Live2dCatalogRouteData, { status: "ready" }>;
type CharacterPayload = {
  characters: readonly Live2dCharacterOption[];
  overrides: readonly Live2dCharacterOverride[];
};
type StreamingPageData = {
  track: "live2d";
  catalog: Promise<Live2dCatalogSummary>;
  characters: Promise<CharacterPayload>;
};

const deferred = <Value>() => {
  let resolvePromise!: (value: Value | PromiseLike<Value>) => void;
  let rejectPromise!: (reason?: unknown) => void;
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  return { promise, resolve: resolvePromise, reject: rejectPromise };
};

const readyCatalog: ReadyCatalog = {
  status: "ready",
  source: "network",
  reason: "catalog loaded from network",
  models: [
    {
      id: "ichika",
      modelId: "ichika",
      region: "jp",
      characterId: 1,
      character2dId: 101,
      modelBase: "ichika",
      modelFile: "ichika.model3.json",
      modelName: "ichika",
      modelPath: "model/ichika",
      modelUrl: "/live2d/assets/model/ichika/ichika.model3.json",
      motionSets: []
    }
  ]
};
const readySummary: Live2dCatalogSummary = {
  status: "ready",
  models: [{ id: "ichika", modelName: "ichika", modelBase: "ichika", characterId: 1 }]
};

describe("Live2D catalog page load", () => {
  it("returns catalog and character data as deferred promises", async () => {
    const resolveCatalog = vi.fn().mockResolvedValue(readyCatalog);
    const resolvedModels = [{ ...readyCatalog.models[0], characterId: 2 }];
    const resolvedCharacters = [{ id: 2, name: "Hoshino Ichika", modelCount: 1 }];
    const resolveCharacters = vi.fn().mockResolvedValue({
      models: resolvedModels,
      characters: resolvedCharacters
    });
    const fetcher = vi.fn() as unknown as typeof fetch;
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const loaded = (await load({
      fetch: fetcher,
      url: new URL("https://media-lab.test/live2d")
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toEqual(readySummary);
    await expect(loaded.characters).resolves.toEqual({
      characters: resolvedCharacters,
      overrides: [{ id: "ichika", characterId: 2, characterType: null }]
    });
    expect(resolveCharacters).toHaveBeenCalledWith(readyCatalog.models, fetcher, "jp");
  });

  it.each([
    ["?region= TW ", "tw"],
    ["?region=KR", "kr"],
    ["?region=invalid", "jp"],
    ["", "jp"]
  ])("passes the normalized URL region to character resolution (%s)", async (search, region) => {
    const resolveCatalog = vi.fn().mockResolvedValue(readyCatalog);
    const resolveCharacters = vi.fn().mockResolvedValue({
      models: readyCatalog.models,
      characters: []
    });
    const fetcher = vi.fn() as unknown as typeof fetch;
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const loaded = (await load({
      fetch: fetcher,
      url: new URL(`https://media-lab.test/live2d${search}`)
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    await expect(loaded.characters).resolves.toEqual({ characters: [], overrides: [] });
    expect(resolveCharacters).toHaveBeenCalledWith(readyCatalog.models, fetcher, region);
  });

  it("returns before the catalog and character promises settle", async () => {
    const catalogRequest = deferred<ReadyCatalog>();
    const characterRequest = deferred<{
      models: typeof readyCatalog.models;
      characters: readonly Live2dCharacterOption[];
    }>();
    const resolveCatalog = vi.fn(() => catalogRequest.promise);
    const resolveCharacters = vi.fn(
      () => characterRequest.promise
    ) as unknown as typeof resolveLive2dCharacterData;
    const fetcher = vi.fn() as unknown as typeof fetch;
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);

    const loaded = (await load({
      fetch: fetcher,
      url: new URL("https://media-lab.test/live2d")
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    expect(loaded.catalog).toBeInstanceOf(Promise);
    expect(loaded.characters).toBeInstanceOf(Promise);
    expect(resolveCharacters).not.toHaveBeenCalled();

    catalogRequest.resolve(readyCatalog);
    await expect(loaded.catalog).resolves.toEqual(readySummary);
    expect(resolveCharacters).toHaveBeenCalledWith(readyCatalog.models, fetcher, "jp");

    characterRequest.resolve({
      models: readyCatalog.models,
      characters: [{ id: 1, name: "Hoshino Ichika", modelCount: 1 }]
    });
    await expect(loaded.characters).resolves.toEqual({
      characters: [{ id: 1, name: "Hoshino Ichika", modelCount: 1 }],
      overrides: []
    });
  });

  it("streams effective character options for character2d-only models", async () => {
    const character2dOnlyModel = { ...readyCatalog.models[0], characterId: undefined };
    const resolvedModel = { ...character2dOnlyModel, characterId: 2 };
    const resolveCatalog = vi.fn().mockResolvedValue({
      ...readyCatalog,
      models: [character2dOnlyModel]
    });
    const resolveCharacters = vi.fn().mockResolvedValue({
      models: [resolvedModel],
      characters: [{ id: 2, name: "Hoshino Ichika", modelCount: 1 }]
    });
    const fetcher = vi.fn() as unknown as typeof fetch;
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const loaded = (await load({
      fetch: fetcher,
      url: new URL("https://media-lab.test/live2d")
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toEqual({
      status: "ready",
      models: [{ id: "ichika", modelName: "ichika", modelBase: "ichika" }]
    });
    await expect(loaded.characters).resolves.toEqual({
      characters: [{ id: 2, name: "Hoshino Ichika", modelCount: 1 }],
      overrides: [{ id: "ichika", characterId: 2, characterType: null }]
    });
    expect(resolveCharacters).toHaveBeenCalledWith([character2dOnlyModel], fetcher, "jp");
  });

  it("keeps the ready catalog when character resolution fails", async () => {
    const resolveCatalog = vi.fn().mockResolvedValue(readyCatalog);
    const resolveCharacters = vi.fn().mockRejectedValue(new Error("master API offline"));
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const fetcher = vi.fn() as unknown as typeof fetch;
    const loaded = (await load({
      fetch: fetcher,
      url: new URL("https://media-lab.test/live2d")
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toEqual(readySummary);
    await expect(loaded.characters).resolves.toEqual({
      characters: createLive2dCharacterOptions(readyCatalog.models),
      overrides: []
    });
  });

  it("does not resolve character options for an unavailable catalog", async () => {
    const catalog: Live2dCatalogRouteData = {
      status: "unavailable",
      reason: "offline",
      models: []
    };
    const resolveCatalog = vi.fn().mockResolvedValue(catalog);
    const resolveCharacters = vi.fn();
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const fetcher = vi.fn() as unknown as typeof fetch;
    const loaded = (await load({
      fetch: fetcher,
      url: new URL("https://media-lab.test/live2d")
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toEqual(catalog);
    await expect(loaded.characters).resolves.toEqual({ characters: [], overrides: [] });
    expect(resolveCharacters).not.toHaveBeenCalled();
  });

  it("keeps catalog rejection available to SvelteKit while settling dependent data", async () => {
    const failure = new Error("catalog offline");
    const resolveCatalog = vi.fn().mockRejectedValue(failure);
    const resolveCharacters = vi.fn();
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const fetcher = vi.fn() as unknown as typeof fetch;
    const loaded = (await load({
      fetch: fetcher,
      url: new URL("https://media-lab.test/live2d")
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).rejects.toBe(failure);
    await expect(loaded.characters).resolves.toEqual({ characters: [], overrides: [] });
    expect(resolveCharacters).not.toHaveBeenCalled();
  });

  it("serializes each model once without asset URLs or motion sets", async () => {
    const motionSet = {
      motionSetId: "ichika-motion",
      motionPath: "motion/ichika",
      motionFiles: ["wave.motion3.json"],
      facialPath: "motion/ichika-face",
      facialFiles: ["smile.motion3.json"],
      bodyMotions: [
        { id: "wave.motion3.json", url: "/live2d/assets/motion/ichika/wave.motion3.json" }
      ],
      facialMotions: [
        { id: "smile.motion3.json", url: "/live2d/assets/motion/ichika-face/smile.motion3.json" }
      ]
    };
    const models = Array.from({ length: 3 }, (_, index) => ({
      ...readyCatalog.models[0],
      id: `model-${index}`,
      modelId: `model-${index}`,
      modelBase: `base-${index}`,
      modelName: `model-${index}`,
      motionSets: [motionSet]
    }));
    const resolveCatalog = vi.fn().mockResolvedValue({ ...readyCatalog, models });
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveLive2dCharacterData);
    const loaded = (await load({
      fetch: vi.fn() as unknown as typeof fetch,
      url: new URL("https://media-lab.test/live2d")
    } as Parameters<typeof load>[0])) as unknown as StreamingPageData;

    const serialized = JSON.stringify([await loaded.catalog, await loaded.characters]);

    for (const field of ["motionSets", "modelUrl", "modelPath", "modelFile", "character2dId"]) {
      expect(serialized).not.toContain(field);
    }
    expect(serialized).not.toContain("/live2d/assets/");
    for (const model of models) {
      expect(serialized.split(`"${model.modelBase}"`)).toHaveLength(2);
    }
  });

  it("keeps page rendering behind the streamed catalog and character boundaries", () => {
    const pageSource = readFileSync(new URL("./+page.svelte", import.meta.url), "utf8");

    expect(pageSource).toContain("const catalogPromise = Promise.resolve(");
    expect(pageSource).toContain("const charactersPromise = Promise.resolve(");
    expect(pageSource).not.toContain("const catalog = $derived(data.catalog)");
    expect(pageSource).not.toContain("const characterOptions = $derived(data.characters ?? [])");
    expect(pageSource).not.toMatch(/data\.catalog\??\.status/);
    expect(pageSource).not.toMatch(/data\.catalog\.models/);
  });

  it("uses persistent category tabs and keeps catalog cards concise", () => {
    const pageSource = readFileSync(new URL("./+page.svelte", import.meta.url), "utf8");
    const live2dMessages = readFileSync(
      new URL("../../../../../packages/i18n-source/media-lab-site/live2d.json", import.meta.url),
      "utf8"
    );

    expect(pageSource).toContain("groupedCharacterTypes");
    expect(pageSource).toContain("live2d.modelSelector.characterType.${key}");
    expect(pageSource).toContain('class="tabs tabs-box flex w-full flex-wrap gap-1 p-1"');
    expect(pageSource).not.toContain("characterNavigationDescription");
    expect(pageSource).toContain('role="tabpanel"');
    expect(pageSource).not.toContain('translate("live2d.modelSelector.characterType.empty")');
    expect(pageSource).toContain("getLive2dCharacterTypeKey(group.characterType) === key");
    expect(pageSource).toContain(".filter((group) => group.groups.length > 0)");
    expect(pageSource).toContain("groupedCharacterTypes[index]");
    expect(pageSource).toContain("groupedCharacterTypes.length");
    expect(pageSource).toContain("selectedCharacterTypeGroup.key");
    expect(live2dMessages).not.toContain("characterNavigationDescription");
    expect(live2dMessages).not.toContain('"live2d.modelSelector.character2dId"');
    expect(live2dMessages).not.toContain('"live2d.modelSelector.character2dId": "2D');
    expect(pageSource).not.toContain("{model.modelPath}");
    expect(pageSource).not.toContain("{model.id}");
    expect(pageSource).not.toContain('translate("live2d.modelSelector.inputAction")');
  });

  it("keeps the model viewer focused on context, stage, then controls", () => {
    const viewerSource = readFileSync(new URL("./[modelId]/+page.svelte", import.meta.url), "utf8");
    const studioSource = readFileSync(
      new URL("../../lib/components/Live2dModelStudio.svelte", import.meta.url),
      "utf8"
    );

    expect(viewerSource).toContain("data-model-context");
    expect(viewerSource).toContain(
      'aria-label={`${translate("live2d.modelViewer.status.label")}: ${stageStatus}`}'
    );
    expect(viewerSource).toContain("stage={modelStage}");
    expect(studioSource.indexOf("{#if stage}")).toBeLessThan(
      studioSource.indexOf("aria-labelledby={`${uid}-controls-title`}")
    );
    expect(studioSource).toContain('class="relative aspect-4/5');
    expect(studioSource).toContain("aria-labelledby={`${uid}-controls-title`}");
  });
});
