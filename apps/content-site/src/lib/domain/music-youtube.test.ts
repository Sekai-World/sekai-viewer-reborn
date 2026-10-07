import { describe, expect, it } from "vitest";
import { getMusicYoutubeReferences, parseYoutubeReference } from "./music-youtube";

describe("YouTube URL validation", () => {
  it.each([
    "https://youtu.be/EgOWe9ByNaE",
    "https://youtube.com/watch?v=EgOWe9ByNaE",
    "https://www.youtube.com/watch?v=EgOWe9ByNaE&t=30&list=ignored",
    "https://m.youtube.com/watch?v=EgOWe9ByNaE#fragment",
    "https://www.youtube.com/embed/EgOWe9ByNaE",
    "https://youtube.com/shorts/EgOWe9ByNaE"
  ])("constructs canonical URLs from %s", (url) => {
    expect(parseYoutubeReference(url)).toEqual({
      videoId: "EgOWe9ByNaE",
      watchUrl: "https://www.youtube.com/watch?v=EgOWe9ByNaE",
      embedUrl: "https://www.youtube-nocookie.com/embed/EgOWe9ByNaE"
    });
  });

  it.each([
    undefined,
    null,
    123,
    "",
    "javascript:alert(1)",
    "http://youtu.be/EgOWe9ByNaE",
    "//youtu.be/EgOWe9ByNaE",
    "https://youtube.com.evil.test/watch?v=EgOWe9ByNaE",
    "https://evil.youtube.com/watch?v=EgOWe9ByNaE",
    "https://youtube.com@evil.test/watch?v=EgOWe9ByNaE",
    "https://user@youtube.com/watch?v=EgOWe9ByNaE",
    "https://user:pass@youtube.com/watch?v=EgOWe9ByNaE",
    "https://youtube.com:443/watch?v=EgOWe9ByNaE",
    "https://youtube.com:8443/watch?v=EgOWe9ByNaE",
    "https://youtube.com./watch?v=EgOWe9ByNaE",
    "https://youtube.com\\@evil.test/watch?v=EgOWe9ByNaE",
    "https://you\ntube.com/watch?v=EgOWe9ByNaE",
    "https://www.youtube-nocookie.com/embed/EgOWe9ByNaE",
    "https://nicovideo.jp/watch/sm123",
    "https://youtu.be/EgOWe9ByNaE/extra",
    "https://youtube.com/watch?v=EgOWe9ByNaE&v=XogSflwXgpw",
    "https://youtube.com/watch?v=tooShort",
    "https://youtube.com/watch?v=EgOWe9ByNaEextra",
    "https://youtube.com/watch?v=EgOWe9ByNa%2F",
    "https://youtube.com/redirect?q=https://youtu.be/EgOWe9ByNaE"
  ])("rejects unsafe or unsupported input %s", (value) => {
    expect(parseYoutubeReference(value)).toBeNull();
  });

  it("allows the ID alphabet and deduplicates references", () => {
    expect(parseYoutubeReference("https://youtu.be/aA0_-123456")?.videoId).toBe("aA0_-123456");
    expect(
      getMusicYoutubeReferences([
        { id: "1", musicId: "8", videoLink: "https://youtu.be/EgOWe9ByNaE" },
        { id: "2", musicId: "8", videoLink: "https://youtube.com/watch?v=EgOWe9ByNaE" },
        { id: "3", musicId: "8", videoLink: "https://nicovideo.jp/watch/sm123" }
      ])
    ).toHaveLength(1);
  });
});
