import type { ILive2DModelData } from "./scenario-types.js";

export interface ILive2DModelDataCollection {
  cid: number;
  costume: string;
  data: ILive2DModelData;
}

export type ILive2DTextKind = "talk" | "telop" | "fullscreen";

export interface ILive2DResolvedText {
  displayText: string;
  translatedText: string | null;
}

export interface ILive2DTextResolvedEvent {
  kind: ILive2DTextKind;
  index: number;
  original: string;
  resolved: ILive2DResolvedText;
}

/**
 * Host-provided text policy. Keeps translation concerns out of the player:
 * the resolver maps a stable scenario text key plus the original Japanese
 * text to the text that should be rendered (and optional secondary text).
 */
export interface ILive2DTextResolver {
  resolve(key: string, originalText: string): ILive2DResolvedText;
}

/**
 * Supplies assembled Live2D model data for costumes referenced by a scenario.
 * The Sekai-specific model list and motion metadata rules stay outside the
 * player; the host injects an implementation.
 */
export interface ILive2DStoryModelSource {
  getModelDataForCostume(
    costume: string,
    character2dId: number
  ): Promise<ILive2DModelDataCollection | null>;
}
