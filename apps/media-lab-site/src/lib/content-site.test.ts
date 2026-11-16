import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ PUBLIC_CONTENT_SITE_BASE_URL: "" as string | undefined }));

vi.mock("$app/env/public", () => mockEnv);

const { getContentSiteHomeHref, getContentSiteSourceHref } = await import("./content-site");

describe("content site hrefs", () => {
  beforeEach(() => {
    mockEnv.PUBLIC_CONTENT_SITE_BASE_URL = "https://content.example.test";
  });

  it("builds the home URL", () => {
    expect(getContentSiteHomeHref()).toBe("https://content.example.test/");
  });

  it("trims whitespace and trailing slashes from the base URL", () => {
    mockEnv.PUBLIC_CONTENT_SITE_BASE_URL = " https://content.example.test// ";

    expect(getContentSiteHomeHref()).toBe("https://content.example.test/");
  });

  it.each([
    ["event", 100, "https://content.example.test/event/jp/100"],
    ["card", 500, "https://content.example.test/card/jp/500"],
    ["character", 1, "https://content.example.test/character/jp/1"]
  ] as const)("builds the %s detail URL", (kind, id, expected) => {
    expect(getContentSiteSourceHref("jp", { kind, id })).toBe(expected);
  });

  it("returns null for a story without a source or with an invalid id", () => {
    expect(getContentSiteSourceHref("jp", undefined)).toBeNull();
    expect(getContentSiteSourceHref("jp", { kind: "event", id: 0 })).toBeNull();
    expect(getContentSiteSourceHref("jp", { kind: "card", id: 1.5 })).toBeNull();
  });

  it.each([undefined, "", "   "])("returns null when the base URL is %o", (baseUrl) => {
    mockEnv.PUBLIC_CONTENT_SITE_BASE_URL = baseUrl;

    expect(getContentSiteHomeHref()).toBeNull();
    expect(getContentSiteSourceHref("jp", { kind: "event", id: 100 })).toBeNull();
  });
});
