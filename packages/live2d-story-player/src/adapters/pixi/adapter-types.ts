import type { Howl } from "howler";

import type { ILive2DScenarioResource } from "../../model/live2d-assets.js";
import type {
  ILive2DModelDataCollection,
  ILive2DStoryModelSource
} from "../../model/live2d-model.js";
import type { ILive2DControllerData } from "./player-types.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";
import type { StoryPlayerLogger } from "../../core/log.js";

export interface Live2DResourceAdapter<T> {
  create(url: string, signal: AbortSignal): T | Promise<T>;
  load(resource: T, url: string, signal: AbortSignal): Promise<void>;
  release(resource: T): void;
}

export interface Live2DMediaAdapters {
  image: Live2DResourceAdapter<HTMLImageElement>;
  video: Live2DResourceAdapter<HTMLVideoElement>;
  audio: Live2DResourceAdapter<Howl>;
}

export type Live2DLoadLogger = Pick<StoryPlayerLogger, "log" | "warn">;

export type Live2DLoadRequest = <T>(
  request: (signal?: AbortSignal) => Promise<T>,
  signal?: AbortSignal
) => Promise<T>;

export interface Live2DLoadOptions {
  signal?: AbortSignal;
  media?: Partial<Live2DMediaAdapters>;
  audioAdapter?: PixiStoryAudioAdapter;
  fetch?: typeof fetch;
  request?: Live2DLoadRequest;
  logger?: Live2DLoadLogger;
}

/**
 * A loaded scenario resource owns its media until `dispose` is called.
 * The player runtime must transfer this ownership to its final destroy path
 * rather than independently releasing the same image, video, or audio object.
 */
export type ILive2DLoadedScenarioResource = ILive2DScenarioResource & {
  dispose: () => void;
};

export type ILive2DLoadedControllerData = Omit<ILive2DControllerData, "scenarioResource"> & {
  scenarioResource: ILive2DLoadedScenarioResource;
};

/** Model sources may accept an AbortSignal as an optional third argument. */
export interface ILive2DAbortableStoryModelSource extends ILive2DStoryModelSource {
  getModelDataForCostume(
    costume: string,
    character2dId: number,
    signal?: AbortSignal
  ): Promise<ILive2DModelDataCollection | null>;
}
