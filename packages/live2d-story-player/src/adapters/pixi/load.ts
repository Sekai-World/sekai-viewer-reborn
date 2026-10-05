import type { IScenarioData } from "../../model/scenario-types.js";
import { log } from "../../core/log.js";

import type {
  ILive2DCachedAsset,
  ILive2DAssetUrl,
  ILive2DControllerData,
  ILive2DModelDataCollection,
  ILive2DLoadProgressHandler,
  ILive2DLoadWarningHandler,
  ILive2DStoryModelSource
} from "./player-types.js";

import {
  isLive2DImageAsset,
  isLive2DAudioAsset,
  isLive2DVideoAsset,
  Live2DLoadProgressType
} from "./player-types.js";

import { PreloadQueue } from "../../core/PreloadQueue.js";
import { live2dRequest } from "../../core/rate-limited-fetch.js";
import { gatherStoryMotion } from "../../core/motions.js";
import { createBrowserMediaAdapters } from "./browser-media.js";
import type {
  ILive2DAbortableStoryModelSource,
  ILive2DLoadedControllerData,
  ILive2DLoadedScenarioResource,
  Live2DLoadOptions,
  Live2DResourceAdapter
} from "./adapter-types.js";

/**
 * Extracts and URL-decodes the filename from an asset URL.
 *
 * @param url - The asset URL or path.
 * @returns The decoded final pathname segment, or the original filename when the URL cannot be parsed.
 */
function getAssetFilename(url: string) {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    return decodeURIComponent(pathname.split("/").pop() || url);
  } catch {
    return url.split(/[?#]/, 1)[0].split("/").pop() || url;
  }
}

/**
 * Formats a warning message for a failed asset load.
 *
 * @param kind - The type of asset that failed to load
 * @param label - The asset's display label
 * @param url - The asset URL
 * @param error - The error encountered while loading the asset
 * @returns A formatted asset-load failure warning, including an HTTP status when available
 */
function getAssetLoadWarning(kind: string, label: string, url: string, error: unknown) {
  let status: number | undefined;
  if (error instanceof Response) status = error.status;
  else if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number"
  ) {
    status = error.status;
  }
  const statusSuffix = status === undefined ? "" : `: ${status}`;
  return `Failed to load ${kind} ${label} (${getAssetFilename(url)})${statusSuffix}`;
}

const getAbortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw getAbortReason(signal);
};

const awaitWithSignal = <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) return promise;
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const finish = (result: { kind: "resolve"; value: T } | { kind: "reject"; error: unknown }) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result.kind === "resolve") resolve(result.value);
      else reject(result.error);
    };
    const onAbort = () => finish({ kind: "reject", error: getAbortReason(signal) });

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => finish({ kind: "resolve", value }),
      (error: unknown) => finish({ kind: "reject", error })
    );
    if (signal.aborted) onAbort();
  });
};

const resolveLoadOptions = (options?: Live2DLoadOptions) => ({
  signal: options?.signal,
  fetch: options?.fetch ?? globalThis.fetch,
  request: options?.request ?? live2dRequest,
  media: { ...createBrowserMediaAdapters(options?.audioAdapter), ...options?.media },
  logger: options?.logger ?? log
});

const createAbortScope = (parentSignal?: AbortSignal) => {
  const controller = new AbortController();
  const onAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal?.aborted) onAbort();
  else parentSignal?.addEventListener("abort", onAbort, { once: true });

  return {
    signal: controller.signal,
    abort: (reason?: unknown) => {
      if (!controller.signal.aborted) controller.abort(reason);
    },
    dispose: () => parentSignal?.removeEventListener("abort", onAbort)
  };
};

const createResourceRegistry = (logger: ReturnType<typeof resolveLoadOptions>["logger"]) => {
  let disposed = false;
  const releases: (() => void)[] = [];

  const register = <T>(resource: T, adapter: Live2DResourceAdapter<T>): void => {
    let released = false;
    const releaseOnce = () => {
      if (released) return;
      released = true;
      try {
        adapter.release(resource);
      } catch (error) {
        try {
          logger.warn("Live2DPlayerLoader", "Failed to release media resource.", error);
        } catch {
          // A logging failure must not prevent the remaining resources from releasing.
        }
      }
    };

    if (disposed) releaseOnce();
    else releases.push(releaseOnce);
  };

  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    for (let index = releases.length - 1; index >= 0; index -= 1) {
      const release = releases[index];
      if (release) release();
    }
    releases.length = 0;
  };

  return { register, dispose };
};

