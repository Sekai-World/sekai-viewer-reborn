import { afterEach, describe, expect, it, vi } from "vitest";

const doubles = vi.hoisted(() => {
  class FakeContainer {
    children: FakeContainer[] = [];
    alpha = 1;
    rotation = 0;
    eventMode = "auto";
    interactiveChildren = true;
    pivot = this.createPoint();
    position = this.createPoint();
    scale = this.createPoint();

    private createPoint() {
      return {
        x: 0,
        y: 0,
        set(x: number, y = x) {
          this.x = x;
          this.y = y;
        }
      };
    }

    addChild<T extends FakeContainer>(...children: T[]): T {
      this.children.push(...children);
      return children[children.length - 1]!;
    }

    removeChildren(): FakeContainer[] {
      const children = [...this.children];
      this.children = [];
      return children;
    }

    destroy(): void {
      this.children = [];
    }
  }

  class FakeTexture {
    static from(): FakeTexture {
      return new FakeTexture();
    }
  }

  class FakeLayer {
    root = new FakeContainer();
    set_style = vi.fn();
    destroy = vi.fn();
  }

  class FakeAnimationController {
    abort_controller = new AbortController();
    reset_abort = vi.fn();
    abort = vi.fn();
    delay = vi.fn(async () => {});
    wrapper = vi.fn(async () => {});
    progress_wrapper = vi.fn(async (apply: (progress: number) => void) => {
      apply(1);
    });
  }

  class FakeHologram {
    root = new FakeContainer();
    start = vi.fn();
    destroy = vi.fn();
    set_style = vi.fn();
  }

  return {
    FakeAnimationController,
    FakeContainer,
    FakeHologram,
    FakeLayer,
    FakeTexture,
    actionLayoutMode: vi.fn(),
    actionSpecialEffect: vi.fn(),
    characterLayout: vi.fn(),
    characterMotion: vi.fn(),
    log: { log: vi.fn(), warn: vi.fn() },
    selectableParser: vi.fn(() => [])
  };
});

vi.mock("pixi.js", () => ({
  AlphaFilter: class {
    resolution = 1;
    constructor(public alpha: number) {}
  },
  BlurFilter: class {},
  ColorMatrixFilter: class {},
  Container: doubles.FakeContainer,
  DisplayObject: class {},
  Texture: doubles.FakeTexture,
  Ticker: class {
    static shared = {};
  }
}));

vi.mock("howler", () => ({
  Howl: class {},
  Howler: { ctx: null, masterGain: { connect: vi.fn(), disconnect: vi.fn() } }
}));

vi.mock("@sekai-world/pixi-live2d-display-mulmotion/cubism4", () => ({
  Cubism4InternalModel: class {},
  Live2DModel: class {},
  MotionPreloadStrategy: { ALL: "all" },
  MotionPriority: { FORCE: 3 }
}));

vi.mock("../../core/log.js", () => ({ log: doubles.log }));
vi.mock("./animation/AnimationController.js", () => ({
  default: doubles.FakeAnimationController
}));
vi.mock("./animation/Hologram.js", () => ({ default: doubles.FakeHologram }));

vi.mock("./layer/Background.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/Fullcolor.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/Dialog.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/Telop.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/PlaceInfo.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/SceneEffect.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/Wipe.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/Sekai.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/FullScreenText.js", () => ({ default: doubles.FakeLayer }));
vi.mock("./layer/Movie.js", () => ({ default: doubles.FakeLayer }));

vi.mock("./action/character_layout.js", () => ({ default: doubles.characterLayout }));
vi.mock("./action/character_motion.js", () => ({ default: doubles.characterMotion }));
vi.mock("./action/action_layout_mode.js", () => ({ default: doubles.actionLayoutMode }));
vi.mock("./action/special_effect/index.js", () => ({ default: doubles.actionSpecialEffect }));
vi.mock("./action/special_effect/SimpleSelectable.js", () => ({
  default: vi.fn(),
  parseSimpleSelectableChoices: doubles.selectableParser
}));

import { Howler } from "howler";
import type { Howl } from "howler";
import { Container } from "pixi.js";
import type { Application } from "pixi.js";

