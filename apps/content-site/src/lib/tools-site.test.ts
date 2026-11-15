import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ PUBLIC_TOOLS_SITE_BASE_URL: "" as string | undefined }));

vi.mock("$app/env/public", () => mockEnv);

const { getEventTrackerHref, getEventTrackerSiteHref, getMusicRecommenderHref } =
  await import("./tools-site");

describe("getEventTrackerSiteHref", () => {
  beforeEach(() => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = "https://tools.example.test/";
  });

  it.each(["jp", "tw", "en", "kr"] as const)("builds the region tracker URL for %s", (region) => {
    expect(getEventTrackerSiteHref(region)).toBe(`https://tools.example.test/tracker/${region}`);
  });

  it("returns null for regions without tracker support", () => {
    expect(getEventTrackerSiteHref("cn")).toBeNull();
  });

  it.each([undefined, "", "   "])("returns null when the base URL is %o", (baseUrl) => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = baseUrl;

    expect(getEventTrackerSiteHref("jp")).toBeNull();
  });
});

describe("getMusicRecommenderHref", () => {
  it("builds the music recommender URL without trailing slashes", () => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = " https://tools.example.test// ";

    expect(getMusicRecommenderHref()).toBe("https://tools.example.test/music-recommender");
  });

  it.each([undefined, "", "   "])("returns null when the base URL is %o", (baseUrl) => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = baseUrl;

    expect(getMusicRecommenderHref()).toBeNull();
  });
});

describe("getEventTrackerHref", () => {
  beforeEach(() => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = "https://tools.example.test";
  });

  it.each(["jp", "tw", "en", "kr"] as const)(
    "builds a tracker URL with the event id for %s",
    (region) => {
      expect(getEventTrackerHref(region, "123")).toBe(
        `https://tools.example.test/tracker/${region}?eventId=123`
      );
    }
  );

  it("returns null for regions without tracker support", () => {
    expect(getEventTrackerHref("cn", "123")).toBeNull();
  });

  it("returns null when the base URL is unset", () => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = undefined;

    expect(getEventTrackerHref("jp", "123")).toBeNull();
  });

  it.each(["", "   "])("returns null when the base URL is blank (%o)", (baseUrl) => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = baseUrl;

    expect(getEventTrackerHref("jp", "123")).toBeNull();
  });

  it("trims trailing slashes from the base URL", () => {
    mockEnv.PUBLIC_TOOLS_SITE_BASE_URL = "https://tools.example.test//";

    expect(getEventTrackerHref("en", "456")).toBe(
      "https://tools.example.test/tracker/en?eventId=456"
    );
  });
});
