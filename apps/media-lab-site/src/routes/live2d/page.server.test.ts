import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/private", () => ({ env: {} }));

import type { Live2dCatalogRouteData } from "$lib/live2d/catalog-route-data";
import {
  createLive2dCharacterOptions,
  resolveLive2dCharacterData,
  type Live2dCharacterOption
} from "$lib/server/live2d-characters";
import { _createLive2dCatalogPageLoad } from "./+page.server";

type ReadyCatalog = Extract<Live2dCatalogRouteData, { status: "ready" }>;
type StreamingPageData = {
  track: "live2d";
  catalog: Promise<Live2dCatalogRouteData>;
  characters: Promise<readonly Live2dCharacterOption[]>;
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
    const loaded = (await load({ fetch: fetcher } as Parameters<
      typeof load
    >[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toEqual(readyCatalog);
    await expect(loaded.characters).resolves.toEqual(resolvedCharacters);
    expect(resolveCharacters).toHaveBeenCalledWith(readyCatalog.models, fetcher);
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

    const loaded = (await load({ fetch: fetcher } as Parameters<
      typeof load
    >[0])) as unknown as StreamingPageData;

    expect(loaded.catalog).toBeInstanceOf(Promise);
    expect(loaded.characters).toBeInstanceOf(Promise);
    expect(resolveCharacters).not.toHaveBeenCalled();

    catalogRequest.resolve(readyCatalog);
    await expect(loaded.catalog).resolves.toEqual(readyCatalog);
    expect(resolveCharacters).toHaveBeenCalledWith(readyCatalog.models, fetcher);

    characterRequest.resolve({
      models: readyCatalog.models,
      characters: [{ id: 1, name: "Hoshino Ichika", modelCount: 1 }]
    });
    await expect(loaded.characters).resolves.toEqual([
      { id: 1, name: "Hoshino Ichika", modelCount: 1 }
    ]);
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
    const loaded = (await load({ fetch: fetcher } as Parameters<
      typeof load
    >[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toMatchObject({ models: [character2dOnlyModel] });
    await expect(loaded.characters).resolves.toEqual([
      { id: 2, name: "Hoshino Ichika", modelCount: 1 }
    ]);
    expect(resolveCharacters).toHaveBeenCalledWith([character2dOnlyModel], fetcher);
  });

  it("keeps the ready catalog when character resolution fails", async () => {
    const resolveCatalog = vi.fn().mockResolvedValue(readyCatalog);
    const resolveCharacters = vi.fn().mockRejectedValue(new Error("master API offline"));
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const fetcher = vi.fn() as unknown as typeof fetch;
    const loaded = (await load({ fetch: fetcher } as Parameters<
      typeof load
    >[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toEqual(readyCatalog);
    await expect(loaded.characters).resolves.toEqual(
      createLive2dCharacterOptions(readyCatalog.models)
    );
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
    const loaded = (await load({ fetch: fetcher } as Parameters<
      typeof load
    >[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).resolves.toEqual(catalog);
    await expect(loaded.characters).resolves.toEqual([]);
    expect(resolveCharacters).not.toHaveBeenCalled();
  });

  it("keeps catalog rejection available to SvelteKit while settling dependent data", async () => {
    const failure = new Error("catalog offline");
    const resolveCatalog = vi.fn().mockRejectedValue(failure);
    const resolveCharacters = vi.fn();
    const load = _createLive2dCatalogPageLoad(resolveCatalog, resolveCharacters);
    const fetcher = vi.fn() as unknown as typeof fetch;
    const loaded = (await load({ fetch: fetcher } as Parameters<
      typeof load
    >[0])) as unknown as StreamingPageData;

    await expect(loaded.catalog).rejects.toBe(failure);
    await expect(loaded.characters).resolves.toEqual([]);
    expect(resolveCharacters).not.toHaveBeenCalled();
  });
});
