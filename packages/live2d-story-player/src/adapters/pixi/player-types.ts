import type { IScenarioData } from "../../model/scenario-types.js";
import type { ILive2DModelDataCollection, ILive2DTextResolver } from "../../model/live2d-model.js";
import type BaseAnimation from "./animation/BaseAnimation.js";
import type AnimationController from "./animation/AnimationController.js";
import type { Curve, CurveFunction } from "./animation/Curve.js";
import { Texture, DisplayObject } from "pixi.js";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";
import type { StoryPlayerLogger } from "../../core/log.js";

export {
  isLive2DAudioAsset,
  isLive2DImageAsset,
  isLive2DVideoAsset,
  Live2DAssetType,
  Live2DLoadProgressType
} from "../../model/live2d-assets.js";
export type {
  ILive2DAssetBase,
  ILive2DAssetUrl,
  ILive2DCachedAsset,
  ILive2DLoadProgressHandler,
  ILive2DLoadWarningHandler,
  ILive2DScenarioResource
} from "../../model/live2d-assets.js";
export type {
  ILive2DModelDataCollection,
  ILive2DStoryModelSource,
  ILive2DTextResolver
} from "../../model/live2d-model.js";

import type { ILive2DScenarioResource } from "../../model/live2d-assets.js";

/**
 * Any BaseAnimation-derived scene effect (hologram, sekai in/out, ...).
 * The legacy viewer relied on `skipLibCheck` to paper over this alias.
 */
export type Animation = BaseAnimation;

export interface ILive2DTexture {
  identifier: string;
  texture: Texture;
}
export interface Ilive2DModelInfo {
  cid: number;
  costume: string;
  position: [number, number];
  /**
   * True when model is T-pose.
   */
  t_pose: boolean;
  /**
   * This param is for show/hide animation.
   * For model visibility, use Live2DModelWithInfo.visible
   */
  hidden: boolean;
  speaking: boolean;
  /**
   * awaitble, resolve when all motion finished.
   */
  wait_motion: Promise<void>;
  animations: Animation[];
}

export interface ILive2DControllerData {
  scenarioData: IScenarioData;
  scenarioResource: ILive2DScenarioResource;
  modelData: ILive2DModelDataCollection[];
  audioAdapter?: PixiStoryAudioAdapter;
  logger?: StoryPlayerLogger;
  textResolver?: ILive2DTextResolver;
}

export interface ILive2DLayerData {
  stage_size?: [number, number];
  screen_length?: number;
  textures?: ILive2DTexture[];
  animation_controller?: AnimationController;
  audioAdapter?: PixiStoryAudioAdapter;
  logger?: StoryPlayerLogger;
}

export type AnimationObj = {
  obj: DisplayObject;
  x?: () => number;
  y?: () => number;
  scale?: () => number;
  scale_x?: () => number;
  scale_y?: () => number;
  angle?: () => number;
  alpha?: () => number;
  x_curve?: Curve;
  y_curve?: Curve;
  scale_curve?: Curve;
  scale_x_curve?: Curve;
  scale_y_curve?: Curve;
  angle_curve?: Curve;
  alpha_curve?: Curve;
  x_func?: CurveFunction;
  y_func?: CurveFunction;
  scale_func?: CurveFunction;
  scale_x_func?: CurveFunction;
  scale_y_func?: CurveFunction;
  angle_func?: CurveFunction;
  alpha_func?: CurveFunction;
};

export interface ILive2DPlayerSettings {
  voiceVolume: number;
  seVolume: number;
  bgmVolume: number;
  autoplay: boolean;
  textAnimation: boolean;
  showWarning: boolean;
  showUI: boolean;
}

export enum LoadStatus {
  Ready,
  Loading,
  Loaded
}
