import { afterEach, describe, expect, it, vi } from "vitest";

const pixi = vi.hoisted(() => {
  class ColorMatrixFilter {
    saturate = vi.fn();
  }

  return {
    ColorMatrixFilter,
    DisplayObject: class {},
    Texture: class {}
  };
});

vi.mock("pixi.js", () => pixi);

import type { Live2DController } from "../Live2DController.js";
import {
  SeAttachCharacterShaderType,
  SnippetAction,
  SnippetProgressBehavior,
  SpecialEffectType
} from "../../../model/scenario-types.js";
import { Live2DAssetType } from "../player-types.js";
import single_action from "./index.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const createController = (
  options: {
    effect?: SpecialEffectType;
    stringVal?: string;
    stringValSub?: string;
    duration?: number;
    intVal?: number;
    progressBehavior?: SnippetProgressBehavior;
    replaySilent?: boolean;
    textAnimation?: boolean;
  } = {}
) => {
  const detail = {
    EffectType: options.effect ?? SpecialEffectType.WhiteIn,
    StringVal: options.stringVal ?? "",
    StringValSub: options.stringValSub ?? "",
    Duration: options.duration ?? 1.25,
    IntVal: options.intVal ?? 42
  };
  const action = {
    Action: SnippetAction.SpecialEffect,
    ProgressBehavior: options.progressBehavior ?? SnippetProgressBehavior.WaitUnitilFinished,
    ReferenceIndex: 0,
    Delay: 0
  };
  const logger = { log: vi.fn(), warn: vi.fn() };
  const events = { emit: vi.fn() };
  const layers = {
    telop: {
      hide: vi.fn(async () => {}),
      draw: vi.fn(),
      show: vi.fn(async () => {})
    },
    dialog: {
      hide: vi.fn(async () => {}),
      draw: vi.fn(),
      animate: vi.fn(async () => {}),
      show: vi.fn(async () => {}),
      shake: vi.fn(async (...args: unknown[]) => {
        void args;
      }),
      stop_shake: vi.fn()
    },
    fullcolor: {
      draw: vi.fn(),
      show: vi.fn(async () => {}),
      hide: vi.fn(async () => {})
    },
    fullscreen_text: {
      show: vi.fn(async () => {}),
      hide: vi.fn(async () => {}),
      draw: vi.fn(),
      animate: vi.fn(async () => {})
    },
    flashback_filter: {
      draw: vi.fn(),
      show: vi.fn(async () => {}),
      hide: vi.fn(async () => {})
    },
    background: {
      draw: vi.fn(),
      shake: vi.fn(async (...args: unknown[]) => {
        void args;
      }),
      stop_shake: vi.fn(),
      add_blur: vi.fn(),
      remove_blur: vi.fn(),
      remove_filter: vi.fn(),
      add_filter: vi.fn(),
      add_color_filter: vi.fn()
    },
    live2d: {
      shake: vi.fn(async (...args: unknown[]) => {
        void args;
      }),
      stop_shake: vi.fn(),
      remove_filter: vi.fn(),
      add_filter: vi.fn(),
      add_color_filter: vi.fn(),
      add_effect: vi.fn(),
      remove_effect: vi.fn()
    },
    wipe: {
      draw: vi.fn(async () => {}),
      animate: vi.fn(async () => {})
    },
    sekai: { draw: vi.fn(async () => {}) },
    place_info: {
      draw: vi.fn(),
      show: vi.fn(async () => {}),
      hide: vi.fn(async () => {})
    },
    scene_effect: { draw: vi.fn(), remove: vi.fn() },
    movie: {
      draw: vi.fn(async () => {}),
      waitForCompletion: vi.fn(async () => {}),
      clear: vi.fn()
    }
  };
  const audioAdapter = { setVolume: vi.fn(), play: vi.fn() };
  const setStyle = vi.fn();
  const progressWrapper = vi.fn(async (apply: (progress: number) => void, duration: number) => {
    void duration;
    apply(0);
    apply(0.5);
    apply(1);
  });
  const controller = {
    scenarioData: { SpecialEffectData: [detail] },
    scenarioResource: { image: [], audio: [], video: [] },
    layers,
    logger,
    events,
    stage_size: [1000, 500],
    camera: { position: [0.2, 0.4], scale: [1, 1] },
    animate: { progress_wrapper: progressWrapper },
    set_style: setStyle,
    replay_silent: options.replaySilent ?? false,
    settings: { voice_volume: 0.8, text_animation: options.textAnimation ?? true },
    audioAdapter,
    stop_sounds: vi.fn(),
    resolveText: vi.fn((_scope: string, _index: number, text: string) => ({
      displayText: `display:${text}`,
      translatedText: `translated:${text}`
    })),
    current_costume: [] as { cid: number; animations?: string[] }[],
    live2d_get_costume: vi.fn((cid: number) => `costume-${cid}`)
  } as unknown as Live2DController;

  return {
    action,
    audioAdapter,
    controller,
    detail,
    events,
    layers,
    logger,
    progressWrapper,
    setStyle
  };
};

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("special-effect dispatch and transitions", () => {
  it("clears the telop first and awaits a Now effect's asynchronous transition", async () => {
    const { action, controller, layers } = createController({
      effect: SpecialEffectType.WhiteIn,
      duration: 2.5,
      progressBehavior: SnippetProgressBehavior.Now
    });
    const clear = deferred<void>();
    const transition = deferred<void>();
    layers.telop.hide.mockReturnValueOnce(clear.promise);
    layers.fullcolor.hide.mockReturnValueOnce(transition.promise);

    let completed = false;
    const dispatch = single_action(controller, action).then(() => {
      completed = true;
    });

    expect(layers.telop.hide).toHaveBeenCalledWith(200);
    expect(layers.fullcolor.draw).not.toHaveBeenCalled();
    clear.resolve();
    await vi.waitFor(() => expect(layers.fullcolor.hide).toHaveBeenCalledWith(2500, true));
    expect(layers.fullcolor.draw).toHaveBeenCalledWith(0xffffff);
    expect(completed).toBe(false);

    transition.resolve();
    await dispatch;
    expect(completed).toBe(true);
  });

  it.each([
    [SpecialEffectType.BlackWipeInLeft, false, "right"],
    [SpecialEffectType.BlackWipeInRight, false, "left"],
    [SpecialEffectType.BlackWipeInTop, false, "bottom"],
    [SpecialEffectType.BlackWipeInBottom, false, "top"],
    [SpecialEffectType.BlackWipeOutLeft, true, "left"],
    [SpecialEffectType.BlackWipeOutRight, true, "right"],
    [SpecialEffectType.BlackWipeOutTop, true, "top"],
    [SpecialEffectType.BlackWipeOutBottom, true, "bottom"]
  ] as const)(
    "maps wipe effect %s to its direction and visibility",
    async (effect, show, direction) => {
      const { action, controller, layers } = createController({ effect, duration: 0.75 });

      await single_action(controller, action);

      expect(layers.telop.hide).toHaveBeenCalledBefore(layers.wipe.draw);
      expect(layers.wipe.draw).toHaveBeenCalledOnce();
      expect(layers.wipe.animate).toHaveBeenCalledWith(show, direction, 750);
    }
  );

  it.each([
    [SpecialEffectType.WhiteIn, 0xffffff, "hide", true, false],
    [SpecialEffectType.WhiteOut, 0xffffff, "show", true, true],
    [SpecialEffectType.BlackIn, 0x000000, "hide", false, false],
    [SpecialEffectType.BlackOut, 0x000000, "show", true, true]
  ] as const)(
    "applies transition %s with its matching overlay and force flag",
    async (effect, color, method, force, hidesDialog) => {
      const { action, controller, layers } = createController({ effect, duration: 1.5 });

      await single_action(controller, action);

      expect(layers.fullcolor.draw).toHaveBeenCalledWith(color);
      expect(layers.fullcolor[method]).toHaveBeenCalledWith(1500, force);
      if (hidesDialog) expect(layers.dialog.hide).toHaveBeenCalledWith(100);
      else expect(layers.dialog.hide).not.toHaveBeenCalled();
      if (effect === SpecialEffectType.BlackIn)
        expect(layers.fullscreen_text.hide).toHaveBeenCalledWith(100);
    }
  );

  it("translates camera coordinates and applies each interpolation frame", async () => {
    const { action, controller, progressWrapper, setStyle } = createController({
      effect: SpecialEffectType.ChangeCameraPosition,
      stringVal: "960,540",
      duration: 1.5
    });

    await single_action(controller, action);

    expect(progressWrapper).toHaveBeenCalledWith(expect.any(Function), 1500);
    expect(controller.camera.position).toEqual([0.5, 0.5]);
    expect(setStyle).toHaveBeenCalledTimes(3);
  });

  it("zooms both camera axes to the requested level", async () => {
    const { action, controller, progressWrapper, setStyle } = createController({
      effect: SpecialEffectType.ChangeCameraZoomLevel,
      stringVal: "1.6",
      duration: 0.8
    });

    await single_action(controller, action);

    expect(progressWrapper).toHaveBeenCalledWith(expect.any(Function), 800);
    expect(controller.camera.scale).toEqual([1.6, 1.6]);
    expect(setStyle).toHaveBeenCalledTimes(3);
  });

  it("attaches and clears flashback filters with the documented opacity", async () => {
    const entering = createController({ effect: SpecialEffectType.FlashbackIn });
    await single_action(entering.controller, entering.action);
    expect(entering.layers.flashback_filter.draw).toHaveBeenCalledWith(0x000000, 0.3);
    expect(entering.layers.flashback_filter.show).toHaveBeenCalledWith(100, true);

    const leaving = createController({ effect: SpecialEffectType.FlashbackOut });
    await single_action(leaving.controller, leaving.action);
    expect(leaving.layers.flashback_filter.hide).toHaveBeenCalledWith(100, true);
  });

  it("applies memory filters to both scene layers and removes them on MemoryOut", async () => {
    const entering = createController({ effect: SpecialEffectType.MemoryIn });
    await single_action(entering.controller, entering.action);

    expect(entering.layers.live2d.remove_filter).toHaveBeenCalledOnce();
    expect(entering.layers.background.remove_filter).toHaveBeenCalledOnce();
    expect(entering.layers.live2d.add_color_filter).toHaveBeenCalledWith(
      [0.8, 0, 0, 0, 0],
      [0, 0.8, 0, 0, 0],
      [0, 0, 0.5, 0, 0],
      [0, 0, 0, 1, 0]
    );
    expect(entering.layers.background.add_color_filter).toHaveBeenCalledWith(
      [0.8, 0, 0, 0, 0],
      [0, 0.8, 0, 0, 0],
      [0, 0, 0.5, 0, 0],
      [0, 0, 0, 1, 0]
    );
    expect(entering.layers.live2d.add_filter.mock.calls[0]?.[0]).toBe(
      entering.layers.background.add_filter.mock.calls[0]?.[0]
    );

    const leaving = createController({ effect: SpecialEffectType.MemoryOut });
    await single_action(leaving.controller, leaving.action);
    expect(leaving.layers.live2d.remove_filter).toHaveBeenCalledOnce();
    expect(leaving.layers.background.remove_filter).toHaveBeenCalledOnce();
  });

  it.each([
    [SpecialEffectType.AmbientColorNormal, null],
    [SpecialEffectType.AmbientColorEvening, [0.9, 0, 0, 0, 0]],
    [SpecialEffectType.AmbientColorNight, [0.85, 0, 0, 0, 0]]
  ] as const)("updates live2d ambient filters for effect %s", async (effect, redChannel) => {
    const { action, controller, layers } = createController({ effect });

    await single_action(controller, action);

    expect(layers.live2d.remove_filter).toHaveBeenCalledOnce();
    if (redChannel) {
      expect(layers.live2d.add_color_filter).toHaveBeenCalledWith(
        redChannel,
        effect === SpecialEffectType.AmbientColorEvening ? [0, 0.9, 0, 0, 0] : [0, 0.85, 0, 0, 0],
        effect === SpecialEffectType.AmbientColorEvening ? [0, 0, 0.8, 0, 0] : [0, 0, 0.9, 0, 0],
        [0, 0, 0, 1, 0]
      );
      expect(layers.live2d.add_filter).toHaveBeenCalledOnce();
      expect(layers.live2d.add_filter.mock.calls[0]?.[0]).toBeInstanceOf(pixi.ColorMatrixFilter);
    } else {
      expect(layers.live2d.add_color_filter).not.toHaveBeenCalled();
      expect(layers.live2d.add_filter).not.toHaveBeenCalled();
    }
  });

  it("routes screen and window shakes to their matching layers and stops only those shakes", async () => {
    const screen = createController({ effect: SpecialEffectType.ShakeScreen, duration: 0.5 });
    await single_action(screen.controller, screen.action);
    expect(screen.layers.background.shake).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      500
    );
    expect(screen.layers.live2d.shake).toHaveBeenCalledWith(
      screen.layers.background.shake.mock.calls[0]?.[0],
      screen.layers.background.shake.mock.calls[0]?.[1],
      500
    );
    expect(screen.layers.dialog.shake).not.toHaveBeenCalled();

    const stopScreen = createController({ effect: SpecialEffectType.StopShakeScreen });
    await single_action(stopScreen.controller, stopScreen.action);
    expect(stopScreen.layers.background.stop_shake).toHaveBeenCalledOnce();
    expect(stopScreen.layers.live2d.stop_shake).toHaveBeenCalledOnce();

    const window = createController({ effect: SpecialEffectType.ShakeWindow, duration: 0.25 });
    await single_action(window.controller, window.action);
    expect(window.layers.dialog.shake).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      250
    );
    expect(window.layers.background.shake).not.toHaveBeenCalled();

    const stopWindow = createController({ effect: SpecialEffectType.StopShakeWindow });
    await single_action(stopWindow.controller, stopWindow.action);
    expect(stopWindow.layers.dialog.stop_shake).toHaveBeenCalledOnce();
  });

  it("resolves telop text before drawing, hiding dialogue, and showing the telop", async () => {
    const { action, controller, layers } = createController({
      effect: SpecialEffectType.Telop,
      stringVal: "Original"
    });

    await single_action(controller, action);

    expect(controller.resolveText).toHaveBeenCalledWith("telop", 0, "Original");
    expect(layers.telop.draw).toHaveBeenCalledWith("display:Original", "translated:Original");
    expect(layers.dialog.hide).toHaveBeenCalledWith(200);
    expect(layers.telop.show).toHaveBeenCalledWith(300, true);
  });

  it("shows a place label and hides it after five seconds", async () => {
    vi.useFakeTimers();
    const { action, controller, layers } = createController({
      effect: SpecialEffectType.PlaceInfo,
      stringVal: "School rooftop"
    });

    await single_action(controller, action);
    expect(layers.place_info.draw).toHaveBeenCalledWith("School rooftop");
    expect(layers.place_info.show).toHaveBeenCalledWith(300);
    expect(layers.place_info.hide).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(4999);
    expect(layers.place_info.hide).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(layers.place_info.hide).toHaveBeenCalledWith(200);
  });

  it("plays and stops a named scene effect through the layer API", async () => {
    const play = createController({
      effect: SpecialEffectType.PlayScenarioEffect,
      stringVal: "line_legend_02"
    });
    await single_action(play.controller, play.action);
    expect(play.layers.scene_effect.draw).toHaveBeenCalledWith("line_legend_02", play.events);

    const stop = createController({
      effect: SpecialEffectType.StopScenarioEffect,
      stringVal: "line_legend_02"
    });
    await single_action(stop.controller, stop.action);
    expect(stop.layers.scene_effect.remove).toHaveBeenCalledWith("line_legend_02");
  });

  it.each([
    ["true", true],
    ["false", false]
  ] as const)(
    "maps Blur StringVal %s to the matching background filter operation",
    async (stringVal, shouldBlur) => {
      const { action, controller, layers } = createController({
        effect: SpecialEffectType.Blur,
        stringVal
      });

      await single_action(controller, action);

      if (shouldBlur) expect(layers.background.add_blur).toHaveBeenCalledWith(1.5);
      else expect(layers.background.remove_blur).toHaveBeenCalledOnce();
    }
  );

  it("dims and blurs the background for fullscreen text, then restores it", async () => {
    const showing = createController({ effect: SpecialEffectType.FullScreenTextShow });
    await single_action(showing.controller, showing.action);
    expect(showing.layers.background.add_blur).toHaveBeenCalledWith(6);
    expect(showing.layers.background.add_color_filter).toHaveBeenCalledWith(
      [0.6, 0, 0, 0, 0],
      [0, 0.6, 0, 0, 0],
      [0, 0, 0.6, 0, 0],
      [0, 0, 0, 1, 0]
    );

    const hiding = createController({
      effect: SpecialEffectType.FullScreenTextHide,
      duration: 0.7
    });
    await single_action(hiding.controller, hiding.action);
    expect(hiding.layers.background.remove_blur).toHaveBeenCalledOnce();
    expect(hiding.layers.background.remove_filter).toHaveBeenCalledOnce();
    expect(hiding.layers.fullscreen_text.hide).toHaveBeenCalledWith(700, true);
  });

  it("uses scene transition direction and duration for Sekai in/out effects", async () => {
    const cases = [
      [SpecialEffectType.SekaiIn, "in_corner", false],
      [SpecialEffectType.SekaiOut, "out_corner", true],
      [SpecialEffectType.SekaiInCenter, "in_center", false],
      [SpecialEffectType.SekaiOutCenter, "out_center", true]
    ] as const;

    for (const [effect, condition, isOut] of cases) {
      const { action, controller, layers } = createController({ effect, duration: 0.6 });
      await single_action(controller, action);
      expect(layers.sekai.draw).toHaveBeenCalledWith(condition, 600);
      if (effect === SpecialEffectType.SekaiIn || effect === SpecialEffectType.SekaiInCenter)
        expect(layers.fullcolor.hide).toHaveBeenCalledWith(600);
      if (isOut) expect(layers.fullcolor.draw).toHaveBeenCalledWith(0xffffff);
    }
  });

  it("attaches, removes, and warns for character shaders", async () => {
    const entering = createController({
      effect: SpecialEffectType.AttachCharacterShader,
      stringVal: SeAttachCharacterShaderType.Hologram
    });
    entering.controller.current_costume = [
      { cid: 42, costume: "costume-42", motion: "", expression: "", appear_time: 0, animations: [] }
    ];
    await single_action(entering.controller, entering.action);
    expect(entering.controller.live2d_get_costume).toHaveBeenCalledWith(42);
    expect(entering.layers.live2d.add_effect).toHaveBeenCalledWith("costume-42", "hologram");
    expect(entering.controller.current_costume[0]?.animations).toEqual(["hologram"]);

    const leaving = createController({
      effect: SpecialEffectType.AttachCharacterShader,
      stringVal: SeAttachCharacterShaderType.None
    });
    leaving.controller.current_costume = [
      {
        cid: 42,
        costume: "costume-42",
        motion: "",
        expression: "",
        appear_time: 0,
        animations: ["hologram", "other"]
      }
    ];
    await single_action(leaving.controller, leaving.action);
    expect(leaving.layers.live2d.remove_effect).toHaveBeenCalledWith("costume-42", "hologram");
    expect(leaving.controller.current_costume[0]?.animations).toEqual([]);

    const unsupported = createController({
      effect: SpecialEffectType.AttachCharacterShader,
      stringVal: SeAttachCharacterShaderType.Monitor
    });
    await single_action(unsupported.controller, unsupported.action);
    expect(unsupported.logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "SpecialEffect/AttachCharacterShader/monitor not implemented!",
      unsupported.action,
      unsupported.detail
    );
    expect(unsupported.events.emit).toHaveBeenCalledWith(
      "warn",
      "SpecialEffect/AttachCharacterShader/monitor not implemented!"
    );
  });

  it("emits parsed selectable choices but suppresses them for silent replay", async () => {
    const normal = createController({
      effect: SpecialEffectType.SimpleSelectable,
      stringVal: "『Yes』 / 『No』"
    });
    await single_action(normal.controller, normal.action);
    expect(normal.events.emit).toHaveBeenCalledWith("selectable", ["Yes", "No"]);

    const silent = createController({
      effect: SpecialEffectType.SimpleSelectable,
      stringVal: "『Yes』/『No』",
      replaySilent: true
    });
    await single_action(silent.controller, silent.action);
    expect(silent.events.emit).not.toHaveBeenCalled();
  });

  it("plays fullscreen text with resolved translation and handles silent or missing audio", async () => {
    const playing = createController({
      effect: SpecialEffectType.FullScreenText,
      stringVal: "Narration",
      stringValSub: "voice-1"
    });
    const voice = { identifier: "voice-1", type: Live2DAssetType.Talk, data: {} };
    (playing.controller.scenarioResource.audio as unknown[]).push(voice);
    await single_action(playing.controller, playing.action);
    expect(playing.controller.stop_sounds).toHaveBeenCalledWith([Live2DAssetType.Talk]);
    expect(playing.audioAdapter.setVolume).toHaveBeenCalledWith(voice.data, 0.8);
    expect(playing.audioAdapter.play).toHaveBeenCalledWith(voice.data);
    expect(playing.layers.fullscreen_text.animate).toHaveBeenCalledWith(
      "display:Narration",
      "translated:Narration"
    );

    const silent = createController({
      effect: SpecialEffectType.FullScreenText,
      stringVal: "Silent narration",
      stringValSub: "voice-2",
      replaySilent: true,
      textAnimation: false
    });
    (silent.controller.scenarioResource.audio as unknown[]).push({
      identifier: "voice-2",
      type: Live2DAssetType.Talk,
      data: {}
    });
    await single_action(silent.controller, silent.action);
    expect(silent.audioAdapter.play).not.toHaveBeenCalled();
    expect(silent.layers.fullscreen_text.draw).toHaveBeenCalledWith(
      "display:Silent narration",
      "translated:Silent narration"
    );

    const missing = createController({
      effect: SpecialEffectType.FullScreenText,
      stringVal: "Still shown",
      stringValSub: "missing-voice"
    });
    await single_action(missing.controller, missing.action);
    expect(missing.events.emit).toHaveBeenCalledWith("warn", "missing-voice not loaded, skip.");
    expect(missing.layers.fullscreen_text.animate).toHaveBeenCalled();
  });

  it("plays movies, clears their layer, and warns for missing or failed resources", async () => {
    const missing = createController({ effect: SpecialEffectType.Movie, stringVal: "movie-1" });
    await single_action(missing.controller, missing.action);
    expect(missing.events.emit).toHaveBeenCalledWith("warn", "movie-1 not loaded, skip.");
    expect(missing.layers.movie.clear).not.toHaveBeenCalled();

    const success = createController({ effect: SpecialEffectType.Movie, stringVal: "movie-2" });
    const movie = { identifier: "movie-2", type: Live2DAssetType.Video, data: {} };
    (success.controller.scenarioResource.video as unknown[]).push(movie);
    await single_action(success.controller, success.action);
    expect(success.layers.movie.draw).toHaveBeenCalledWith(movie.data);
    expect(success.layers.movie.waitForCompletion).toHaveBeenCalledOnce();
    expect(success.layers.movie.clear).toHaveBeenCalledOnce();

    const failed = createController({ effect: SpecialEffectType.Movie, stringVal: "movie-3" });
    (failed.controller.scenarioResource.video as unknown[]).push({
      identifier: "movie-3",
      type: Live2DAssetType.Video,
      data: {}
    });
    failed.layers.movie.draw.mockRejectedValueOnce(new Error("decode failed"));
    await single_action(failed.controller, failed.action);
    expect(failed.events.emit).toHaveBeenCalledWith(
      "warn",
      "Failed to play movie movie-3: Error: decode failed"
    );
    expect(failed.layers.movie.clear).toHaveBeenCalledOnce();
  });

  it("selects a matching background image and skips unavailable assets", async () => {
    const loaded = createController({
      effect: SpecialEffectType.ChangeBackground,
      stringValSub: "bg-1"
    });
    const image = { identifier: "bg-1", type: Live2DAssetType.BackgroundImage, data: {} };
    (loaded.controller.scenarioResource.image as unknown[]).push(image);
    await single_action(loaded.controller, loaded.action);
    expect(loaded.layers.dialog.hide).toHaveBeenCalledWith(200);
    expect(loaded.layers.background.draw).toHaveBeenCalledWith(image.data);

    const missing = createController({
      effect: SpecialEffectType.ChangeBackground,
      stringValSub: "not-loaded"
    });
    await single_action(missing.controller, missing.action);
    expect(missing.layers.background.draw).not.toHaveBeenCalled();
  });

  it("reports unknown effect types and unsupported top-level actions", async () => {
    const unknownEffect = createController({ effect: SpecialEffectType.None });
    await single_action(unknownEffect.controller, unknownEffect.action);
    expect(unknownEffect.logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "SpecialEffect/None not implemented!",
      unknownEffect.action,
      unknownEffect.detail
    );
    expect(unknownEffect.events.emit).toHaveBeenCalledWith(
      "warn",
      "SpecialEffect/None not implemented!"
    );

    const unknownAction = createController();
    await single_action(unknownAction.controller, {
      ...unknownAction.action,
      Action: SnippetAction.None
    });
    expect(unknownAction.logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      "None not implemented!",
      expect.objectContaining({ Action: SnippetAction.None })
    );
    expect(unknownAction.events.emit).toHaveBeenCalledWith("warn", "None not implemented!");
  });
});
