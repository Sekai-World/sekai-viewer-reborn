import { describe, expect, it, vi } from "vitest";

vi.mock("pixi.js", () => ({ DisplayObject: class {}, Texture: class {} }));

import type { Live2DController } from "../Live2DController.js";
import {
  SnippetAction,
  SnippetProgressBehavior,
  SoundPlayMode
} from "../../../model/scenario-types.js";
import { Live2DAssetType } from "../player-types.js";
import action_sound, { fadeOutStoryAmbience } from "./sound.js";
import action_talk from "./talk.js";

type Listener = () => void;

const snippet = (action: SnippetAction) => ({
  Action: action,
  ProgressBehavior: SnippetProgressBehavior.WaitUnitilFinished,
  ReferenceIndex: 0,
  Delay: 0
});

const createAudio = () => {
  const onceListeners = new Map<unknown, Listener[]>();
  const playing = new Set<unknown>();
  const volumes = new Map<unknown, number>();
  const adapter = {
    fade: vi.fn(),
    getVolume: vi.fn((sound: unknown) => volumes.get(sound) ?? 1),
    isPlaying: vi.fn((sound: unknown) => playing.has(sound)),
    once: vi.fn((sound: unknown, _event: string, listener: Listener) => {
      onceListeners.set(sound, [...(onceListeners.get(sound) ?? []), listener]);
    }),
    play: vi.fn((sound: unknown) => {
      playing.add(sound);
    }),
    setLoop: vi.fn(),
    setVolume: vi.fn(),
    stop: vi.fn((sound: unknown) => {
      playing.delete(sound);
    })
  };
  return {
    adapter,
    playing,
    fire: (sound: unknown) => onceListeners.get(sound)?.forEach((listener) => listener())
  };
};

const createSoundController = (
  sound: Partial<{
    mode: SoundPlayMode;
    bgm: string;
    se: string;
    volume: number;
    duration: number;
  }>,
  options: { replaySilent?: boolean } = {}
) => {
  const audio = createAudio();
  const bgmA = { name: "bgmA" };
  const bgmB = { name: "bgmB" };
  const se = { name: "se" };
  const detail = {
    PlayMode: sound.mode ?? SoundPlayMode.CrossFade,
    Bgm: sound.bgm ?? "",
    Se: sound.se ?? "",
    Volume: sound.volume ?? 1,
    SeBundleName: "",
    Duration: sound.duration ?? 2
  };
  const events = { emit: vi.fn() };
  const order: string[] = [];
  const controller = {
    scenarioData: { SoundData: [detail] },
    scenarioResource: {
      audio: [
        { identifier: "bgmA", type: Live2DAssetType.BackgroundMusic, data: bgmA },
        { identifier: "bgmB", type: Live2DAssetType.BackgroundMusic, data: bgmB },
        { identifier: "se1", type: Live2DAssetType.SoundEffect, data: se }
      ]
    },
    audioAdapter: audio.adapter,
    settings: { bgm_volume: 0.25, se_volume: 0.4, voice_volume: 0.8 },
    replay_silent: options.replaySilent ?? false,
    logger: { log: vi.fn(), warn: vi.fn() },
    events,
    stop_sounds: vi.fn((types: Live2DAssetType[]) => {
      order.push(`stop_sounds:${types.join(",")}`);
    })
  } as unknown as Live2DController;
  audio.adapter.setLoop.mockImplementation(() => order.push("setLoop"));
  audio.adapter.fade.mockImplementation(() => order.push("fade"));
  audio.adapter.play.mockImplementation((s: unknown) => {
    audio.playing.add(s);
    order.push("play");
  });
  return { audio, bgmA, bgmB, se, controller, events, order };
};

const run = (controller: Live2DController) =>
  action_sound(controller, snippet(SnippetAction.Sound));

