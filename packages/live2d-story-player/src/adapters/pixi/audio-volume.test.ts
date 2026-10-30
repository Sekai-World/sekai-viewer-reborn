import { describe, expect, it, vi } from "vitest";
import type { Howl } from "howler";
import { Live2DAssetType } from "./player-types.js";
import { applyChannelVolumes, setSoundGain } from "./audio-volume.js";

const sound = (name: string) => ({ name }) as unknown as Howl;

const createAdapter = (playing: Howl[]) => ({
  isPlaying: vi.fn((s: Howl) => playing.includes(s)),
  setVolume: vi.fn()
});

const settings = () => ({ voice_volume: 0.8, bgm_volume: 0.3, se_volume: 0.8 });

describe("applyChannelVolumes", () => {
  it("applies an explicit zero so a playing sound is muted", () => {
    const voice = sound("voice");
    const adapter = createAdapter([voice]);
    const current = settings();

    applyChannelVolumes(
      current,
      { voice_volume: 0 },
      [{ type: Live2DAssetType.Talk, data: voice }],
      adapter
    );

    expect(current.voice_volume).toBe(0);
    expect(adapter.setVolume).toHaveBeenCalledWith(voice, 0);
  });

  it("keeps the scenario gain of each playing sound under the channel slider", () => {
    const bgm = sound("bgm");
    const se = sound("se");
    setSoundGain(bgm, 0.5);
    setSoundGain(se, 0.25);
    const adapter = createAdapter([bgm, se]);
    const current = settings();

    applyChannelVolumes(
      current,
      { bgm_volume: 0.8, se_volume: 0.4 },
      [
        { type: Live2DAssetType.BackgroundMusic, data: bgm },
        { type: Live2DAssetType.SoundEffect, data: se }
      ],
      adapter
    );

    // BGM channel is attenuated by half.
    expect(adapter.setVolume).toHaveBeenCalledWith(bgm, 0.8 * 0.5 * 0.5);
    expect(adapter.setVolume).toHaveBeenCalledWith(se, 0.4 * 0.25);
  });

  it("leaves channels that were not changed, and sounds that are not playing, alone", () => {
    const voice = sound("voice");
    const idleSe = sound("idle-se");
    const adapter = createAdapter([voice]);
    const current = settings();

    applyChannelVolumes(
      current,
      { se_volume: 0.1 },
      [
        { type: Live2DAssetType.Talk, data: voice },
        { type: Live2DAssetType.SoundEffect, data: idleSe }
      ],
      adapter
    );

    expect(current).toEqual({ voice_volume: 0.8, bgm_volume: 0.3, se_volume: 0.1 });
    expect(adapter.setVolume).not.toHaveBeenCalled();
  });
});
