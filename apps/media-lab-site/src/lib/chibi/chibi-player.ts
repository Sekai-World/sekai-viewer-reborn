import { CHIBI_ATLAS_TEXTURE_FILE, type ChibiModelDescriptor } from "./chibi-model";

export interface ChibiAssetResponse {
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type ChibiAssetFetcher = (url: string, signal?: AbortSignal) => Promise<ChibiAssetResponse>;

export interface ChibiSpineModelInput {
  atlasText: string;
  textureUrl: string;
  skeletonBytes: Uint8Array;
}

/** One Spine model, already bound to its atlas texture. */
export interface ChibiSpineModel {
  readonly animationNames: readonly string[];
  setAnimation(name: string, loop: boolean): void;
  destroy(): void;
}

/** One canvas inside a host element, showing at most one model. */
export interface ChibiStage {
  show(model: ChibiSpineModel): void;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface ChibiSpineRuntime {
  createStage(host: HTMLElement): ChibiStage;
  createModel(input: ChibiSpineModelInput): Promise<ChibiSpineModel>;
}

/**
 * Runtime boundary for browser-only dependencies and network access. Tests
 * provide this facade without importing Pixi, creating a canvas, or requiring
 * WebGL.
 */
export interface ChibiRuntimeFacade {
  loadSpine(): Promise<ChibiSpineRuntime>;
  fetchAsset: ChibiAssetFetcher;
}

export interface ChibiPlaybackOptions {
  loop: boolean;
}

export interface ChibiModelResource {
  readonly descriptor: ChibiModelDescriptor;
  readonly animations: readonly string[];
  /** Returns false when the model has no animation with this name. */
  setAnimation(name: string, options?: Partial<ChibiPlaybackOptions>): boolean;
  resize(width: number, height: number): void;
  destroy(): void;
}

export interface ChibiPlayer {
  load(
    descriptor: ChibiModelDescriptor,
    host: HTMLElement,
    signal: AbortSignal
  ): Promise<ChibiModelResource>;
}

/**
 * Lists the texture page names of a Spine atlas: the first non-empty line and
 * every non-empty line that follows a blank line.
 */
export const readChibiAtlasPageNames = (atlasText: string): string[] => {
  const pageNames: string[] = [];
  let atPageStart = true;

  for (const rawLine of atlasText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      atPageStart = true;
    } else if (atPageStart) {
      pageNames.push(line);
      atPageStart = false;
    }
  }

  return pageNames;
};

const assertSingleKnownTexturePage = (atlasText: string): void => {
  const pageNames = readChibiAtlasPageNames(atlasText);
  if (pageNames.length !== 1 || pageNames[0] !== CHIBI_ATLAS_TEXTURE_FILE) {
    throw new Error(
      `Chibi atlas must name exactly one texture page "${CHIBI_ATLAS_TEXTURE_FILE}", got: ${pageNames.join(", ") || "none"}`
    );
  }
};

const fetchOk = async (
  fetchAsset: ChibiAssetFetcher,
  url: string,
  label: string,
  signal?: AbortSignal
): Promise<ChibiAssetResponse> => {
  const response = await fetchAsset(url, signal);
  if (!response.ok) throw new Error(`Failed to load Chibi ${label} (${response.status})`);
  return response;
};

/** Stops waiting for a shared promise on abort; the promise itself keeps running. */
const abortable = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });

export const createChibiPlayer = (runtime: ChibiRuntimeFacade): ChibiPlayer => {
  // Each family shares one multi-megabyte skeleton; download it once per player.
  const skeletonBytesByUrl = new Map<string, Promise<Uint8Array>>();

  const loadSkeletonBytes = (url: string): Promise<Uint8Array> => {
    const cached = skeletonBytesByUrl.get(url);
    if (cached) return cached;

    // No abort signal: other loads of the same family share this download.
    const pending = fetchOk(runtime.fetchAsset, url, "skeleton")
      .then((response) => response.arrayBuffer())
      .then((buffer) => new Uint8Array(buffer));
    skeletonBytesByUrl.set(url, pending);
    pending.catch(() => {
      if (skeletonBytesByUrl.get(url) === pending) skeletonBytesByUrl.delete(url);
    });
    return pending;
  };

  const loadAtlasText = async (url: string, signal: AbortSignal): Promise<string> => {
    const response = await fetchOk(runtime.fetchAsset, url, "atlas", signal);
    const atlasText = await response.text();
    assertSingleKnownTexturePage(atlasText);
    return atlasText;
  };

  return {
    async load(descriptor, host, signal) {
      signal.throwIfAborted();

      const [spine, atlasText, skeletonBytes] = await Promise.all([
        abortable(runtime.loadSpine(), signal),
        loadAtlasText(descriptor.atlasUrl, signal),
        abortable(loadSkeletonBytes(descriptor.skeletonUrl), signal)
      ]);
      signal.throwIfAborted();

      const model = await spine.createModel({
        atlasText,
        textureUrl: descriptor.textureUrl,
        skeletonBytes
      });
      if (signal.aborted) {
        model.destroy();
        signal.throwIfAborted();
      }

      let stage: ChibiStage | undefined;
      try {
        stage = spine.createStage(host);
        stage.show(model);
      } catch (error) {
        model.destroy();
        stage?.destroy();
        throw error;
      }
      const activeStage = stage;

      const animations = [...model.animationNames];
      let destroyed = false;

      return {
        descriptor,
        animations,
        setAnimation(name, options) {
          if (destroyed || !animations.includes(name)) return false;
          model.setAnimation(name, options?.loop ?? true);
          return true;
        },
        resize(width, height) {
          if (!destroyed) activeStage.resize(width, height);
        },
        destroy() {
          if (destroyed) return;
          destroyed = true;
          model.destroy();
          activeStage.destroy();
        }
      };
    }
  };
};