describe("sound action", () => {
  it("fades in a new BGM on loop while the previous one fades out", async () => {
    const f = createSoundController({ bgm: "bgmB", volume: 0.5, duration: 2.5 });
    f.audio.playing.add(f.bgmA);
    await run(f.controller);

    expect(f.audio.adapter.stop).not.toHaveBeenCalled();
    expect(f.audio.adapter.fade).toHaveBeenCalledWith(f.bgmA, 1, 0, 2500);
    expect(f.audio.adapter.fade).toHaveBeenCalledWith(f.bgmB, 0, 0.125, 2500);
    expect(f.audio.adapter.setLoop).toHaveBeenCalledWith(f.bgmB, true);
    expect(f.audio.adapter.play).toHaveBeenCalledWith(f.bgmB);
    f.audio.fire(f.bgmA);
    expect(f.audio.adapter.stop).toHaveBeenCalledWith(f.bgmA);
    expect(f.audio.adapter.stop).not.toHaveBeenCalledWith(f.bgmB);
  });

  it("cuts the previous BGM immediately when the cross-fade has no duration", async () => {
    const f = createSoundController({ bgm: "bgmB", duration: 0 });
    f.audio.playing.add(f.bgmA);
    await run(f.controller);

    expect(f.audio.adapter.stop).toHaveBeenCalledWith(f.bgmA);
    expect(f.audio.adapter.fade).not.toHaveBeenCalledWith(f.bgmA, expect.anything(), 0, 0);
  });

  it("restarts a BGM that is already playing instead of layering it", async () => {
    const f = createSoundController({ bgm: "bgmA" });
    f.audio.playing.add(f.bgmA);
    await run(f.controller);

    expect(f.audio.adapter.stop).toHaveBeenCalledWith(f.bgmA);
    expect(f.audio.adapter.fade).not.toHaveBeenCalledWith(f.bgmA, 1, 0, expect.anything());
    expect(f.audio.adapter.play).toHaveBeenCalledWith(f.bgmA);
  });

  it("stacks an SE at the SE volume, not the BGM volume", async () => {
    const f = createSoundController({ mode: SoundPlayMode.Stack, se: "se1", volume: 0.5 });
    await run(f.controller);

    expect(f.audio.adapter.setVolume).toHaveBeenCalledWith(f.se, 0.2);
    expect(f.audio.adapter.play).toHaveBeenCalledWith(f.se);
  });

  it("winds down playing BGM and effects, but not voices, at story end", () => {
    const f = createSoundController({});
    f.audio.playing.add(f.bgmA);
    f.audio.playing.add(f.se);
    fadeOutStoryAmbience(f.controller, 1500);

    expect(f.audio.adapter.fade).toHaveBeenCalledWith(f.bgmA, 1, 0, 1500);
    expect(f.audio.adapter.fade).toHaveBeenCalledWith(f.se, 1, 0, 1500);
    f.audio.fire(f.bgmA);
    f.audio.fire(f.se);
    expect(f.audio.adapter.stop).toHaveBeenCalledWith(f.bgmA);
    expect(f.audio.adapter.stop).toHaveBeenCalledWith(f.se);
  });

  it("fades out and stops only the playing BGM for bgm00000", async () => {
    const f = createSoundController({ bgm: "bgm00000", duration: 2 });
    f.audio.playing.add(f.bgmA);
    await run(f.controller);

    expect(f.audio.adapter.fade).toHaveBeenCalledTimes(1);
    expect(f.audio.adapter.fade).toHaveBeenCalledWith(f.bgmA, 1, 0, 2000);
    expect(f.audio.adapter.play).not.toHaveBeenCalled();
    expect(f.audio.adapter.stop).not.toHaveBeenCalled();
    f.audio.fire(f.bgmA);
    expect(f.audio.adapter.stop).toHaveBeenCalledWith(f.bgmA);
  });

  it("fades every playing BGM, or just the named one, for SetBgmVolume", async () => {
    const all = createSoundController({ mode: SoundPlayMode.SetBgmVolume, duration: 4 });
    all.audio.playing.add(all.bgmA);
    await run(all.controller);
    expect(all.audio.adapter.fade).toHaveBeenCalledTimes(1);
    expect(all.audio.adapter.fade).toHaveBeenCalledWith(all.bgmA, 1, 0.25, 4000);

    const named = createSoundController({
      mode: SoundPlayMode.SetBgmVolume,
      bgm: "bgmB",
      duration: 1
    });
    await run(named.controller);
    expect(named.audio.adapter.fade).toHaveBeenCalledWith(named.bgmB, 1, 0.25, 1000);
  });

  it("loops an SE at the SE volume and stops it with a fade", async () => {
    const loop = createSoundController({ mode: SoundPlayMode.LoopSe, se: "se1", duration: 1 });
    await run(loop.controller);
    expect(loop.audio.adapter.setLoop).toHaveBeenCalledWith(loop.se, true);
    expect(loop.audio.adapter.fade).toHaveBeenCalledWith(loop.se, 0, 0.4, 1000);
    expect(loop.audio.adapter.play).toHaveBeenCalledWith(loop.se);

    const stop = createSoundController({ mode: SoundPlayMode.StopSe, se: "se1", duration: 0.5 });
    await run(stop.controller);
    expect(stop.audio.adapter.fade).toHaveBeenCalledWith(stop.se, 1, 0, 500);
    expect(stop.audio.adapter.stop).not.toHaveBeenCalled();
    stop.audio.fire(stop.se);
    expect(stop.audio.adapter.stop).toHaveBeenCalledWith(stop.se);
  });

  it("skips one-shot SEs during a silent replay but keeps loops and BGM converging", async () => {
    for (const mode of [SoundPlayMode.CrossFade, SoundPlayMode.Stack]) {
      const oneShot = createSoundController({ mode, se: "se1" }, { replaySilent: true });
      await run(oneShot.controller);
      expect(oneShot.audio.adapter.play).not.toHaveBeenCalled();
      expect(oneShot.audio.adapter.fade).not.toHaveBeenCalled();
    }

    const loop = createSoundController(
      { mode: SoundPlayMode.LoopSe, se: "se1" },
      { replaySilent: true }
    );
    await run(loop.controller);
    expect(loop.audio.adapter.setLoop).toHaveBeenCalledWith(loop.se, true);
    expect(loop.audio.adapter.play).toHaveBeenCalledWith(loop.se);

    const stop = createSoundController(
      { mode: SoundPlayMode.StopSe, se: "se1" },
      { replaySilent: true }
    );
    await run(stop.controller);
    expect(stop.audio.adapter.fade).toHaveBeenCalledTimes(1);

    const bgm = createSoundController({ bgm: "bgmA" }, { replaySilent: true });
    await run(bgm.controller);
    expect(bgm.audio.adapter.play).toHaveBeenCalledWith(bgm.bgmA);
  });

  it("warns instead of playing an unloaded sound or an unknown play mode", async () => {
    const missing = createSoundController({ bgm: "bgm-gone" });
    await run(missing.controller);
    expect(missing.events.emit).toHaveBeenCalledWith("warn", "bgm-gone not loaded, skip.");
    expect(missing.audio.adapter.play).not.toHaveBeenCalled();

    const unknownMode = createSoundController({ mode: 99 as SoundPlayMode, bgm: "bgmA" });
    await run(unknownMode.controller);
    expect(unknownMode.events.emit).toHaveBeenCalledWith(
      "warn",
      "Sound/SoundPlayMode:99 not implemented!"
    );
  });
});

