import { describe, expect, it, vi } from "vitest";

vi.mock("$env/dynamic/public", () => ({ env: {} }));

import { getEventBannerAssetURL } from "./event-assets";

describe("getEventBannerAssetURL", () => {
  it("uses the confirmed regional banner path and bucket", () => {
    expect(getEventBannerAssetURL("event_123", "tw", "https://assets.example.test/")).toBe(
      "https://assets.example.test/sekai-tc-assets/home/banner/event_123/event_123.webp"
    );
  });

  it("does not create a malformed URL without a bundle or asset base", () => {
    expect(getEventBannerAssetURL("", "jp", "https://assets.example.test")).toBeNull();
    expect(getEventBannerAssetURL("event_123", "jp", "")).toBeNull();
  });
});
