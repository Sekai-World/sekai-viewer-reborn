import { afterEach, describe, expect, it, vi } from "vitest";
import type { Live2DController } from "../../Live2DController.js";
import {
  SnippetAction,
  SnippetProgressBehavior,
  SpecialEffectType
} from "../../../../model/scenario-types.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import { Live2DAssetType } from "../../player-types.js";
import ChangeBackground from "./ChangeBackground.js";
import ChangeCameraZoomLevel from "./ChangeCameraZoomLevel.js";
import FullScreenText from "./FullScreenText.js";
import PlaceInfo from "./PlaceInfo.js";
import PlayScenarioEffect from "./PlayScenarioEffect.js";
import SekaiIn from "./SekaiIn.js";
import SekaiInCenter from "./SekaiInCenter.js";
import SekaiOut from "./SekaiOut.js";
import SekaiOutCenter from "./SekaiOutCenter.js";
import ShakeScreen from "./ShakeScreen.js";
import ShakeWindow from "./ShakeWindow.js";
import Telop from "./Telop.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const createController = (
  options: {
    effect?: SpecialEffectType;
    stringVal?: string;
    stringValSub?: string;
    duration?: number;
  } = {}
) => {
  const detail = {
    EffectType: options.effect ?? SpecialEffectType.ChangeBackground,
    StringVal: options.stringVal ?? "",
    StringValSub: options.stringValSub ?? "",
    Duration: options.duration ?? 0.6,
    IntVal: 0
  };
  const action: Snippet = {
    Action: SnippetAction.SpecialEffect,
    ProgressBehavior: SnippetProgressBehavior.WaitUnitilFinished,
    ReferenceIndex: 0,
    Delay: 0
  };
  const events = { emit: vi.fn() };
  const logger = { log: vi.fn(), warn: vi.fn() };
  const layers = {
    background: {
      draw: vi.fn(async () => {}),
      shake: vi.fn(async (...args: unknown[]) => {
        void args;
      })
    },
    dialog: {
      hide: vi.fn(async () => {}),
      shake: vi.fn(async () => {})
    },
    fullcolor: {
      draw: vi.fn(async () => {}),
      hide: vi.fn(async () => {}),
      show: vi.fn(async () => {})
    },
    fullscreen_text: {
      show: vi.fn(async () => {}),
      draw: vi.fn(async () => {}),
      animate: vi.fn(async () => {})
    },
    live2d: {
      shake: vi.fn(async (...args: unknown[]) => {
        void args;
      })
    },
    place_info: {
      draw: vi.fn(async () => {}),
      show: vi.fn(async () => {}),
      hide: vi.fn(async () => {})
    },
    scene_effect: { draw: vi.fn(async () => {}) },
    sekai: { draw: vi.fn(async () => {}) },
    telop: {
      draw: vi.fn(async () => {}),
      show: vi.fn(async () => {})
    }
  };
  const progressWrapper = vi.fn(async (apply: (progress: number) => void) => {
    apply(0);
    apply(1);
  });
  const controller = {
    scenarioData: { SpecialEffectData: [detail] },
    scenarioResource: { image: [], audio: [], video: [] },
    layers,
    logger,
    events,
    stage_size: [1000, 500],
    camera: { scale: [1, 1] },
    animate: { progress_wrapper: progressWrapper },
    replay_silent: false,
    settings: { voice_volume: 0.8, text_animation: true },
    audioAdapter: { setVolume: vi.fn(), play: vi.fn() },
    stop_sounds: vi.fn(),
    resolveText: vi.fn((_scope: string, _index: number, text: string) => ({
      displayText: `display:${text}`,
      translatedText: `translated:${text}`
    }))
  } as unknown as Live2DController;

  return { action, controller, detail, events, layers, logger, progressWrapper };
};