const createTalkController = (
  options: {
    lipSync?: number;
    voices?: { VoiceId: string; Volume: number }[];
    costume?: string | undefined;
    replaySilent?: boolean;
    loaded?: boolean;
  } = {}
) => {
  const audio = createAudio();
  const voice = { name: "voice" };
  const events = { emit: vi.fn() };
  const speak = vi.fn();
  const stopSpeaking = vi.fn();
  const detail = {
    TalkCharacters: [{ Character2dId: 7 }],
    WindowDisplayName: "N",
    Body: "b",
    LipSync: options.lipSync ?? 1,
    Motions: [],
    Voices: options.voices ?? [{ Character2dId: 7, VoiceId: "v1", Volume: 0.5 }]
  };
  const controller = {
    scenarioData: { TalkData: [detail] },
    scenarioResource: {
      audio:
        options.loaded === false
          ? []
          : [{ identifier: "v1", type: Live2DAssetType.Talk, data: voice }]
    },
    audioAdapter: audio.adapter,
    settings: { voice_volume: 0.8, text_animation: false },
    replay_silent: options.replaySilent ?? false,
    logger: { log: vi.fn(), warn: vi.fn() },
    events,
    resolveText: vi.fn(() => ({ displayText: "b", translatedText: "" })),
    live2d_get_costume: vi.fn(() => ("costume" in options ? options.costume : "costume-7")),
    stop_sounds: vi.fn(),
    layers: {
      telop: { hide: vi.fn(async () => {}) },
      dialog: { draw: vi.fn(async () => {}), show: vi.fn(async () => {}) },
      live2d: { speak, stop_speaking: stopSpeaking }
    }
  } as unknown as Live2DController;
  return { audio, voice, events, speak, stopSpeaking, controller };
};

