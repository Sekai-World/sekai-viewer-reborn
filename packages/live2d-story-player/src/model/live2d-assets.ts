import type { Howl } from "howler";

export enum Live2DAssetType {
  SoundEffect = "sound-effect",
  BackgroundMusic = "bgm",
  Talk = "talk",
  UI = "ui",
  UISheet = "ui-sheet",
  UIVideo = "ui-video",
  BackgroundImage = "background-image",
  Video = "video"
}

interface ILive2DAssetTypeToDataMap {
  [Live2DAssetType.SoundEffect]: Howl;
  [Live2DAssetType.BackgroundMusic]: Howl;
  [Live2DAssetType.Talk]: Howl;
  [Live2DAssetType.UI]: HTMLImageElement;
  [Live2DAssetType.UISheet]: HTMLImageElement;
  [Live2DAssetType.BackgroundImage]: HTMLImageElement;
  [Live2DAssetType.Video]: HTMLVideoElement;
  [Live2DAssetType.UIVideo]: HTMLVideoElement;
}

export interface ILive2DAssetBase {
  identifier: string;
  url: string;
}

export type ILive2DAssetUrl = {
  [K in keyof ILive2DAssetTypeToDataMap]: ILive2DAssetBase & {
    type: K;
    data?: ILive2DAssetTypeToDataMap[K];
  };
}[keyof ILive2DAssetTypeToDataMap];

type ILive2DAssetUrlImage = Extract<
  ILive2DAssetUrl,
  {
    type: Live2DAssetType.BackgroundImage | Live2DAssetType.UISheet | Live2DAssetType.UI;
  }
>;
type ILive2DAssetUrlVideo = Extract<
  ILive2DAssetUrl,
  {
    type: Live2DAssetType.Video | Live2DAssetType.UIVideo;
  }
>;
type ILive2DAssetUrlAudio = Extract<
  ILive2DAssetUrl,
  {
    type: Live2DAssetType.SoundEffect | Live2DAssetType.BackgroundMusic | Live2DAssetType.Talk;
  }
>;

export function isLive2DImageAsset(asset: ILive2DAssetUrl): asset is ILive2DAssetUrlImage {
  return (
    asset.type === Live2DAssetType.BackgroundImage ||
    asset.type === Live2DAssetType.UISheet ||
    asset.type === Live2DAssetType.UI
  );
}

export function isLive2DVideoAsset(asset: ILive2DAssetUrl): asset is ILive2DAssetUrlVideo {
  return asset.type === Live2DAssetType.Video || asset.type === Live2DAssetType.UIVideo;
}

export function isLive2DAudioAsset(asset: ILive2DAssetUrl): asset is ILive2DAssetUrlAudio {
  return (
    asset.type === Live2DAssetType.SoundEffect ||
    asset.type === Live2DAssetType.BackgroundMusic ||
    asset.type === Live2DAssetType.Talk
  );
}

export type ILive2DCachedAsset = Required<ILive2DAssetUrl>;

export type ILive2DScenarioResource = {
  image: Required<ILive2DAssetUrlImage>[];
  video: Required<ILive2DAssetUrlVideo>[];
  audio: Required<ILive2DAssetUrlAudio>[];
};

export enum Live2DLoadProgressType {
  Media = "media",
  ModelData = "model-data",
  ModelTexture = "model-texture",
  ModelMoc = "model-moc",
  ModelPhysics = "model-physics",
  ModelAssets = "model-assets",
  ModelMotion = "model-motion",
  RenderModel = "render-model"
}

export type ILive2DLoadProgressHandler = (
  type: Live2DLoadProgressType,
  count: number,
  total: number,
  info?: string
) => void;

export type ILive2DLoadWarningHandler = (reason: string) => void;