const loadMediaResource = async <T>(
  url: string,
  adapter: Live2DResourceAdapter<T>,
  signal: AbortSignal,
  request: ReturnType<typeof resolveLoadOptions>["request"],
  register: (resource: T, adapter: Live2DResourceAdapter<T>) => void
): Promise<T> =>
  request(async (requestSignal) => {
    const activeSignal = requestSignal ?? signal;
    throwIfAborted(activeSignal);
    const resource = await adapter.create(url, activeSignal);
    register(resource, adapter);
    throwIfAborted(activeSignal);
    await adapter.load(resource, url, activeSignal);
    throwIfAborted(activeSignal);
    return resource;
  }, signal);

/**
 * Preloads scenario media and combines it with Live2D model data for controller initialization.
 *
 * @param snData - Processed scenario data.
 * @param mediaUrlForLive2D - Asset URLs to preload, including Live2D UI media URLs.
 * @param modelDataPromise - Promise resolving to the model data for the scenario.
 * @param uiAssets - Host-resolved player UI asset resources.
 * @returns The scenario data, loaded media resources, and model data.
 */
export async function getLive2DControllerData(
  snData: IScenarioData,
  mediaUrlForLive2D: ILive2DAssetUrl[],
  modelDataPromise: Promise<ILive2DModelDataCollection[]>,
  onProgress: ILive2DLoadProgressHandler,
  onWarning: ILive2DLoadWarningHandler,
  uiAssets: ILive2DAssetUrl[],
  options?: Live2DLoadOptions
): Promise<ILive2DLoadedControllerData> {
  const allMediaUrls = [...mediaUrlForLive2D, ...uiAssets];
  const abortScope = createAbortScope(options?.signal);
  let loadedResource: ILive2DLoadedScenarioResource | undefined;
  const mediaPromise = preloadMedia(allMediaUrls, onProgress, onWarning, {
    ...options,
    signal: abortScope.signal
  }).then((resource) => {
    loadedResource = resource;
    return resource;
  });

  try {
    const [scenarioResource, modelData] = await Promise.all([
      mediaPromise,
      awaitWithSignal(modelDataPromise, abortScope.signal)
    ]);
    return { scenarioData: snData, scenarioResource, modelData };
  } catch (error) {
    abortScope.abort(error);
    await mediaPromise.catch(() => undefined);
    loadedResource?.dispose();
    throw error;
  } finally {
    abortScope.dispose();
  }
}

/**
 * Loads model metadata for each character appearing in a scenario.
 *
 * @param snData - Scenario data containing the appearing characters and their costume types
 * @param modelSource - Host-provided model data source
 * @param onProgress - Callback invoked as each character's model metadata loads
 * @param onWarning - Callback invoked when a costume has no resolvable model
 * @returns Model metadata associated with each appearing character
 */
export async function getLive2DModelData(
  snData: IScenarioData,
  modelSource: ILive2DStoryModelSource,
  onProgress: ILive2DLoadProgressHandler,
  onWarning: ILive2DLoadWarningHandler,
  options?: Live2DLoadOptions
): Promise<ILive2DModelDataCollection[]> {
  const total = snData.AppearCharacters.length;
  const collections: ILive2DModelDataCollection[] = [];
  const seenCostumes = new Set<string>();
  let count = 0;
  const loadCharacterAt = (index: number): Promise<void> =>
    Promise.resolve().then(async () => {
      if (index >= total) return;
      const c = snData.AppearCharacters[index]!;
      if (options?.signal) throwIfAborted(options.signal);
      if (seenCostumes.has(c.CostumeType)) {
        count++;
      } else {
        seenCostumes.add(c.CostumeType);
        const lookup = Promise.resolve().then(() => {
          if (options?.signal) throwIfAborted(options.signal);
          return (modelSource as ILive2DAbortableStoryModelSource).getModelDataForCostume(
            c.CostumeType,
            c.Character2dId,
            options?.signal
          );
        });
        const md = await awaitWithSignal(lookup, options?.signal);
        if (options?.signal) throwIfAborted(options.signal);
        count++;
        if (!md) {
          onWarning(`Model not found for ${c.CostumeType} (${c.Character2dId})`);
        } else {
          collections.push(md);
        }
        onProgress(Live2DLoadProgressType.ModelData, count, total, c.CostumeType);
      }
      return loadCharacterAt(index + 1);
    });
  await loadCharacterAt(0);
  return collections;
}
/**
 * Preloads the texture, moc, and physics assets for each Live2D model.
 *
 * @param controllerData - The controller data containing the models and their asset references
 * @param onProgress - Reports progress as model assets are loaded
 * @param onWarning - Reports asset-loading warnings
 * @throws If any model asset fails to download
 */
