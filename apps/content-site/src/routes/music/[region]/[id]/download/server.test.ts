import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  getMusicsByRegionByIdDetail: vi.fn(),
  getMusicsRegionsByIdAvailability: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => sdk);

const config = vi.hoisted(() => ({
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test"),
  getInternalRemoteAssetBaseUrl: vi.fn(() => "https://assets.example.test")
}));
vi.mock("$lib/server/config", () => config);

const tagLib = vi.hoisted(() => {
  const file = {
    tag: () => ({
      setTitle: vi.fn(),
      setArtist: vi.fn(),
      setAlbum: vi.fn(),
      setComment: vi.fn()
    }),
    setProperty: vi.fn(),
    setPictures: vi.fn(),
    save: vi.fn()
  };
  const edit = vi.fn(
    async (_audio: Uint8Array, updateFile: (value: typeof file) => void | Promise<void>) => {
      await updateFile(file);
      return new Uint8Array([9, 9]);
    }
  );

  return { edit };
});
vi.mock("taglib-wasm", () => ({ TagLib: { initialize: async () => ({ edit: tagLib.edit }) } }));

import { GET } from "./+server";

const MUSIC_ID = "123";
const VOCAL_ASSET_BUNDLE = "vocal-123";
const JACKET_ASSET_BUNDLE = "jacket-123";
const ASSET_BASE_URL = "https://assets.example.test";

const fetchFn = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method === "HEAD") {
    return new Response(null);
  }

  return new Response(new Uint8Array([1, 2, 3]));
});

const getRequestedUrls = (): Array<{ url: string; method: string }> =>
  fetchFn.mock.calls.map(([input, init]) => ({
    url: input instanceof URL ? input.href : input instanceof Request ? input.url : input,
    method: init?.method ?? (input instanceof Request ? input.method : "GET")
  }));

const download = async (availabilityResponse: unknown, mode: "short" | "long" = "long") => {
  sdk.getMusicsRegionsByIdAvailability.mockResolvedValue(availabilityResponse);
  const requestUrl = `https://viewer.example/music/en/${MUSIC_ID}/download?mode=${mode}`;

  return GET({
    params: { region: "en", id: MUSIC_ID },
    request: new Request(requestUrl),
    url: new URL(requestUrl),
    fetch: fetchFn
  } as unknown as Parameters<typeof GET>[0]);
};

const expectedAudioUrl = (region: "jp" | "en", mode: "short" | "long"): string =>
  `${ASSET_BASE_URL}/sekai-${region}-assets/music/${mode}/${VOCAL_ASSET_BUNDLE}/${VOCAL_ASSET_BUNDLE}${mode === "short" ? "_short" : ""}.mp3`;

const expectedCoverUrl = (region: "jp" | "en"): string =>
  `${ASSET_BASE_URL}/sekai-${region}-assets/music/jacket/${JACKET_ASSET_BUNDLE}/${JACKET_ASSET_BUNDLE}.webp`;

const expectAssetRequests = (region: "jp" | "en", mode: "short" | "long"): void => {
  const requested = getRequestedUrls();
  expect(requested).toContainEqual({ url: expectedAudioUrl(region, mode), method: "GET" });
  expect(requested).toContainEqual({ url: expectedCoverUrl(region), method: "GET" });
};

beforeEach(() => {
  sdk.getMusicsByRegionByIdDetail.mockReset();
  sdk.getMusicsByRegionByIdDetail.mockResolvedValue({
    data: {
      music: { id: MUSIC_ID, title: "Test song", assetbundleName: JACKET_ASSET_BUNDLE },
      vocals: [
        {
          id: "456",
          musicId: MUSIC_ID,
          assetbundleName: VOCAL_ASSET_BUNDLE
        }
      ]
    }
  });
  sdk.getMusicsRegionsByIdAvailability.mockReset();
  fetchFn.mockReset();
  fetchFn.mockImplementation(async (_input, init) =>
    init?.method === "HEAD" ? new Response(null) : new Response(new Uint8Array([1, 2, 3]))
  );
});

describe("music download asset availability", () => {
  it.each(["short", "long"] as const)(
    "uses JP audio and cover assets for an en download when JP is available (%s mode)",
    async (mode) => {
      const response = await download({ data: { regions: ["en", "jp"] } }, mode);

      expect(response.status).toBe(200);
      expectAssetRequests("jp", mode);
    }
  );

  it("uses the current region when JP is not listed", async () => {
    const response = await download({ data: { regions: ["en"] } });

    expect(response.status).toBe(200);
    expectAssetRequests("en", "long");
  });

  it("filters unsupported and non-string regions while recognizing JP", async () => {
    const response = await download({ data: { regions: ["en", "unknown", 42, null, "jp"] } });

    expect(response.status).toBe(200);
    expectAssetRequests("jp", "long");
  });

  it("continues to accept the legacy root-array availability response", async () => {
    const response = await download({ data: ["en", "jp"] });

    expect(response.status).toBe(200);
    expectAssetRequests("jp", "long");
  });

  it.each([
    ["an API error", { error: { status: 500 } }],
    ["missing availability data", {}],
    ["missing regions", { data: {} }],
    ["non-array regions", { data: { regions: "jp" } }]
  ])("falls back to the current region for %s", async (_description, availabilityResponse) => {
    const response = await download(availabilityResponse);

    expect(response.status).toBe(200);
    expectAssetRequests("en", "long");
  });
});
