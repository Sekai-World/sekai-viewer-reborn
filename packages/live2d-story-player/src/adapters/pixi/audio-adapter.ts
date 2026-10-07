import { Howler } from "howler";
import type { Howl } from "howler";

export type PixiStoryAudioEvent = "end" | "fade";

export interface PixiStoryLipSyncConnection {
  analyser: AnalyserNode;
  disconnect(): void;
}

/** Audio operations used by Pixi story playback and Live2D lip sync. */
export interface PixiStoryAudioAdapter {
  isPlaying(sound: Howl): boolean;
  play(sound: Howl): void;
  stop(sound: Howl): void;
  unload(sound: Howl): void;
  setVolume(sound: Howl, volume: number): void;
  getVolume(sound: Howl): number;
  setLoop(sound: Howl, loop: boolean): void;
  fade(sound: Howl, from: number, to: number, duration: number): void;
  once(sound: Howl, event: PixiStoryAudioEvent, listener: () => void): void;
  off(sound: Howl, event: PixiStoryAudioEvent): void;
  connectLipSync(sound: Howl): PixiStoryLipSyncConnection | null;
}

interface HowlerSoundNode {
  _sounds?: { _node?: AudioNode }[];
}

/** Default browser backend. Howler's context and private sound node stay isolated here. */
export const createHowlerStoryAudioAdapter = (): PixiStoryAudioAdapter => ({
  isPlaying: (sound) => sound.playing(),
  play: (sound) => {
    sound.play();
  },
  stop: (sound) => {
    sound.stop();
  },
  unload: (sound) => {
    sound.unload();
  },
  setVolume: (sound, volume) => {
    sound.volume(volume);
  },
  getVolume: (sound) => sound.volume(),
  setLoop: (sound, loop) => {
    sound.loop(loop);
  },
  fade: (sound, from, to, duration) => {
    sound.fade(from, to, duration);
  },
  once: (sound, event, listener) => {
    sound.once(event, listener);
  },
  off: (sound, event) => {
    sound.off(event);
  },
  connectLipSync: (sound) => {
    const context = Howler.ctx;
    const masterGain = Howler.masterGain;
    const gain = (sound as unknown as HowlerSoundNode)._sounds?.[0]?._node;
    if (!context || !masterGain || !gain) return null;

    const analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.minDecibels = -100;
    analyser.maxDecibels = -10;
    analyser.smoothingTimeConstant = 0.85;

    const disconnect = (): void => {
      try {
        gain.disconnect();
      } catch {
        // Disconnect the analyser even when the sound node is already detached.
      }
      try {
        analyser.disconnect();
      } catch {
        // The analyser may already be detached by the host.
      }
    };

    try {
      gain.disconnect();
      analyser.disconnect();
      gain.connect(analyser);
      analyser.connect(masterGain);
    } catch {
      disconnect();
      return null;
    }

    let connected = true;
    return {
      analyser,
      disconnect: () => {
        if (!connected) return;
        connected = false;
        disconnect();
      }
    };
  }
});
