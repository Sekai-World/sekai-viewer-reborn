/**
 * Project Sekai scenario (ScenarioSceneData) data contract.
 *
 * Ported from the legacy sekai-viewer `story-scenerio.d.ts` contract; the
 * field-level schema is cross-verified against recovered game code in the
 * pjsk-apk-reverse knowledge base (`jp-6.7.0-scenarioid-bundle-mapping.md`).
 * Unlike the legacy declaration file, this module compiles to runtime values
 * (the enums are used by the player at runtime).
 */

export interface AppearCharacter {
  Character2dId: number;
  CostumeType: string;
}

export enum SnippetAction {
  None = 0,
  Talk = 1,
  /** Change live2d model motion/visibility/position. */
  CharacterLayout = 2,
  InputName = 3,
  /** Change live2d model motion. */
  CharacterMotion = 4,
  Selectable = 5,
  SpecialEffect = 6,
  Sound = 7,
  /** Control model display mode. */
  CharacterLayoutMode = 8
}

export enum SnippetProgressBehavior {
  Now = 0,
  WaitUnitilFinished = 1
}

export interface Snippet {
  Action: SnippetAction;
  ProgressBehavior: SnippetProgressBehavior;
  ReferenceIndex: number;
  Delay: number;
}

export interface TalkCharacter {
  Character2dId: number;
}

export interface Motion {
  Character2dId: number;
  MotionName: string;
  FacialName: string;
  TimingSyncValue: number;
}

export interface Voice {
  Character2dId: number;
  VoiceId: string;
  Volume: number;
}

export interface TalkData {
  TalkCharacters: TalkCharacter[];
  WindowDisplayName: string;
  Body: string;
  TalkTention: number;
  /**
   * - 0: No voice, No lip sync
   * - 1: Lip sync with voice
   * - 2: Not lip sync with voice (text in "()", monologue)
   */
  LipSync: number;
  MotionChangeFrom: number;
  Motions: Motion[];
  Voices: Voice[];
  Speed: number;
  FontSize: number;
  WhenFinishCloseWindow: number;
  RequirePlayEffect: number;
  EffectReferenceIdx: number;
  RequirePlaySound: number;
  SoundReferenceIdx: number;
}

export enum CharacterLayoutType {
  /** Apply motion or expression only (used by CharacterMotion snippets). */
  CharacterMotion = 0,
  /** Apply motion or expression with position change. */
  Motion = 1,
  /** Model appear in the scene, apply motion with position change. */
  Appear = 2,
  /** Model disappear in the scene, apply motion with position change. */
  Clear = 3,
  /** Ignored by the player (matches legacy behavior). */
  ChangeDepth = 6
}

export enum CharacterLayoutPosition {
  Unspecified = 0,
  LeftEdge = 2,
  Left = 3,
  Center = 4,
  RightEdge = 6,
  Right = 7,
  BottomLeftEdge = 9,
  BottomEdge = 10,
  BottomRightEdge = 12
}

export enum CharacterLayoutDepthType {
  Top = 0,
  MidTop = 1,
  MidBack = 2,
  Back = 3
}

export enum CharacterLayoutMoveSpeedType {
  Slow = 0,
  Normal = 1,
  Fast = 2
}

export interface LayoutData {
  Type: CharacterLayoutType;
  SideFrom: CharacterLayoutPosition;
  SideFromOffsetX: number;
  SideTo: CharacterLayoutPosition;
  SideToOffsetX: number;
  DepthType: CharacterLayoutDepthType;
  Character2dId: number;
  CostumeType: string;
  MotionName: string;
  FacialName: string;
  MoveSpeedType: CharacterLayoutMoveSpeedType;
}

export interface FirstLayoutData {
  Character2dId: number;
  CostumeType: string;
  MotionName: string;
  FacialName: string;
  OffsetX: number;
  PositionSide: number;
}

export enum SpecialEffectType {
  None = 0,
  BlackIn = 1,
  BlackOut = 2,
  WhiteIn = 3,
  WhiteOut = 4,
  ShakeScreen = 5,
  ShakeWindow = 6,
  ChangeBackground = 7,
  Telop = 8,
  FlashbackIn = 9,
  FlashbackOut = 10,
  ChangeCardStill = 11,
  AmbientColorNormal = 12,
  AmbientColorEvening = 13,
  AmbientColorNight = 14,
  PlayScenarioEffect = 15,
  StopScenarioEffect = 16,
  ChangeBackgroundStill = 17,
  PlaceInfo = 18,
  Movie = 19,
  SekaiIn = 20,
  SekaiOut = 21,
  AttachCharacterShader = 22,
  SimpleSelectable = 23,
  FullScreenText = 24,
  StopShakeScreen = 25,
  StopShakeWindow = 26,
  MemoryIn = 27,
  MemoryOut = 28,
  BlackWipeInLeft = 29,
  BlackWipeOutLeft = 30,
  BlackWipeInRight = 31,
  BlackWipeOutRight = 32,
  BlackWipeInTop = 33,
  BlackWipeOutTop = 34,
  BlackWipeInBottom = 35,
  BlackWipeOutBottom = 36,
  FullScreenTextShow = 38,
  FullScreenTextHide = 39,
  SekaiInCenter = 40,
  SekaiOutCenter = 41,
  ChangeCameraPosition = 42,
  ChangeCameraZoomLevel = 43,
  Blur = 44
}

