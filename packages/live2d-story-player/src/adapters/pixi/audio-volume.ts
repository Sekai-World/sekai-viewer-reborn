import { Live2DAssetType } from "./player-types.js";
import type { Howl } from "howler";
import type { PixiStoryAudioAdapter } from "./audio-adapter.js";

export interface StoryVolumeSettings {
  voice_volume: number;
  bgm_volume: number;
  se_volume: number;
}

/**
 * Scenario-authored gain of the sound currently playing (the snippet's
 * `Volume`). Channel sliders are applied on top of it, so moving a slider
 * never flattens the mix the scenario asked for.
 */
const soundGains = new WeakMap<object, number>();

export const setSoundGain = (sound: object, gain: number): void => {
  soundGains.set(sound, gain);
};

export const getSoundGain = (sound: object): number => soundGains.get(sound) ?? 1;

/** The BGM channel is attenuated so music sits under voices at equal slider values. */
export const BGM_CHANNEL_ATTENUATION = 0.5;

interface PlayingAudio {
  type: Live2DAssetType;
  data: Howl;
}

/**
 * Stores the requested channel volumes and re-applies them to sounds that are
 * already playing. An explicit `0` is a real volume (mute), not "unchanged".
 */
export const applyChannelVolumes = (
  settings: StoryVolumeSettings,
  volume: Partial<StoryVolumeSettings>,
  audio: readonly PlayingAudio[],
  adapter: Pick<PixiStoryAudioAdapter, "isPlaying" | "setVolume">
): void => {
  if (volume.voice_volume !== undefined) settings.voice_volume = volume.voice_volume;
  if (volume.bgm_volume !== undefined) {
    settings.bgm_volume = volume.bgm_volume * BGM_CHANNEL_ATTENUATION;
  }
  if (volume.se_volume !== undefined) settings.se_volume = volume.se_volume;

  const channelOf = (type: Live2DAssetType): keyof StoryVolumeSettings | null => {
    if (type === Live2DAssetType.Talk) return "voice_volume";
    if (type === Live2DAssetType.BackgroundMusic) return "bgm_volume";
    if (type === Live2DAssetType.SoundEffect) return "se_volume";
    return null;
  };
  for (const sound of audio) {
    const channel = channelOf(sound.type);
    if (!channel || volume[channel] === undefined) continue;
    if (!adapter.isPlaying(sound.data)) continue;
    adapter.setVolume(sound.data, settings[channel] * getSoundGain(sound.data));
  }
};