describe("special-effect async scene lifecycles", () => {
  it("starts background replacement alongside the dialog fade without awaiting either", async () => {
    const { action, controller, events, layers, logger } = createController();
    const fade = deferred<void>();
    const draw = deferred<void>();
    const order: string[] = [];
    layers.dialog.hide.mockImplementation(() => {
      order.push("dialog.hide");
      return fade.promise;
    });
    layers.background.draw.mockImplementation(() => {
      order.push("background.draw");
      return draw.promise;
    });
    (controller.scenarioResource.image as unknown[]).push({
      identifier: "bg-1",
      type: Live2DAssetType.BackgroundImage,
      data: {} as HTMLImageElement
    });
    controller.scenarioData.SpecialEffectData[0]!.StringValSub = "bg-1";

    let completed = false;
    const running = ChangeBackground(controller, action).then(() => {
      completed = true;
    });

    expect(order).toEqual(["dialog.hide", "background.draw"]);
    await running;
    expect(completed).toBe(true);

    const failure = new Error("fade failed");
    fade.reject(failure);
    const drawFailure = new Error("draw failed");
    draw.reject(drawFailure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("ChangeBackground dialog hide failed"),
        action,
        failure
      );
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("ChangeBackground background draw failed"),
        action,
        drawFailure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("keeps zoom interpolation non-blocking and reports its rejection", async () => {
    const { action, controller, events, progressWrapper } = createController({
      effect: SpecialEffectType.ChangeCameraZoomLevel,
      stringVal: "1.5"
    });
    const animation = deferred<void>();
    progressWrapper.mockReturnValueOnce(animation.promise);

    let completed = false;
    const running = ChangeCameraZoomLevel(controller, action).then(() => {
      completed = true;
    });

    expect(progressWrapper).toHaveBeenCalledWith(expect.any(Function), 600);
    await running;
    expect(completed).toBe(true);

    const failure = new Error("zoom failed");
    animation.reject(failure);
    await vi.waitFor(() => {
      expect(controller.logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("ChangeCameraZoomLevel failed"),
        action,
        failure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
  });

  const sceneTransitions: {
    name: string;
    run: (controller: Live2DController, action: Snippet) => Promise<void>;
    condition: "in_corner" | "out_corner" | "in_center" | "out_center";
    overlay: "hide" | "show";
    hasDialogFade: boolean;
    drawsCover: boolean;
  }[] = [
    {
      name: "SekaiIn",
      run: SekaiIn,
      condition: "in_corner",
      overlay: "hide",
      hasDialogFade: true,
      drawsCover: false
    },
    {
      name: "SekaiOut",
      run: SekaiOut,
      condition: "out_corner",
      overlay: "show",
      hasDialogFade: true,
      drawsCover: true
    },
    {
      name: "SekaiInCenter",
      run: SekaiInCenter,
      condition: "in_center",
      overlay: "hide",
      hasDialogFade: false,
      drawsCover: false
    },
    {
      name: "SekaiOutCenter",
      run: SekaiOutCenter,
      condition: "out_center",
      overlay: "show",
      hasDialogFade: false,
      drawsCover: true
    }
  ];

  it.each(sceneTransitions)(
    "$name starts the overlay and Sekai transitions together but waits only for Sekai",
    async ({ run, condition, overlay, hasDialogFade, drawsCover }) => {
      const { action, controller, layers } = createController();
      const overlayTransition = deferred<void>();
      const sekaiTransition = deferred<void>();
      const order: string[] = [];
      layers.fullcolor[overlay].mockImplementationOnce(() => {
        order.push(`fullcolor.${overlay}`);
        return overlayTransition.promise;
      });
      layers.fullcolor.draw.mockImplementationOnce(async () => {
        order.push("fullcolor.draw");
      });
      layers.sekai.draw.mockImplementationOnce(() => {
        order.push("sekai.draw");
        return sekaiTransition.promise;
      });
      if (hasDialogFade) {
        layers.dialog.hide.mockImplementationOnce(async () => {
          order.push("dialog.hide");
        });
      }

      let completed = false;
      const running = run(controller, action).then(() => {
        completed = true;
      });

      expect(order).toEqual(
        drawsCover
          ? [
              ...(hasDialogFade ? ["dialog.hide"] : []),
              "fullcolor.draw",
              "fullcolor.show",
              "sekai.draw"
            ]
          : ["fullcolor.hide", ...(hasDialogFade ? ["dialog.hide"] : []), "sekai.draw"]
      );
      expect(layers.sekai.draw).toHaveBeenCalledWith(condition, 600);
      if (drawsCover) expect(layers.fullcolor.draw).toHaveBeenCalledWith(0xffffff);
      expect(completed).toBe(false);

      sekaiTransition.resolve();
      await running;
      expect(completed).toBe(true);
      overlayTransition.resolve();
    }
  );

  it("reports a Sekai overlay rejection without blocking the scene transition", async () => {
    const { action, controller, events, layers, logger } = createController();
    const overlayTransition = deferred<void>();
    const sekaiTransition = deferred<void>();
    layers.fullcolor.hide.mockReturnValueOnce(overlayTransition.promise);
    layers.sekai.draw.mockReturnValueOnce(sekaiTransition.promise);

    let completed = false;
    const running = SekaiIn(controller, action).then(() => {
      completed = true;
    });

    const failure = new Error("overlay transition failed");
    overlayTransition.reject(failure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("SekaiIn fullcolor hide failed"),
        action,
        failure
      );
    });
    expect(completed).toBe(false);
    expect(events.emit).not.toHaveBeenCalled();

    sekaiTransition.resolve();
    await running;
    expect(completed).toBe(true);
  });

  const outgoingTransitions = [
    { name: "SekaiOut", run: SekaiOut, condition: "out_corner" as const },
    { name: "SekaiOutCenter", run: SekaiOutCenter, condition: "out_center" as const }
  ];

  it.each(outgoingTransitions)(
    "$name reports cover failures without waiting for them",
    async ({ run, condition }) => {
      const { action, controller, events, layers, logger } = createController();
      const coverDraw = deferred<void>();
      const coverShow = deferred<void>();
      const sekaiTransition = deferred<void>();
      layers.fullcolor.draw.mockReturnValueOnce(coverDraw.promise);
      layers.fullcolor.show.mockReturnValueOnce(coverShow.promise);
      layers.sekai.draw.mockReturnValueOnce(sekaiTransition.promise);

      let completed = false;
      const running = run(controller, action).then(() => {
        completed = true;
      });
      expect(layers.fullcolor.draw).toHaveBeenCalledWith(0xffffff);
      expect(layers.fullcolor.show).toHaveBeenCalledWith(600, true);
      expect(layers.sekai.draw).toHaveBeenCalledWith(condition, 600);

      const drawFailure = new Error("cover draw failed");
      const showFailure = new Error("cover show failed");
      coverDraw.reject(drawFailure);
      coverShow.reject(showFailure);
      await vi.waitFor(() => expect(logger.warn).toHaveBeenCalledTimes(2));
      expect(events.emit).not.toHaveBeenCalled();
      expect(completed).toBe(false);

      sekaiTransition.resolve();
      await running;
      expect(completed).toBe(true);
    }
  );

  it("starts fullscreen text fade with animation and handles fade failure separately", async () => {
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.FullScreenText,
      stringVal: "Narration"
    });
    (controller.scenarioResource.audio as unknown[]).push({
      identifier: "",
      type: Live2DAssetType.Talk,
      data: {}
    });
    const fade = deferred<void>();
    const animation = deferred<void>();
    const order: string[] = [];
    layers.fullscreen_text.show.mockImplementationOnce(() => {
      order.push("show");
      return fade.promise;
    });
    layers.fullscreen_text.animate.mockImplementationOnce(async () => {
      order.push("animate");
      return animation.promise;
    });

    let completed = false;
    const running = FullScreenText(controller, action).then(() => {
      completed = true;
    });

    expect(order).toEqual(["show", "animate"]);
    expect(completed).toBe(false);
    const failure = new Error("fade failed");
    fade.reject(failure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("FullScreenText show failed"),
        action,
        failure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
    expect(completed).toBe(false);
    animation.resolve();
    await running;
    expect(completed).toBe(true);
  });

  it("keeps static fullscreen drawing non-blocking and reports drawing failure", async () => {
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.FullScreenText,
      stringVal: "Narration"
    });
    (controller.scenarioResource.audio as unknown[]).push({
      identifier: "",
      type: Live2DAssetType.Talk,
      data: {}
    });
    controller.settings.text_animation = false;
    const draw = deferred<void>();
    layers.fullscreen_text.draw.mockReturnValueOnce(draw.promise);

    let completed = false;
    const running = FullScreenText(controller, action).then(() => {
      completed = true;
    });
    await running;
    expect(completed).toBe(true);
    expect(layers.fullscreen_text.show).toHaveBeenCalledWith(500);
    expect(layers.fullscreen_text.draw).toHaveBeenCalledWith(
      "display:Narration",
      "translated:Narration"
    );

    const failure = new Error("text draw failed");
    draw.reject(failure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("FullScreenText draw failed"),
        action,
        failure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("keeps consecutive place-info hides on independent non-blocking five-second timers", async () => {
    vi.useFakeTimers();
    const { action, controller, layers } = createController({
      effect: SpecialEffectType.PlaceInfo
    });

    await PlaceInfo(controller, action);
    expect(layers.place_info.hide).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3000);
    controller.scenarioData.SpecialEffectData[0]!.StringVal = "Second place";
    await PlaceInfo(controller, action);
    expect(layers.place_info.draw).toHaveBeenLastCalledWith("Second place");

    await vi.advanceTimersByTimeAsync(2000);
    expect(layers.place_info.hide).toHaveBeenCalledOnce();
    expect(layers.place_info.hide).toHaveBeenCalledWith(200);
    await vi.advanceTimersByTimeAsync(3000);
    expect(layers.place_info.hide).toHaveBeenCalledTimes(2);
  });

  it("keeps place-info drawing non-blocking while it awaits the show transition", async () => {
    vi.useFakeTimers();
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.PlaceInfo
    });
    const draw = deferred<void>();
    const show = deferred<void>();
    layers.place_info.draw.mockReturnValueOnce(draw.promise);
    layers.place_info.show.mockReturnValueOnce(show.promise);

    let completed = false;
    const running = PlaceInfo(controller, action).then(() => {
      completed = true;
    });

    expect(layers.place_info.draw).toHaveBeenCalledWith("");
    expect(layers.place_info.show).toHaveBeenCalledWith(300);
    expect(completed).toBe(false);
    show.resolve();
    await running;
    expect(completed).toBe(true);

    const failure = new Error("place draw failed");
    draw.reject(failure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("PlaceInfo draw failed"),
        action,
        failure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(5000);
    expect(layers.place_info.hide).toHaveBeenCalledOnce();
  });

  it("catches failures from the delayed place-info hide", async () => {
    vi.useFakeTimers();
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.PlaceInfo
    });
    const failure = new Error("layer destroyed");
    layers.place_info.hide.mockRejectedValueOnce(failure);

    await PlaceInfo(controller, action);
    await vi.advanceTimersByTimeAsync(5000);

    expect(logger.warn).toHaveBeenCalledWith(
      "Live2DController",
      expect.stringContaining("PlaceInfo hide failed"),
      action,
      failure
    );
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("does not block playback on shakes and reports each rejection immediately", async () => {
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.ShakeScreen,
      duration: 0.25
    });
    const background = deferred<void>();
    const live2d = deferred<void>();
    const order: string[] = [];
    layers.background.shake.mockImplementationOnce(() => {
      order.push("background.shake");
      return background.promise;
    });
    layers.live2d.shake.mockImplementationOnce(() => {
      order.push("live2d.shake");
      return live2d.promise;
    });

    await ShakeScreen(controller, action);
    expect(order).toEqual(["background.shake", "live2d.shake"]);
    expect(layers.background.shake).toHaveBeenCalledWith(expect.anything(), expect.anything(), 250);
    expect(layers.live2d.shake.mock.calls[0]?.[0]).toBe(layers.background.shake.mock.calls[0]?.[0]);

    const backgroundFailure = new Error("background shake failed");
    const live2dFailure = new Error("live2d shake failed");
    background.reject(backgroundFailure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("ShakeScreen failed"),
        action,
        backgroundFailure
      );
    });
    live2d.reject(live2dFailure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("ShakeScreen failed"),
        action,
        live2dFailure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("keeps the window shake fire-and-forget while reporting its failure", async () => {
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.ShakeWindow,
      duration: 0.5
    });
    const shake = deferred<void>();
    layers.dialog.shake.mockReturnValueOnce(shake.promise);

    await ShakeWindow(controller, action);
    expect(layers.dialog.shake).toHaveBeenCalledWith(expect.anything(), expect.anything(), 500);

    const failure = new Error("window shake failed");
    shake.reject(failure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("ShakeWindow failed"),
        action,
        failure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("does not wait for scene-effect setup and reports its failure", async () => {
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.PlayScenarioEffect,
      stringVal: "line_legend_02"
    });
    const setup = deferred<void>();
    layers.scene_effect.draw.mockReturnValueOnce(setup.promise);

    let completed = false;
    const running = PlayScenarioEffect(controller, action).then(() => {
      completed = true;
    });
    expect(layers.scene_effect.draw).toHaveBeenCalledWith("line_legend_02", controller.events);
    await running;
    expect(completed).toBe(true);

    const failure = new Error("scene setup failed");
    setup.reject(failure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("PlayScenarioEffect failed"),
        action,
        failure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
  });

  it("draws telop content before overlapping the dialog fade with its show transition", async () => {
    const { action, controller, events, layers, logger } = createController({
      effect: SpecialEffectType.Telop,
      stringVal: "Original"
    });
    const telopDraw = deferred<void>();
    const dialogFade = deferred<void>();
    const telopShow = deferred<void>();
    const order: string[] = [];
    layers.telop.draw.mockImplementationOnce(() => {
      order.push("telop.draw");
      return telopDraw.promise;
    });
    layers.dialog.hide.mockImplementationOnce(() => {
      order.push("dialog.hide");
      return dialogFade.promise;
    });
    layers.telop.show.mockImplementationOnce(() => {
      order.push("telop.show");
      return telopShow.promise;
    });

    let completed = false;
    const running = Telop(controller, action).then(() => {
      completed = true;
    });
    expect(order).toEqual(["telop.draw", "dialog.hide", "telop.show"]);
    expect(completed).toBe(false);

    const drawFailure = new Error("telop draw failed");
    telopDraw.reject(drawFailure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("Telop draw failed"),
        action,
        drawFailure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
    expect(completed).toBe(false);

    const failure = new Error("dialog fade failed");
    dialogFade.reject(failure);
    await vi.waitFor(() => {
      expect(logger.warn).toHaveBeenCalledWith(
        "Live2DController",
        expect.stringContaining("Telop dialog hide failed"),
        action,
        failure
      );
    });
    expect(events.emit).not.toHaveBeenCalled();
    expect(completed).toBe(false);
    telopShow.resolve();
    await running;
    expect(completed).toBe(true);
  });
});