export async function preloadModels(
  controllerData: ILive2DControllerData,
  onProgress: ILive2DLoadProgressHandler,
  onWarning?: ILive2DLoadWarningHandler,
  options?: Live2DLoadOptions
) {
  const capabilities = resolveLoadOptions(options);
  let count = 0;
  const total = controllerData.modelData.length * 3;
  // step 4.1 - preload model assets
  const taskList: {
    task: (signal: AbortSignal) => Promise<Response>;
    callback: () => void;
  }[] = [];
  for (const model of controllerData.modelData) {
    const modelAssets = [
      {
        kind: "texture",
        path: model.data.FileReferences.Textures[0]
      },
      {
        kind: "moc",
        path: model.data.FileReferences.Moc
      },
      {
        kind: "physics",
        path: model.data.FileReferences.Physics
      }
    ];
    for (const asset of modelAssets) {
      const url = model.data.url + asset.path;
      taskList.push({
        task: (signal) =>
          capabilities
            .request(async (requestSignal) => {
              const response = await capabilities.fetch(url, { signal: requestSignal ?? signal });
              if (!response.ok) throw response;
              return response;
            }, signal)
            .catch((error: unknown) => {
              if (!signal.aborted) {
                const warning = getAssetLoadWarning(
                  asset.kind,
                  `${model.costume}/${asset.kind}`,
                  url,
                  error
                );
                capabilities.logger.warn("Live2DPlayerLoader", warning);
                onWarning?.(warning);
              }
              throw error;
            }),
        callback: function () {
          count++;
          onProgress(
            Live2DLoadProgressType.ModelAssets,
            count,
            total,
            `${model.costume}/${asset.kind}`
          );
        }
      });
    }
  }
  const queue = new PreloadQueue(taskList, 20, 60, capabilities.signal);
  await queue.run();
}

// step 3.2 - preload sound/image/video
export async function preloadMedia(
  urls: ILive2DAssetUrl[],
  onProgress: ILive2DLoadProgressHandler,
  onWarning: ILive2DLoadWarningHandler,
  options?: Live2DLoadOptions
): Promise<ILive2DLoadedScenarioResource> {
  const capabilities = resolveLoadOptions(options);
  const registry = createResourceRegistry(capabilities.logger);
  const total = urls.length;

  const taskList: {
    task: (signal: AbortSignal) => Promise<ILive2DCachedAsset>;
    callback: () => void;
  }[] = [];
  let count = 0;
  for (const url of urls) {
    taskList.push({
      task: async (signal): Promise<ILive2DCachedAsset> => {
        try {
          if (isLive2DImageAsset(url)) {
            const data = await loadMediaResource(
              url.url,
              capabilities.media.image,
              signal,
              capabilities.request,
              registry.register
            );
            capabilities.logger.log("Live2DPlayerLoader", `${url.url} loaded.`);
            return { ...url, data };
          } else if (isLive2DVideoAsset(url)) {
            const data = await loadMediaResource(
              url.url,
              capabilities.media.video,
              signal,
              capabilities.request,
              registry.register
            );
            capabilities.logger.log("Live2DPlayerLoader", `${url.url} loaded.`);
            return { ...url, data };
          } else if (isLive2DAudioAsset(url)) {
            const data = await loadMediaResource(
              url.url,
              capabilities.media.audio,
              signal,
              capabilities.request,
              registry.register
            );
            capabilities.logger.log("Live2DPlayerLoader", `${url.url} loaded.`);
            return { ...url, data };
          } else {
            throw new Error("Wrong asset type.");
          }
        } catch (error) {
          if (!signal.aborted) {
            const warning = getAssetLoadWarning(url.type, url.identifier, url.url, error);
            capabilities.logger.warn("Live2DPlayerLoader", warning);
            onWarning(warning);
          }
          throw error;
        }
      },
      callback: function () {
        count++;
        onProgress(Live2DLoadProgressType.Media, count, total, url.identifier);
      }
    });
  }
  const queue = new PreloadQueue<ILive2DCachedAsset>(taskList, 20, 60, capabilities.signal);
  try {
    const assetList = (await queue.run()).filter(
      (asset): asset is ILive2DCachedAsset => asset !== null
    );
    return {
      image: assetList.filter((asset) => isLive2DImageAsset(asset)),
      video: assetList.filter((asset) => isLive2DVideoAsset(asset)),
      audio: assetList.filter((asset) => isLive2DAudioAsset(asset)),
      dispose: registry.dispose
    };
  } catch (error) {
    registry.dispose();
    throw error;
  }
}

