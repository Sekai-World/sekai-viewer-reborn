import { describe, expect, it } from "vitest";
import { parseMusicDetail } from "./music-detail";

const music = { id: "8", title: "Song" };
const original = { id: "1", musicId: "8", videoLink: "https://youtu.be/EgOWe9ByNaE" };

describe("musicOriginals response contract", () => {
  it.each([undefined, null, {}, "invalid", 1])(
    "defaults missing/malformed arrays to [] (%s)",
    (musicOriginals) => {
      expect(parseMusicDetail({ music, musicOriginals })?.musicOriginals).toEqual([]);
    }
  );

  it("accepts top-level records independent of native MV availability", () => {
    const detail = parseMusicDetail({ music, musicOriginals: [original] });
    expect(detail?.musicOriginals).toEqual([original]);
    expect(detail?.musicVideos).toEqual([]);
  });

  it("drops malformed and mismatched records without dropping usable data", () => {
    const malformed = [
      null,
      [],
      {},
      { ...original, id: 1 },
      { ...original, musicId: "18" },
      { ...original, videoLink: false },
      { ...original, id: " " }
    ];
    expect(
      parseMusicDetail({ music, musicOriginals: [...malformed, original] })?.musicOriginals
    ).toEqual([original]);
  });

  it("keeps non-YouTube records as data, not embed sources", () => {
    const nico = { ...original, videoLink: "https://nicovideo.jp/watch/sm123" };
    expect(parseMusicDetail({ music, musicOriginals: [nico] })?.musicOriginals).toEqual([nico]);
  });
});
