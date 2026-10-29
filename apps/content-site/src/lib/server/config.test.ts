import { beforeEach, describe, expect, it, vi } from "vitest";

const envState = vi.hoisted(() => ({
  SEKAI_API_BASE_URL: "",
  SEKAI_MASTER_API_BASE_URL: "",
  SEKAI_REMOTE_ASSET_BASE_URL: ""
}));

vi.mock("$app/env/private", () => envState);

describe("server environment configuration", () => {
  beforeEach(() => {
    vi.resetModules();
    envState.SEKAI_API_BASE_URL = "";
    envState.SEKAI_MASTER_API_BASE_URL = "";
    envState.SEKAI_REMOTE_ASSET_BASE_URL = "";
  });

  it("requires and normalizes the API base URLs", async () => {
    envState.SEKAI_MASTER_API_BASE_URL = " https://master.example.test/api/v1/// ";
    envState.SEKAI_API_BASE_URL = " https://api.example.test/api/// ";
    const { getMasterApiBaseUrl, getSekaiApiBaseUrl } = await import("./config.js");

    expect(getMasterApiBaseUrl()).toBe("https://master.example.test/api/v1");
    expect(getSekaiApiBaseUrl()).toBe("https://api.example.test/api");
  });

  it("rejects missing and whitespace-only required values", async () => {
    envState.SEKAI_API_BASE_URL = "   ";
    const { getMasterApiBaseUrl, getSekaiApiBaseUrl } = await import("./config.js");

    expect(getMasterApiBaseUrl).toThrow(
      "Missing required environment variable: SEKAI_MASTER_API_BASE_URL"
    );

    expect(getSekaiApiBaseUrl).toThrow(
      "Environment variable SEKAI_API_BASE_URL must not be empty."
    );
  });

  it("returns null when the optional asset URL is absent or blank", async () => {
    const { getInternalRemoteAssetBaseUrl } = await import("./config.js");
    expect(getInternalRemoteAssetBaseUrl()).toBeNull();

    vi.resetModules();
    envState.SEKAI_REMOTE_ASSET_BASE_URL = "  ";
    const { getInternalRemoteAssetBaseUrl: getBlankRemoteAssetBaseUrl } =
      await import("./config.js");
    expect(getBlankRemoteAssetBaseUrl()).toBeNull();
  });

  it("normalizes the optional asset URL and preserves its root path", async () => {
    envState.SEKAI_REMOTE_ASSET_BASE_URL = " https://assets.example.test/// ";
    const { getInternalRemoteAssetBaseUrl } = await import("./config.js");
    expect(getInternalRemoteAssetBaseUrl()).toBe("https://assets.example.test");

    vi.resetModules();
    envState.SEKAI_REMOTE_ASSET_BASE_URL = "/";
    const { getInternalRemoteAssetBaseUrl: getRootRemoteAssetBaseUrl } =
      await import("./config.js");
    expect(getRootRemoteAssetBaseUrl()).toBe("/");
  });
});