/**
 * Filters each model to retain only the motion and expression assets referenced by the scenario.
 *
 * @param scenarioData - Scenario data containing the referenced motion and expression assets
 * @param modelData - Model data whose motion and expression definitions are filtered in place
 * @returns The filtered model data collection
 */
export function discardMotion(
  scenarioData: IScenarioData,
  modelData: ILive2DModelDataCollection[]
) {
  const motion_list = gatherStoryMotion(scenarioData);
  // remove dupulicate
  const unique_motion: typeof motion_list = [];
  motion_list.forEach((m) => {
    if (
      !unique_motion.some(
        (u) => m.costume === u.costume && m.motion === u.motion && m.type === u.type
      )
    ) {
      unique_motion.push(m);
    }
  });
  // prune
  modelData.forEach((md) => {
    const motion_for_this_model = unique_motion.filter((m) => m.costume === md.costume);
    md.data.FileReferences.Motions.Motion = motion_for_this_model
      .filter((m) => m.type === "motion")
      .map((m) => md.data.FileReferences.Motions.Motion.find((all_m) => all_m.Name === m.motion))
      .filter((m) => !!m); // skip motions that not in model defination
    md.data.FileReferences.Motions.Expression = motion_for_this_model
      .filter((m) => m.type === "expression")
      .map((m) =>
        md.data.FileReferences.Motions.Expression.find((all_m) => all_m.Name === m.motion)
      )
      .filter((m) => !!m); // skip motions that not in model defination
  });
  return modelData;
}
/**
 * Preloads all unique motion and expression assets referenced by the models.
 *
 * @param modelData - Model definitions containing motion and expression asset references
 * @param onProgress - Reports progress for each asset
 * @param onWarning - Reports asset-loading warnings
 * @throws An error if an asset fails to load
 */
export async function preloadModelMotion(
  modelData: ILive2DModelDataCollection[],
  onProgress: ILive2DLoadProgressHandler,
  onWarning: ILive2DLoadWarningHandler,
  options?: Live2DLoadOptions
) {
  const capabilities = resolveLoadOptions(options);
  // gather all motions
  const motion_list: {
    origin: string;
    url: string;
  }[] = [];
  for (const model of modelData) {
    motion_list.push(
      ...model.data.FileReferences.Motions.Motion.map((motion) => ({
        origin: `${model.costume}/${motion.Name}`,
        url: motion.File
      })),
      ...model.data.FileReferences.Motions.Expression.map((motion) => ({
        origin: `${model.costume}/${motion.Name}`,
        url: motion.File
      }))
    );
  }
  // remove dupulicate
  const unique_motion: typeof motion_list = [];
  motion_list.forEach((m) => {
    if (!unique_motion.some((u) => m.url === u.url)) {
      unique_motion.push(m);
    }
  });
  // preload
  const total = unique_motion.length;
  let count = 0;
  const taskList: {
    task: (signal: AbortSignal) => Promise<Response>;
    callback: () => void;
  }[] = [];
  for (const motion of unique_motion) {
    taskList.push({
      task: (signal) =>
        capabilities
          .request(async (requestSignal) => {
            const response = await capabilities.fetch(motion.url, {
              signal: requestSignal ?? signal
            });
            if (!response.ok) throw response;
            return response;
          }, signal)
          .catch((error: unknown) => {
            if (!signal.aborted) {
              const warning = getAssetLoadWarning("motion", motion.origin, motion.url, error);
              capabilities.logger.warn("Live2DPlayerLoader", warning);
              onWarning(warning);
            }
            throw error;
          }),
      callback: function () {
        count++;
        onProgress(Live2DLoadProgressType.ModelMotion, count, total, motion.origin);
      }
    });
  }
  const queue = new PreloadQueue(taskList, 20, 60, capabilities.signal);
  await queue.run();
}