import {
  CharacterLayoutDepthType,
  CharacterLayoutMode,
  CharacterLayoutMoveSpeedType,
  CharacterLayoutPosition,
  CharacterLayoutType,
  SnippetAction,
  SnippetProgressBehavior,
  SoundPlayMode,
  SpecialEffectType
} from "../../model/scenario-types.js";
import type {
  IScenarioData,
  LayoutData,
  Snippet,
  SpecialEffectData,
  TalkData
} from "../../model/scenario-types.js";
import type { ILive2DTextResolvedEvent, ILive2DTextResolver } from "../../model/live2d-model.js";
import type { ILive2DScenarioResource } from "../../model/live2d-assets.js";
import { Live2DAssetType } from "../../model/live2d-assets.js";
import type { ILive2DModelDataCollection } from "../../model/live2d-model.js";
import type { PixiStoryAudioAdapter, PixiStoryLipSyncConnection } from "./audio-adapter.js";
import { log } from "../../core/log.js";
import type { StoryPlayerLogger } from "../../core/log.js";
import { Live2DController } from "./Live2DController.js";
import { Live2DPlayer } from "./Live2DPlayer.js";
import single_action from "./action/index.js";
import action_talk from "./action/talk.js";
import action_sound from "./action/sound.js";
import action_telop from "./action/special_effect/Telop.js";
import action_full_screen_text from "./action/special_effect/FullScreenText.js";
import { discardMotion } from "./load.js";
import Live2D from "./layer/Live2D.js";

const createSnippet = (
  Action: SnippetAction,
  ProgressBehavior = SnippetProgressBehavior.WaitUnitilFinished,
  ReferenceIndex = 0
): Snippet => ({ Action, ProgressBehavior, ReferenceIndex, Delay: 0 });

const createSpecialEffect = (
  EffectType: SpecialEffectType,
  StringVal = "",
  StringValSub = ""
): SpecialEffectData => ({ EffectType, StringVal, StringValSub, Duration: 0, IntVal: 0 });

const createTalkData = (overrides: Partial<TalkData> = {}): TalkData => ({
  TalkCharacters: [],
  WindowDisplayName: "Miku",
  Body: "original talk",
  TalkTention: 0,
  LipSync: 0,
  MotionChangeFrom: 0,
  Motions: [],
  Voices: [],
  Speed: 1,
  FontSize: 16,
  WhenFinishCloseWindow: 0,
  RequirePlayEffect: 0,
  EffectReferenceIdx: 0,
  RequirePlaySound: 0,
  SoundReferenceIdx: 0,
  ...overrides
});

const createScenario = (Snippets: Snippet[] = []): IScenarioData => ({
  ScenarioId: "engine-parity-test",
  AppearCharacters: [],
  FirstLayout: [],
  FirstBgm: "",
  FirstBackground: "",
  FirstCharacterLayoutMode: CharacterLayoutMode.Normal,
  Snippets,
  TalkData: [],
  LayoutData: [],
  SpecialEffectData: [],
  SoundData: [],
  NeedBundleNames: [],
  IncludeSoundDataBundleNames: [],
  ScenarioSnippetCharacterLayoutModes: []
});

const createScenarioResource = (
  audio: ILive2DScenarioResource["audio"] = [],
  image: ILive2DScenarioResource["image"] = []
): ILive2DScenarioResource => ({ image, video: [], audio });

const createController = (
  scenarioData = createScenario(),
  scenarioResource = createScenarioResource(),
  modelData: ILive2DModelDataCollection[] = [],
  audioAdapter?: PixiStoryAudioAdapter,
  logger?: StoryPlayerLogger
): Live2DController => {
  const app = { stage: new Container() } as unknown as Application;
  return new Live2DController(app, [1280, 720], {
    scenarioData,
    scenarioResource,
    modelData,
    ...(audioAdapter ? { audioAdapter } : {}),
    ...(logger ? { logger } : {})
  });
};

const createAudioAdapter = (
  connection: PixiStoryLipSyncConnection | null = null
): PixiStoryAudioAdapter => ({
  isPlaying: vi.fn(() => true),
  play: vi.fn(),
  stop: vi.fn(),
  unload: vi.fn(),
  setVolume: vi.fn(),
  getVolume: vi.fn(() => 0.5),
  setLoop: vi.fn(),
  fade: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  connectLipSync: vi.fn(() => connection)
});

const createSound = (isPlaying = true) => ({
  playing: vi.fn(() => isPlaying),
  volume: vi.fn(),
  loop: vi.fn(),
  fade: vi.fn(),
  play: vi.fn(),
  stop: vi.fn(),
  unload: vi.fn(),
  once: vi.fn(),
  off: vi.fn()
});

const createAudioAsset = (
  type: Live2DAssetType.Talk | Live2DAssetType.BackgroundMusic | Live2DAssetType.SoundEffect,
  identifier: string,
  sound: ReturnType<typeof createSound>
): ILive2DScenarioResource["audio"][number] =>
  ({
    type,
    identifier,
    url: `https://assets.example.test/${identifier}`,
    data: sound as unknown as Howl
  }) as ILive2DScenarioResource["audio"][number];