export interface SpecialEffectData {
  EffectType: SpecialEffectType;
  StringVal: string;
  StringValSub: string;
  Duration: number;
  IntVal: number;
}

export enum SeAttachCharacterShaderType {
  None = "none",
  Empty = "",
  Hologram = "hologram",
  Monitor = "monitor",
  Blur = "blur"
}

/**
 * Scenario effect (scenario/effect) categories known to the player. The list
 * mirrors the legacy viewer's animation coverage.
 */
export const SeScenarioEffectType = {
  line: ["line"],
  line_legend: [
    "line_legend",
    "line_legend_02",
    "line_legend_02_akito",
    "line_legend_02_toya",
    "line_legend_02_kohane",
    "line_legend_02_an",
    "line_legend_03_a",
    "line_legend_03_a_white",
    "line_legend_03_b",
    "line_legend_04",
    "line_legend_04_white"
  ],
  kirakira: [
    "kirakira_01",
    "kirakira_01_still_an",
    "kirakira_02",
    "kirakira_02_still",
    "kirakira_03",
    "kirakira_05",
    "kirakira_06_sanrio_c",
    "kirakira_07_toya",
    "kirakira_08_mrmrhouse"
  ],
  black_out: ["black_out", "black_out_02", "black_out_03", "black_out_04"],
  light_up: ["light_up", "light_up_fireworks_01", "light_up_fireworks_02"],
  light_up_legend: ["light_up_legend_01", "light_up_legend_02", "light_up_legend_03"],
  dash_line: ["dash_line_down", "dash_line_l", "dash_line_r", "dash_line_up"]
};

export enum SoundPlayMode {
  CrossFade = 0,
  Stack = 1,
  LoopSe = 2,
  StopSe = 3,
  SetBgmVolume = 4
}

export interface SoundData {
  PlayMode: SoundPlayMode;
  Bgm: string;
  Se: string;
  Volume: number;
  SeBundleName: string;
  Duration: number;
}

export enum CharacterLayoutMode {
  Normal = 0,
  ThreeModels = 3
}

export interface ScenarioSnippetCharacterLayoutMode {
  CharacterLayoutMode: CharacterLayoutMode;
}

export interface IScenarioData {
  ScenarioId: string;
  AppearCharacters: AppearCharacter[];
  FirstLayout: FirstLayoutData[];
  FirstBgm: string;
  FirstBackground: string;
  FirstCharacterLayoutMode: CharacterLayoutMode;
  Snippets: Snippet[];
  TalkData: TalkData[];
  LayoutData: LayoutData[];
  SpecialEffectData: SpecialEffectData[];
  SoundData: SoundData[];
  NeedBundleNames: string[];
  IncludeSoundDataBundleNames: string[];
  ScenarioSnippetCharacterLayoutModes: ScenarioSnippetCharacterLayoutMode[];
}

/**
 * Cubism model3.json shape the player relies on, with legacy-normalized
 * motion groups. `url` is the model base URL used to resolve relative
 * FileReferences entries.
 */
export interface ILive2DModelMotionRef {
  Name: string;
  File: string;
  FadeInTime: number;
  FadeOutTime: number;
}

export interface ILive2DModelData {
  url?: string;
  FileReferences: {
    Moc: string;
    Physics: string;
    Textures: string[];
    Motions: {
      Motion: ILive2DModelMotionRef[];
      Expression: ILive2DModelMotionRef[];
    };
  };
}

/** One entry of the `live2d/model_list.json` catalog. */
export interface ILive2dModelListElement {
  modelName: string;
  modelBase: string;
  modelPath: string;
  modelFile: string;
}

/** Minimal character2d identity needed to resolve talk names and part voices. */
export interface StoryCharacter2D {
  id: number;
  /** Known values: "game_character" | "mob" | "sub_game_character"; raw mirror data may carry others. */
  characterType: string;
  characterId: number;
  unit?: string;
  assetName?: string;
}

export interface StoryMobCharacter {
  id: number;
  name: string;
}
