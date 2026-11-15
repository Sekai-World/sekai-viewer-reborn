import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ PUBLIC_MEDIA_LAB_SITE_BASE_URL: "" as string | undefined }));

vi.mock("$app/env/public", () => mockEnv);

const {
  getCardStoryReaderHref,
  getCharacterStoryReaderHref,
  getChibiHref,
  getEventStoryReaderHref,
  getLive2dHref,
  getStoryReaderHref
} = await import("./media-lab-site");

describe("media lab site hrefs", () => {
  beforeEach(() => {
    mockEnv.PUBLIC_MEDIA_LAB_SITE_BASE_URL = "https://media.example.test";
  });

  it("builds the site-level entry URLs", () => {
    expect(getStoryReaderHref()).toBe("https://media.example.test/story-reader");
    expect(getLive2dHref()).toBe("https://media.example.test/live2d");
    expect(getChibiHref()).toBe("https://media.example.test/chibi");
  });

  it("trims whitespace and trailing slashes from the base URL", () => {
    mockEnv.PUBLIC_MEDIA_LAB_SITE_BASE_URL = " https://media.example.test// ";

    expect(getStoryReaderHref()).toBe("https://media.example.test/story-reader");
  });

  it.each([undefined, "", "   "])(
    "returns null for every href when the base URL is %o",
    (baseUrl) => {
      mockEnv.PUBLIC_MEDIA_LAB_SITE_BASE_URL = baseUrl;

      expect(getStoryReaderHref()).toBeNull();
      expect(getLive2dHref()).toBeNull();
      expect(getChibiHref()).toBeNull();
      expect(getEventStoryReaderHref("jp", "1")).toBeNull();
      expect(getCardStoryReaderHref("jp", "1")).toBeNull();
      expect(getCharacterStoryReaderHref("jp", "1")).toBeNull();
    }
  );

  it.each(["jp", "en", "tw", "kr", "cn"] as const)("builds story deep links for %s", (region) => {
    expect(getEventStoryReaderHref(region, "123")).toBe(
      `https://media.example.test/story-reader/${region}/event/123-1`
    );
    expect(getCardStoryReaderHref(region, "456")).toBe(
      `https://media.example.test/story-reader/${region}/card/456`
    );
    expect(getCharacterStoryReaderHref(region, "21")).toBe(
      `https://media.example.test/story-reader/${region}/character/21`
    );
  });

  it.each(["", "0", "-1", "1.5", "abc", "1/2", "01"])(
    "returns null for a story id that is not a master-data id (%o)",
    (id) => {
      expect(getEventStoryReaderHref("jp", id)).toBeNull();
      expect(getCardStoryReaderHref("jp", id)).toBeNull();
      expect(getCharacterStoryReaderHref("jp", id)).toBeNull();
    }
  );
});
