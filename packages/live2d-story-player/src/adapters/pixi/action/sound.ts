import type { Live2DController } from "../Live2DController.js";
import type { Snippet } from "../../../model/scenario-types.js";
import { SoundPlayMode } from "../../../model/scenario-types.js";
import { Live2DAssetType } from "../player-types.js";
import type { Howl } from "howler";
import { setSoundGain } from "../audio-volume.js";

type SoundDetail = Live2DController["scenarioData"]["SoundData"][number];

interface SoundResolution {
  sound: Howl | null;
  sound_type: "bgm" | "se" | null;
}

type SoundResolutionResult = { kind: "skip" } | ({ kind: "play" } & SoundResolution);

function fadeOutPlaying(
  controller: Live2DController,
  types: readonly Live2DAssetType[],
  duration_ms: number,
  except?: Howl
): void {
  controller.scenarioResource.audio
    .filter(
      (sound) =>
        types.includes(sound.type) &&
        sound.data !== except &&
        controller.audioAdapter.isPlaying(sound.data)
    )
    .forEach((sound) => {
      const sound_instance = sound.data;
      if (duration_ms <= 0) {
        controller.audioAdapter.stop(sound_instance);
        return;
      }
      controller.audioAdapter.fade(
        sound_instance,
        controller.audioAdapter.getVolume(sound_instance),
        0,
        duration_ms
      );
      controller.audioAdapter.once(sound_instance, "fade", () => {
        controller.audioAdapter.stop(sound_instance);
      });
    });
}

function fadeOutAllBgm(controller: Live2DController, duration_seconds: number): void {
  fadeOutPlaying(controller, [Live2DAssetType.BackgroundMusic], duration_seconds * 1000);
}

/**
 * Winds down the music and any looping effect when a story ends, so a finished
 * story does not leave ambience running behind the end screen.
 */
export function fadeOutStoryAmbience(controller: Live2DController, duration_ms: number): void {
  fadeOutPlaying(
    controller,
    [Live2DAssetType.BackgroundMusic, Live2DAssetType.SoundEffect],
    duration_ms
  );
}

function warnMissingSound(controller: Live2DController, identifier: string): void {
  controller.logger.warn("Live2DController", `${identifier} not loaded, skip.`);
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
  duration_ms: number,
  gain: number
): void {
  const { sound, sound_type } = resolution;
  if (!sound) return;
  setSoundGain(sound, gain);
  if (sound_type === "bgm") {
    // The previous track fades out over the same duration the new one fades in.
    if (controller.audioAdapter.isPlaying(sound)) controller.audioAdapter.stop(sound);
    fadeOutPlaying(controller, [Live2DAssetType.BackgroundMusic], duration_ms, sound);
    // bgm always loop
    controller.audioAdapter.setLoop(sound, true);
    controller.audioAdapter.fade(sound, 0, bgm_volume, duration_ms);
    controller.audioAdapter.play(sound);
  } else if (sound_type === "se") {
    controller.audioAdapter.setLoop(sound, false);
    controller.audioAdapter.fade(sound, 0, se_volume, duration_ms);
    controller.audioAdapter.play(sound);
  }
}

function playStack(
  controller: Live2DController,
  resolution: SoundResolution,
  se_volume: number,
  gain: number
): void {
  const { sound } = resolution;
  if (!sound) return;
  setSoundGain(sound, gain);
  controller.audioAdapter.setLoop(sound, false);
  controller.audioAdapter.setVolume(sound, se_volume);
  controller.audioAdapter.play(sound);
}

function playLoopSe(
  controller: Live2DController,
  resolution: SoundResolution,
  se_volume: number,
  duration_ms: number,
  gain: number
): void {
  const { sound } = resolution;
  if (!sound) return;
  setSoundGain(sound, gain);
  controller.audioAdapter.setLoop(sound, true);
  controller.audioAdapter.fade(sound, 0, se_volume, duration_ms);
  controller.audioAdapter.play(sound);
}

function stopSe(
  controller: Live2DController,
  resolution: SoundResolution,
  duration_ms: number
): void {
  const { sound } = resolution;
  if (!sound) return;
  controller.audioAdapter.fade(sound, controller.audioAdapter.getVolume(sound), 0, duration_ms);
  controller.audioAdapter.once(sound, "fade", () => {
    controller.audioAdapter.stop(sound);
  });
}

function fadeAllBgmVolume(
  controller: Live2DController,
  bgm_volume: number,
  duration_seconds: number,
  gain: number
): void {
  // if no bgm asset, fade to new volume for all playing bgm
  controller.scenarioResource.audio
    .filter(
      (sound) =>
        sound.type === Live2DAssetType.BackgroundMusic &&
        controller.audioAdapter.isPlaying(sound.data)
    )
    .forEach((sound) => {
      const sound_instance = sound.data;
      setSoundGain(sound_instance, gain);
      controller.audioAdapter.fade(
        sound_instance,
        controller.audioAdapter.getVolume(sound_instance),
        bgm_volume,
        duration_seconds * 1000
      );
    });
}

function setBgmVolume(
  controller: Live2DController,
  resolution: SoundResolution,
  bgm_volume: number,
  duration_seconds: number,
  gain: number
): void {
  const { sound } = resolution;
  if (sound) {
    // fade to new volume
    setSoundGain(sound, gain);
    controller.audioAdapter.fade(
      sound,
      controller.audioAdapter.getVolume(sound),
      bgm_volume,
      duration_seconds * 1000
    );
  } else {
    fadeAllBgmVolume(controller, bgm_volume, duration_seconds, gain);
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
      playCrossFade(
        controller,
        resolution,
        bgm_volume,
        se_volume,
        duration_ms,
        action_detail.Volume
      );
      break;
    case SoundPlayMode.Stack:
      playStack(controller, resolution, se_volume, action_detail.Volume);
      break;
    case SoundPlayMode.LoopSe:
      playLoopSe(controller, resolution, se_volume, duration_ms, action_detail.Volume);
      break;
    case SoundPlayMode.StopSe:
      stopSe(controller, resolution, duration_ms);
      break;
    case SoundPlayMode.SetBgmVolume:
      setBgmVolume(
        controller,
        resolution,
        bgm_volume,
        action_detail.Duration,
        action_detail.Volume
      );
      break;
    default:
      controller.logger.warn(
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
  controller.logger.log("Live2DController", "Sound", action, action_detail);
  const resolution = resolveSound(controller, action_detail);
  if (resolution.kind === "skip") return;
  // different play mode
  // Silent go-back replay: skip one-shot SEs (churn); BGM and looping SE
  // state keep converging so the scene ends with the right ambience.
  if (
    controller.replay_silent &&
    resolution.sound_type === "se" &&
    action_detail.PlayMode !== SoundPlayMode.LoopSe &&
    action_detail.PlayMode !== SoundPlayMode.StopSe
  ) {
    return;
  }
  const bgm_volume = controller.settings.bgm_volume * action_detail.Volume;
  const se_volume = controller.settings.se_volume * action_detail.Volume;
  applySoundPlayMode(controller, action, action_detail, resolution, bgm_volume, se_volume);
}
