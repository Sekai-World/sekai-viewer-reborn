import type { Live2DController } from "../Live2DController";
import type { Snippet } from "../../scenario-types";
import { SoundPlayMode } from "../../scenario-types";
import { Live2DAssetType } from "../player-types";
import { log } from "../log";

type SoundDetail = Live2DController["scenarioData"]["SoundData"][number];

interface SoundResolution {
  sound: Howl | null;
  sound_type: "bgm" | "se" | null;
}

type SoundResolutionResult = { kind: "skip" } | ({ kind: "play" } & SoundResolution);

function fadeOutAllBgm(controller: Live2DController, duration_seconds: number): void {
  controller.scenarioResource.audio
    .filter((sound) => sound.type === Live2DAssetType.BackgroundMusic && sound.data.playing())
    .forEach((sound) => {
      const sound_instance = sound.data;
      sound_instance.fade(sound_instance.volume(), 0, duration_seconds * 1000);
      sound_instance.once("fade", () => {
        sound_instance.stop();
      });
    });
}

function warnMissingSound(controller: Live2DController, identifier: string): void {
  log.warn("Live2DController", `${identifier} not loaded, skip.`);
  controller.events.emit("warn", `${identifier} not loaded, skip.`);
}

function findAudio(
  controller: Live2DController,
  identifier: string,
  type: Live2DAssetType
): Howl | null {
  const sound_asset = controller.scenarioResource.audio.find(
    (s) => s.identifier === identifier && s.type === type
  );
  return sound_asset ? sound_asset.data : null;
}

function resolveSound(
  controller: Live2DController,
  action_detail: SoundDetail
): SoundResolutionResult {
  if (action_detail.Bgm) {
    if (action_detail.Bgm === "bgm00000") {
      // if bgm name is bgm00000, stop all bgm
      fadeOutAllBgm(controller, action_detail.Duration);
      return { kind: "skip" };
    }
    const sound = findAudio(controller, action_detail.Bgm, Live2DAssetType.BackgroundMusic);
    if (sound) return { kind: "play", sound, sound_type: "bgm" };
    warnMissingSound(controller, action_detail.Bgm);
    return { kind: "skip" };
  }
  if (action_detail.Se) {
    const sound = findAudio(controller, action_detail.Se, Live2DAssetType.SoundEffect);
    if (sound) return { kind: "play", sound, sound_type: "se" };
    warnMissingSound(controller, action_detail.Se);
    return { kind: "skip" };
  }
  return { kind: "play", sound: null, sound_type: null };
}

function playCrossFade(
  controller: Live2DController,
  resolution: SoundResolution,
  bgm_volume: number,
  se_volume: number,
  duration_ms: number
): void {
  const { sound, sound_type } = resolution;
  if (!sound) return;
  if (sound_type === "bgm") {
    // bgm always loop
    controller.stop_sounds([Live2DAssetType.BackgroundMusic]);
    sound.loop(true);
    sound.fade(0, bgm_volume, duration_ms);
    sound.play();
  } else if (sound_type === "se") {
    sound.loop(false);
    sound.fade(0, se_volume, duration_ms);
    sound.play();
  }
}

function playStack(resolution: SoundResolution, bgm_volume: number): void {
  const { sound } = resolution;
  if (!sound) return;
  sound.loop(false);
  sound.volume(bgm_volume);
  sound.play();
}

function playLoopSe(resolution: SoundResolution, se_volume: number, duration_ms: number): void {
  const { sound } = resolution;
  if (!sound) return;
  sound.loop(true);
  sound.fade(0, se_volume, duration_ms);
  sound.play();
}

function stopSe(resolution: SoundResolution, duration_ms: number): void {
  const { sound } = resolution;
  if (!sound) return;
  sound.fade(sound.volume(), 0, duration_ms);
  sound.once("fade", () => {
    sound.stop();
  });
}

function fadeAllBgmVolume(
  controller: Live2DController,
  bgm_volume: number,
  duration_seconds: number
): void {
  // if no bgm asset, fade to new volume for all playing bgm
  controller.scenarioResource.audio
    .filter((sound) => sound.type === Live2DAssetType.BackgroundMusic && sound.data.playing())
    .forEach((sound) => {
      const sound_instance = sound.data;
      sound_instance.fade(sound_instance.volume(), bgm_volume, duration_seconds * 1000);
    });
}

function setBgmVolume(
  controller: Live2DController,
  resolution: SoundResolution,
  bgm_volume: number,
  duration_seconds: number
): void {
  const { sound } = resolution;
  if (sound) {
    // fade to new volume
    sound.fade(sound.volume(), bgm_volume, duration_seconds * 1000);
  } else {
    fadeAllBgmVolume(controller, bgm_volume, duration_seconds);
  }
}

function applySoundPlayMode(
  controller: Live2DController,
  action: Snippet,
  action_detail: SoundDetail,
  resolution: SoundResolution,
  bgm_volume: number,
  se_volume: number
): void {
  const duration_ms = action_detail.Duration * 1000;
  switch (action_detail.PlayMode) {
    case SoundPlayMode.CrossFade:
      playCrossFade(controller, resolution, bgm_volume, se_volume, duration_ms);
      break;
    case SoundPlayMode.Stack:
      playStack(resolution, bgm_volume);
      break;
    case SoundPlayMode.LoopSe:
      playLoopSe(resolution, se_volume, duration_ms);
      break;
    case SoundPlayMode.StopSe:
      stopSe(resolution, duration_ms);
      break;
    case SoundPlayMode.SetBgmVolume:
      setBgmVolume(controller, resolution, bgm_volume, action_detail.Duration);
      break;
    default:
      log.warn(
        "Live2DController",
        `Sound/SoundPlayMode:${action_detail.PlayMode} not implemented!`,
        action
      );
      controller.events.emit(
        "warn",
        `Sound/SoundPlayMode:${action_detail.PlayMode} not implemented!`
      );
  }
}

export default async function action_sound(controller: Live2DController, action: Snippet) {
  const action_detail = controller.scenarioData.SoundData[action.ReferenceIndex];
  log.log("Live2DController", "Sound", action, action_detail);
  const resolution = resolveSound(controller, action_detail);
  if (resolution.kind === "skip") return;
  // different play mode
  // Silent go-back replay: skip SEs (one-shot churn); BGM keeps playing so
  // the scene converges on the correct music state.
  if (controller.replay_silent && resolution.sound_type === "se") return;
  const bgm_volume = controller.settings.bgm_volume * action_detail.Volume;
  const se_volume = controller.settings.se_volume * action_detail.Volume;
  applySoundPlayMode(controller, action, action_detail, resolution, bgm_volume, se_volume);
}