const createLayoutData = (Character2dId: number, CostumeType: string): LayoutData => ({
  Type: CharacterLayoutType.CharacterMotion,
  SideFrom: CharacterLayoutPosition.Unspecified,
  SideFromOffsetX: 0,
  SideTo: CharacterLayoutPosition.Unspecified,
  SideToOffsetX: 0,
  DepthType: CharacterLayoutDepthType.Back,
  Character2dId,
  CostumeType,
  MotionName: "",
  FacialName: "",
  MoveSpeedType: CharacterLayoutMoveSpeedType.Normal
});

const createActionLayers = () => ({
  dialog: {
    draw: vi.fn(),
    animate: vi.fn(async () => {}),
    show: vi.fn(async () => {}),
    hide: vi.fn(async () => {})
  },
  telop: {
    draw: vi.fn(),
    show: vi.fn(async () => {}),
    hide: vi.fn(async () => {})
  },
  fullscreen_text: {
    show: vi.fn(),
    draw: vi.fn(),
    animate: vi.fn(async () => {})
  },
  live2d: {
    speak: vi.fn(),
    stop_speaking: vi.fn()
  }
});

afterEach(() => {
  vi.clearAllMocks();
  (Howler as unknown as { ctx: unknown }).ctx = null;
});

describe("Live2D engine parity", () => {
  it("groups Now snippets in parallel and keeps other actions serial through talk checkpoints", async () => {
    const scenarioData = createScenario([
      createSnippet(SnippetAction.None),
      createSnippet(SnippetAction.Sound, SnippetProgressBehavior.Now),
      createSnippet(SnippetAction.CharacterMotion),
      createSnippet(SnippetAction.Talk),
      createSnippet(SnippetAction.Sound, SnippetProgressBehavior.Now),
      createSnippet(SnippetAction.None)
    ]);
    scenarioData.AppearCharacters = [{ Character2dId: 1, CostumeType: "costume-a" }];
    scenarioData.LayoutData = [createLayoutData(1, "")];
    scenarioData.TalkData = [createTalkData()];
    const controller = createController(scenarioData);
    const groups: { modelStep: number; actionSteps: number[] }[] = [];
    controller.live2d_load_model = vi.fn(async (modelStep) => {
      groups.push({ modelStep, actionSteps: [] });
    });
    controller.apply_action = vi.fn(async (actionStep) => {
      groups.at(-1)?.actionSteps.push(actionStep);
    });
    controller.wait_talk_sounds_finished = vi.fn(async () => {});

    await expect(controller.step_until_checkpoint(0)).resolves.toBe(4);

    expect(groups).toEqual([
      { modelStep: 1, actionSteps: [0, 1] },
      { modelStep: 2, actionSteps: [2] },
      { modelStep: 4, actionSteps: [3, 4] }
    ]);
    expect(controller.wait_talk_sounds_finished).toHaveBeenCalledOnce();
  });

  it.each([
    { label: "telop", type: SpecialEffectType.Telop },
    { label: "full-screen text", type: SpecialEffectType.FullScreenText },
    { label: "simple selectable", type: SpecialEffectType.SimpleSelectable }
  ])("parks at a $label checkpoint", async ({ type }) => {
    const scenarioData = createScenario([
      createSnippet(SnippetAction.None),
      createSnippet(SnippetAction.SpecialEffect, SnippetProgressBehavior.WaitUnitilFinished, 0),
      createSnippet(SnippetAction.None)
    ]);
    scenarioData.SpecialEffectData = [createSpecialEffect(type)];
    const controller = createController(scenarioData);
    const groups: { modelStep: number; actionSteps: number[] }[] = [];
    controller.live2d_load_model = vi.fn(async (modelStep) => {
      groups.push({ modelStep, actionSteps: [] });
    });
    controller.apply_action = vi.fn(async (actionStep) => {
      groups.at(-1)?.actionSteps.push(actionStep);
    });
    controller.wait_talk_sounds_finished = vi.fn(async () => {});

    await expect(controller.step_until_checkpoint(0)).resolves.toBe(1);

    expect(groups).toEqual([
      { modelStep: 0, actionSteps: [0] },
      { modelStep: 1, actionSteps: [1] }
    ]);
  });

  it("returns -1 when serial playback reaches the final snippet", async () => {
    const scenarioData = createScenario([
      createSnippet(SnippetAction.None),
      createSnippet(SnippetAction.Sound)
    ]);
    const controller = createController(scenarioData);
    const groups: { modelStep: number; actionSteps: number[] }[] = [];
    controller.live2d_load_model = vi.fn(async (modelStep) => {
      groups.push({ modelStep, actionSteps: [] });
    });
    controller.apply_action = vi.fn(async (actionStep) => {
      groups.at(-1)?.actionSteps.push(actionStep);
    });
    controller.wait_talk_sounds_finished = vi.fn(async () => {});

    await expect(controller.step_until_checkpoint(0)).resolves.toBe(-1);

    expect(groups).toEqual([
      { modelStep: 0, actionSteps: [0] },
      { modelStep: 1, actionSteps: [1] }
    ]);
  });

  it("pads the initial six-model queue, refreshes costumes, and evicts the oldest model", () => {
    const costumes = Array.from({ length: 6 }, (_, index) => `costume-${index + 1}`);
    const scenarioData = createScenario();
    scenarioData.AppearCharacters = costumes.map((CostumeType, index) => ({
      Character2dId: index + 1,
      CostumeType
    }));
    scenarioData.LayoutData = [
      ...costumes.map((_, index) => createLayoutData(index + 1, "")),
      createLayoutData(1, "costume-1-alt"),
      createLayoutData(2, "")
    ];
    scenarioData.Snippets = scenarioData.LayoutData.map((_, index) =>
      createSnippet(
        SnippetAction.CharacterLayout,
        SnippetProgressBehavior.WaitUnitilFinished,
        index
      )
    );
    const controller = createController(scenarioData);

    expect(controller.model_queue).toHaveLength(8);
    expect(controller.model_queue.slice(0, 6)).toEqual(Array.from({ length: 6 }, () => costumes));
    expect(controller.model_queue[6]).toEqual([
      "costume-2",
      "costume-3",
      "costume-4",
      "costume-5",
      "costume-6",
      "costume-1-alt"
    ]);
    expect(controller.model_queue[7]).toEqual([
      "costume-3",
      "costume-4",
      "costume-5",
      "costume-6",
      "costume-1-alt",
      "costume-2"
    ]);
  });

  it("preserves the scene and UI layer child ordering from the player constructor", () => {
    const stage = new Container();
    const player = new Live2DPlayer(
      { stage } as unknown as Application,
      [1280, 720],
      createScenarioResource()
    );

    expect(stage.children).toHaveLength(2);
    expect(stage.children[0]).toBe(player.root);
    expect(stage.children[1]).toBe(player.UIRoot);
    expect(player.root.children).toEqual([
      player.layers.background.root,
      player.layers.live2d.root,
      player.layers.scene_effect.root,
      player.layers.memory_filter.root,
      player.layers.flashback_filter.root,
      player.layers.telop.root,
      player.layers.sekai.root,
      player.layers.wipe.root,
      player.layers.fullcolor.root,
      player.layers.fullscreen_text.root,
      player.layers.movie.root
    ]);
    expect(player.UIRoot.children).toEqual([
      player.layers.dialog.root,
      player.layers.place_info.root
    ]);
    expect(player.layers.live2d.root.children).toEqual([
      player.layers.live2d.structure.live2d,
      player.layers.live2d.structure.effect
    ]);
  });

  it("deduplicates referenced motions and expressions and prunes names missing from model data", () => {
    const scenarioData = createScenario([
      createSnippet(SnippetAction.CharacterMotion, SnippetProgressBehavior.WaitUnitilFinished, 0),
      createSnippet(SnippetAction.CharacterMotion, SnippetProgressBehavior.WaitUnitilFinished, 0),
      createSnippet(SnippetAction.CharacterMotion, SnippetProgressBehavior.WaitUnitilFinished, 1)
    ]);
    scenarioData.AppearCharacters = [{ Character2dId: 1, CostumeType: "costume-a" }];
    scenarioData.LayoutData = [
      { ...createLayoutData(1, ""), MotionName: "wave", FacialName: "smile" },
      { ...createLayoutData(1, ""), MotionName: "missing-motion", FacialName: "missing-expression" }
    ];
    const modelData: ILive2DModelDataCollection[] = [
      {
        cid: 1,
        costume: "costume-a",
        data: {
          FileReferences: {
            Moc: "model.moc3",
            Physics: "physics.json",
            Textures: ["texture.png"],
            Motions: {
              Motion: ["wave", "unused-motion"].map((Name) => ({
                Name,
                File: `${Name}.motion3.json`,
                FadeInTime: 0,
                FadeOutTime: 0
              })),
              Expression: ["smile", "unused-expression"].map((Name) => ({
                Name,
                File: `${Name}.exp3.json`,
                FadeInTime: 0,
                FadeOutTime: 0
              }))
            }
          }
        }
      }
    ];

    expect(discardMotion(scenarioData, modelData)).toBe(modelData);
    expect(modelData[0]?.data.FileReferences.Motions.Motion.map(({ Name }) => Name)).toEqual([
      "wave"
    ]);
    expect(modelData[0]?.data.FileReferences.Motions.Expression.map(({ Name }) => Name)).toEqual([
      "smile"
    ]);
  });

  it("dispatches a supported action and emits a warning for an unknown action", async () => {
    const controller = createController();
    const supported = createSnippet(SnippetAction.CharacterLayoutMode);
    const warnings: string[] = [];
    controller.events.on("warn", (message) => warnings.push(message));

    await single_action(controller, supported);
    expect(doubles.actionLayoutMode).toHaveBeenCalledWith(controller, supported);

    const unknown = createSnippet(255 as SnippetAction);
    await single_action(controller, unknown);

    expect(log.warn).toHaveBeenCalledWith(
      "Live2DController",
      "undefined not implemented!",
      unknown
    );
    expect(warnings).toEqual(["undefined not implemented!"]);
  });

  it("routes engine warnings through the injected logger", async () => {
    const logger: StoryPlayerLogger = { log: vi.fn(), warn: vi.fn() };
    const controller = createController(
      createScenario(),
      createScenarioResource(),
      [],
      undefined,
      logger
    );
    const unknown = createSnippet(255 as SnippetAction);

    await single_action(controller, unknown);

    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "undefined not implemented!",
      unknown
    );
    expect(log.warn).not.toHaveBeenCalledWith(
      "Live2DController",
      "undefined not implemented!",
      unknown
    );
  });

  it("multiplies scenario gain by channel settings and halves the configured BGM level", async () => {
    const bgm = createSound();
    const voice = createSound();
    const soundEffect = createSound();
    const scenarioData = createScenario();
    scenarioData.SoundData = [
      {
        PlayMode: SoundPlayMode.CrossFade,
        Bgm: "event-bgm",
        Se: "",
        Volume: 0.5,
        SeBundleName: "",
        Duration: 1
      },
      {
        PlayMode: SoundPlayMode.CrossFade,
        Bgm: "",
        Se: "event-se",
        Volume: 0.5,
        SeBundleName: "",
        Duration: 0.5
      }
    ];
    const resource = createScenarioResource([
      createAudioAsset(Live2DAssetType.BackgroundMusic, "event-bgm", bgm),
      createAudioAsset(Live2DAssetType.Talk, "voice", voice),
      createAudioAsset(Live2DAssetType.SoundEffect, "event-se", soundEffect)
    ]);
    const controller = createController(scenarioData, resource);
    controller.stop_sounds = vi.fn();

    controller.set_volume({ voice_volume: 0.25, bgm_volume: 0.6, se_volume: 0.8 });

    expect(controller.settings).toMatchObject({
      voice_volume: 0.25,
      bgm_volume: 0.3,
      se_volume: 0.8
    });
    expect(voice.volume).toHaveBeenCalledWith(0.25);
    expect(bgm.volume).toHaveBeenCalledWith(0.3);
    expect(soundEffect.volume).toHaveBeenCalledWith(0.8);

    await single_action(controller, createSnippet(SnippetAction.Sound, undefined, 0));
    await single_action(controller, createSnippet(SnippetAction.Sound, undefined, 1));

    expect(bgm.fade).toHaveBeenCalledWith(0, 0.15, 1000);
    expect(soundEffect.fade).toHaveBeenCalledWith(0, 0.4, 500);
  });

  it("routes sound, talk, fullscreen voice, and controller operations through the injected adapter", async () => {
    const audioAdapter = createAudioAdapter();
    const effectSound = createSound();
    const talkSound = createSound();
    const fullscreenSound = createSound();
    const scenarioData = createScenario();
    scenarioData.SoundData = [
      {
        PlayMode: SoundPlayMode.Stack,
        Bgm: "",
        Se: "effect",
        Volume: 0.5,
        SeBundleName: "",
        Duration: 0
      }
    ];
    scenarioData.TalkData = [
      createTalkData({ Voices: [{ Character2dId: 1, VoiceId: "talk", Volume: 0.5 }] })
    ];
    scenarioData.SpecialEffectData = [
      createSpecialEffect(SpecialEffectType.FullScreenText, "caption", "fullscreen")
    ];
    const controller = createController(
      scenarioData,
      createScenarioResource([
        createAudioAsset(Live2DAssetType.SoundEffect, "effect", effectSound),
        createAudioAsset(Live2DAssetType.Talk, "talk", talkSound),
        createAudioAsset(Live2DAssetType.Talk, "fullscreen", fullscreenSound)
      ]),
      [],
      audioAdapter
    );
    const layers = createActionLayers();
    controller.layers = layers as unknown as Live2DController["layers"];

    controller.set_volume({ voice_volume: 0.4, se_volume: 0.3 });
    await action_sound(controller, createSnippet(SnippetAction.Sound));
    await action_talk(controller, createSnippet(SnippetAction.Talk));
    await action_full_screen_text(
      controller,
      createSnippet(SnippetAction.SpecialEffect, SnippetProgressBehavior.WaitUnitilFinished, 0)
    );

    expect(audioAdapter.isPlaying).toHaveBeenCalled();
    expect(audioAdapter.setLoop).toHaveBeenCalledWith(effectSound, false);
    expect(audioAdapter.setVolume).toHaveBeenCalledWith(effectSound, 0.15);
    expect(audioAdapter.setVolume).toHaveBeenCalledWith(talkSound, 0.2);
    expect(audioAdapter.setVolume).toHaveBeenCalledWith(fullscreenSound, 0.4);
    expect(audioAdapter.play).toHaveBeenCalledWith(effectSound);
    expect(audioAdapter.play).toHaveBeenCalledWith(talkSound);
    expect(audioAdapter.play).toHaveBeenCalledWith(fullscreenSound);
    expect(audioAdapter.stop).toHaveBeenCalledWith(talkSound);
  });

  it("keeps the legacy zero-volume truthiness behavior", () => {
    const voice = createSound();
    const bgm = createSound();
    const soundEffect = createSound();
    const controller = createController(
      createScenario(),
      createScenarioResource([
        createAudioAsset(Live2DAssetType.Talk, "voice", voice),
        createAudioAsset(Live2DAssetType.BackgroundMusic, "bgm", bgm),
        createAudioAsset(Live2DAssetType.SoundEffect, "se", soundEffect)
      ])
    );

    controller.set_volume({ voice_volume: 0, bgm_volume: 0, se_volume: 0 });

    expect(controller.settings).toMatchObject({
      voice_volume: 0,
      bgm_volume: 0,
      se_volume: 0
    });
    expect(voice.volume).not.toHaveBeenCalled();
    expect(bgm.volume).not.toHaveBeenCalled();
    expect(soundEffect.volume).not.toHaveBeenCalled();
  });

  it("resolves talk, telop, and full-screen text by stable scenario keys and renders the results", async () => {
    const scenarioData = createScenario();
    scenarioData.TalkData = [createTalkData()];
    scenarioData.SpecialEffectData = [
      createSpecialEffect(SpecialEffectType.Telop, "original telop"),
      createSpecialEffect(SpecialEffectType.FullScreenText, "original full-screen", "full-voice")
    ];
    const fullScreenVoice = createSound(false);
    const controller = createController(
      scenarioData,
      createScenarioResource([
        createAudioAsset(Live2DAssetType.Talk, "full-voice", fullScreenVoice)
      ])
    );
    const textResolvedEvents: ILive2DTextResolvedEvent[] = [];
    controller.events.on("textResolved", (event) => textResolvedEvents.push(event));
    const layers = createActionLayers();
    controller.layers = layers as unknown as Live2DController["layers"];
    controller.replay_silent = true;
    controller.settings.text_animation = false;
    const resolver = {
      resolve: vi.fn((key: string) => ({
        displayText: `display:${key}`,
        translatedText: `translation:${key}`
      }))
    } satisfies ILive2DTextResolver;
    controller.textResolver = resolver;

    await action_talk(controller, createSnippet(SnippetAction.Talk));
    await action_telop(
      controller,
      createSnippet(SnippetAction.SpecialEffect, SnippetProgressBehavior.WaitUnitilFinished, 0)
    );
    await action_full_screen_text(
      controller,
      createSnippet(SnippetAction.SpecialEffect, SnippetProgressBehavior.WaitUnitilFinished, 1)
    );

    expect(resolver.resolve).toHaveBeenNthCalledWith(1, "talk_0", "original talk");
    expect(resolver.resolve).toHaveBeenNthCalledWith(2, "telop_0", "original telop");
    expect(resolver.resolve).toHaveBeenNthCalledWith(
      3,
      "fullscreen_texts_1",
      "original full-screen"
    );
    expect(layers.dialog.draw).toHaveBeenCalledWith("Miku", "display:talk_0", "translation:talk_0");
    expect(layers.telop.draw).toHaveBeenCalledWith("display:telop_0", "translation:telop_0");
    expect(layers.fullscreen_text.draw).toHaveBeenCalledWith(
      "display:fullscreen_texts_1",
      "translation:fullscreen_texts_1"
    );
    expect(textResolvedEvents).toEqual([
      {
        kind: "talk",
        index: 0,
        original: "original talk",
        resolved: { displayText: "display:talk_0", translatedText: "translation:talk_0" }
      },
      {
        kind: "telop",
        index: 0,
        original: "original telop",
        resolved: { displayText: "display:telop_0", translatedText: "translation:telop_0" }
      },
      {
        kind: "fullscreen",
        index: 1,
        original: "original full-screen",
        resolved: {
          displayText: "display:fullscreen_texts_1",
          translatedText: "translation:fullscreen_texts_1"
        }
      }
    ]);
  });

  it("emits direct text resolution events with the original-text fallback", () => {
    const controller = createController();
    const textResolvedEvents: ILive2DTextResolvedEvent[] = [];
    controller.events.on("textResolved", (event) => textResolvedEvents.push(event));

    expect(controller.resolveText("talk", 3, "talk fallback")).toEqual({
      displayText: "talk fallback",
      translatedText: null
    });
    expect(controller.resolveText("telop", 5, "telop fallback")).toEqual({
      displayText: "telop fallback",
      translatedText: null
    });
    expect(controller.resolveText("fullscreen", 8, "fullscreen fallback")).toEqual({
      displayText: "fullscreen fallback",
      translatedText: null
    });

    expect(textResolvedEvents).toEqual([
      {
        kind: "talk",
        index: 3,
        original: "talk fallback",
        resolved: { displayText: "talk fallback", translatedText: null }
      },
      {
        kind: "telop",
        index: 5,
        original: "telop fallback",
        resolved: { displayText: "telop fallback", translatedText: null }
      },
      {
        kind: "fullscreen",
        index: 8,
        original: "fullscreen fallback",
        resolved: { displayText: "fullscreen fallback", translatedText: null }
      }
    ]);
  });

  it("renders original scenario text when no resolver is supplied and applies voice scenario gain", async () => {
    const voice = createSound(false);
    const scenarioData = createScenario([createSnippet(SnippetAction.Talk)]);
    scenarioData.TalkData = [
      createTalkData({
        Voices: [{ Character2dId: 1, VoiceId: "voice-1", Volume: 0.5 }]
      })
    ];
    const controller = createController(
      scenarioData,
      createScenarioResource([createAudioAsset(Live2DAssetType.Talk, "voice-1", voice)])
    );
    const layers = createActionLayers();
    controller.layers = layers as unknown as Live2DController["layers"];
    controller.settings.voice_volume = 0.4;
    controller.settings.text_animation = false;

    await action_talk(controller, scenarioData.Snippets[0]!);

    expect(layers.dialog.draw).toHaveBeenCalledWith("Miku", "original talk", null);
    expect(voice.volume).toHaveBeenCalledWith(0.2);
    expect(voice.play).toHaveBeenCalledOnce();
  });

  it("stops and unloads scenario audio and clears loaded images during destruction", () => {
    const voice = createSound(true);
    const bgm = createSound(false);
    const soundEffect = createSound(true);
    const image = { src: "blob:ui-image", remove: vi.fn() } as unknown as HTMLImageElement;
    const controller = createController(
      createScenario(),
      createScenarioResource(
        [
          createAudioAsset(Live2DAssetType.Talk, "voice", voice),
          createAudioAsset(Live2DAssetType.BackgroundMusic, "bgm", bgm),
          createAudioAsset(Live2DAssetType.SoundEffect, "se", soundEffect)
        ],
        [
          {
            type: Live2DAssetType.UI,
            identifier: "ui-image",
            url: "https://assets.example.test/ui.png",
            data: image
          }
        ]
      )
    );

    controller.destroy();

    expect(voice.stop).toHaveBeenCalledOnce();
    expect(soundEffect.stop).toHaveBeenCalledOnce();
    expect(bgm.stop).not.toHaveBeenCalled();
    expect(voice.unload).toHaveBeenCalledOnce();
    expect(bgm.unload).toHaveBeenCalledOnce();
    expect(soundEffect.unload).toHaveBeenCalledOnce();
    expect(image.src).toBe("");
    expect(image.remove).toHaveBeenCalledOnce();
  });

  it("connects the speech analyzer, resets ParamMouthOpenY, and disconnects on stop", () => {
    const mouthParameter = vi.fn();
    const attachAnalyzer = vi.fn();
    const stopSpeaking = vi.fn();
    const model = {
      visible: false,
      live2DInfo: {
        costume: "costume-a",
        speaking: false,
        t_pose: true,
        hidden: true,
        position: [0.5, 0.5],
        wait_motion: Promise.resolve(),
        animations: []
      },
      internalModel: {
        coreModel: { setParameterValueById: mouthParameter },
        motionManager: { attachAnalyzer },
        parallelMotionManager: []
      },
      removeFromParent: vi.fn(),
      stopSpeaking
    } as unknown as Live2D["structure"]["live2d"]["children"][number];
    const live2d = createLive2DLayer(model);
    const analyzer = {
      fftSize: 0,
      minDecibels: 0,
      maxDecibels: 0,
      smoothingTimeConstant: 0,
      connect: vi.fn(),
      disconnect: vi.fn()
    };
    const masterGain = { connect: vi.fn(), disconnect: vi.fn() };
    const createAnalyser = vi.fn(() => analyzer);
    Object.assign(Howler, {
      ctx: { createAnalyser },
      masterGain
    });
    const gain = { connect: vi.fn(), disconnect: vi.fn() };
    const sound = Object.assign(createSound(), { _sounds: [{ _node: gain }] }) as unknown as Howl;

    live2d.speak(["costume-a"], sound, 0.65);

    expect(createAnalyser).toHaveBeenCalledOnce();
    expect(gain.connect).toHaveBeenCalledWith(analyzer);
    expect(analyzer.connect).toHaveBeenCalledWith(masterGain);
    expect(attachAnalyzer).toHaveBeenCalledWith(analyzer);
    expect(sound.volume).toHaveBeenCalledWith(0.65);
    expect(sound.play).toHaveBeenCalledOnce();
    expect(mouthParameter).toHaveBeenCalledWith("ParamMouthOpenY", 0, 1);
    expect(model.live2DInfo.speaking).toBe(true);

    live2d.stop_speaking();

    expect(analyzer.disconnect).toHaveBeenCalled();
    expect(sound.off).toHaveBeenCalledWith("end");
    expect(gain.disconnect).toHaveBeenCalled();
    expect(sound.stop).toHaveBeenCalledOnce();
    expect(stopSpeaking).toHaveBeenCalledOnce();
    expect(model.live2DInfo.speaking).toBe(false);
    expect(live2d.current_sound).toBeUndefined();
  });

  it("uses the injected lip-sync connection and audio operations", () => {
    const mouthParameter = vi.fn();
    const attachAnalyzer = vi.fn();
    const stopSpeaking = vi.fn();
    const model = {
      visible: false,
      live2DInfo: {
        costume: "costume-a",
        speaking: false,
        t_pose: true,
        hidden: true,
        position: [0.5, 0.5],
        wait_motion: Promise.resolve(),
        animations: []
      },
      internalModel: {
        coreModel: { setParameterValueById: mouthParameter },
        motionManager: { attachAnalyzer },
        parallelMotionManager: []
      },
      removeFromParent: vi.fn(),
      stopSpeaking
    } as unknown as Live2D["structure"]["live2d"]["children"][number];
    const analyser = {} as AnalyserNode;
    const connection = {
      analyser,
      disconnect: vi.fn()
    } satisfies PixiStoryLipSyncConnection;
    const audioAdapter = createAudioAdapter(connection);
    const sound = createSound() as unknown as Howl;
    const live2d = createLive2DLayer(model, audioAdapter);

    live2d.speak(["costume-a"], sound, 0.65);

    expect(audioAdapter.connectLipSync).toHaveBeenCalledWith(sound);
    expect(attachAnalyzer).toHaveBeenCalledWith(analyser);
    expect(audioAdapter.setVolume).toHaveBeenCalledWith(sound, 0.65);
    expect(audioAdapter.play).toHaveBeenCalledWith(sound);
    expect(mouthParameter).toHaveBeenCalledWith("ParamMouthOpenY", 0, 1);

    live2d.stop_speaking();

    expect(connection.disconnect).toHaveBeenCalledOnce();
    expect(audioAdapter.off).toHaveBeenCalledWith(sound, "end");
    expect(audioAdapter.stop).toHaveBeenCalledWith(sound);
    expect(stopSpeaking).toHaveBeenCalledOnce();
  });

  it("resets ParamMouthOpenY before applying an expression motion", async () => {
    const mouthParameter = vi.fn();
    const bodyManager = {
      startMotion: vi.fn(async () => true),
      destroyed: false,
      isFinished: vi.fn(() => true)
    };
    const faceManager = {
      startMotion: vi.fn(async () => true),
      destroyed: false,
      isFinished: vi.fn(() => true)
    };
    const model = {
      visible: false,
      live2DInfo: {
        costume: "costume-a",
        speaking: false,
        t_pose: true,
        hidden: true,
        position: [0.5, 0.5],
        wait_motion: Promise.resolve(),
        animations: []
      },
      internalModel: {
        coreModel: { setParameterValueById: mouthParameter },
        motionManager: { attachAnalyzer: vi.fn() },
        parallelMotionManager: [bodyManager, faceManager]
      }
    } as unknown as Live2D["structure"]["live2d"]["children"][number];
    const live2d = createLive2DLayer(model);
    const wrapper = vi.fn(async () => {});
    Object.assign(live2d, { animation_controller: { wrapper } });

    await live2d.update_motion("Expression", "costume-a", 2, true);

    expect(mouthParameter).toHaveBeenCalledWith("ParamMouthOpenY", 0, 1);
    expect(faceManager.startMotion).toHaveBeenCalledWith("Expression", 2, 3, true);
    expect(bodyManager.startMotion).not.toHaveBeenCalled();
    expect(wrapper).toHaveBeenCalledOnce();
  });
});

function createLive2DLayer(
  model: Live2D["structure"]["live2d"]["children"][number],
  audioAdapter?: PixiStoryAudioAdapter
): Live2D {
  const live2d = new Live2D({
    stage_size: [1280, 720],
    ...(audioAdapter ? { audioAdapter } : {})
  });
  live2d.structure.live2d.addChild(model);
  return live2d;
}
