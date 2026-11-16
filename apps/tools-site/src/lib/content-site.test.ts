import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({ PUBLIC_CONTENT_SITE_BASE_URL: "" as string | undefined }));

vi.mock("$app/env/public", () => mockEnv);

const { getContentSiteEventHref, getContentSiteHomeHref } = await import("./content-site");

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

  it("builds the event detail URL", () => {
    expect(getContentSiteEventHref("jp", 100)).toBe("https://content.example.test/event/jp/100");
  });

  it.each([null, 0, -1, 1.5])("returns null for the event id %o", (eventId) => {
    expect(getContentSiteEventHref("jp", eventId)).toBeNull();
  });

  it.each([undefined, "", "   "])("returns null when the base URL is %o", (baseUrl) => {
    mockEnv.PUBLIC_CONTENT_SITE_BASE_URL = baseUrl;

    expect(getContentSiteHomeHref()).toBeNull();
    expect(getContentSiteEventHref("jp", 100)).toBeNull();
  });
});