const talk = (controller: Live2DController) => action_talk(controller, snippet(SnippetAction.Talk));

describe("talk action voice and lip sync", () => {
  it("routes a lip-synced voice through speak with the scenario and channel gain", async () => {
    const f = createTalkController({ lipSync: 1 });
    await talk(f.controller);

    expect(f.stopSpeaking).toHaveBeenCalledTimes(1);
    expect(f.controller.stop_sounds).toHaveBeenCalledWith([Live2DAssetType.Talk]);
    expect(f.speak).toHaveBeenCalledWith(["costume-7"], f.voice, 0.4);
    expect(f.audio.adapter.play).not.toHaveBeenCalled();
  });

  it("plays a voice directly, without lip sync, when LipSync is off or no costume is loaded", async () => {
    const off = createTalkController({ lipSync: 0 });
    await talk(off.controller);
    expect(off.speak).not.toHaveBeenCalled();
    expect(off.audio.adapter.setVolume).toHaveBeenCalledWith(off.voice, 0.4);
    expect(off.audio.adapter.play).toHaveBeenCalledWith(off.voice);

    const noCostume = createTalkController({ lipSync: 1, costume: undefined });
    await talk(noCostume.controller);
    expect(noCostume.speak).not.toHaveBeenCalled();
    expect(noCostume.audio.adapter.play).toHaveBeenCalledWith(noCostume.voice);
  });

  it("makes no audio call for a talk without voices", async () => {
    const f = createTalkController({ voices: [] });
    await talk(f.controller);
    expect(f.stopSpeaking).not.toHaveBeenCalled();
    expect(f.speak).not.toHaveBeenCalled();
    expect(f.audio.adapter.play).not.toHaveBeenCalled();
  });

  it("warns for a voice that was not loaded", async () => {
    const f = createTalkController({ loaded: false });
    await talk(f.controller);
    expect(f.events.emit).toHaveBeenCalledWith("warn", "v1 not loaded, skip.");
    expect(f.audio.adapter.play).not.toHaveBeenCalled();
  });

  it("stays silent during a silent replay", async () => {
    const f = createTalkController({ replaySilent: true });
    await talk(f.controller);
    expect(f.stopSpeaking).not.toHaveBeenCalled();
    expect(f.speak).not.toHaveBeenCalled();
    expect(f.audio.adapter.play).not.toHaveBeenCalled();
  });
});
