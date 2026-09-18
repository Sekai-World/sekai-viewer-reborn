import { beforeEach, describe, expect, it, vi } from "vitest";

const { getGameNewsByRegionList, getMasterApiBaseUrl } = vi.hoisted(() => ({
  getGameNewsByRegionList: vi.fn(),
  getMasterApiBaseUrl: vi.fn(() => "https://master-api.test/api/v1")
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({ getGameNewsByRegionList }));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));

import {
  clearGameNewsCache,
  loadGameNews,
  normalizeGameNewsItem,
  parseGameNewsPayload,
  parseGameNewsTimestamp,
  resolveGameNewsTarget,
  GAME_NEWS_TAGS
} from "./game-news";

const makeItem = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 1,
  seq: 2,
  informationType: "normal",
  informationTag: "information",
  browseType: "internal",
  platform: "all",
  title: "Game news",
  path: "information/index.html?id=news_1",
  startAt: 1_725_000_000_000,
  endAt: 1_725_086_400_000,
  ...overrides
});

describe("game news normalization", () => {
  beforeEach(() => {
    clearGameNewsCache();
  });

  it("keeps exactly the seven legacy information tags", () => {
    expect(GAME_NEWS_TAGS).toEqual([
      "information",
      "event",
      "gacha",
      "music",
      "campaign",
      "bug",
      "update"
    ]);
  });

  it("parses safe second, millisecond, and ISO timestamps", () => {
    expect(parseGameNewsTimestamp(1_725_000_000)).toBe(1_725_000_000_000);
    expect(parseGameNewsTimestamp("1725000000000")).toBe(1_725_000_000_000);
    expect(parseGameNewsTimestamp("2024-08-30T12:00:00.000Z")).toBe(
      Date.parse("2024-08-30T12:00:00.000Z")
    );
    expect(parseGameNewsTimestamp(Number.NaN)).toBeNull();
    expect(parseGameNewsTimestamp(Number.POSITIVE_INFINITY)).toBeNull();
    expect(parseGameNewsTimestamp(" ")).toBeNull();
    expect(parseGameNewsTimestamp(null)).toBeNull();
    expect(parseGameNewsTimestamp("not-a-date")).toBeNull();
    expect(parseGameNewsTimestamp(Number.MAX_SAFE_INTEGER)).toBeNull();
  });

  it("normalizes a raw array item while preserving all legacy fields", () => {
    const item = normalizeGameNewsItem(
      makeItem({
        informationTag: " UPDATE ",
        endAt: undefined,
        displayOrder: "4",
        bannerAssetbundleName: " news/banner "
      }),
      "jp"
    );

    expect(item).toMatchObject({
      id: 1,
      seq: 2,
      displayOrder: 4,
      bannerAssetbundleName: "news/banner",
      informationType: "normal",
      informationTag: "update",
      browseType: "internal",
      platform: "all",
      title: "Game news",
      path: "information/index.html?id=news_1",
      startAt: 1_725_000_000_000,
      endAt: null,
      region: "jp",
      internalUrlKind: "iframe",
      externalUrl: null
    });
    expect(item).not.toHaveProperty("bodyHtml");
  });

  it("keeps optional API metadata nullable when absent or invalid", () => {
    expect(normalizeGameNewsItem(makeItem(), "jp")).toMatchObject({
      displayOrder: null,
      bannerAssetbundleName: null
    });
    expect(
      normalizeGameNewsItem(
        makeItem({ displayOrder: "not-a-number", bannerAssetbundleName: " " }),
        "jp"
      )
    ).toMatchObject({
      displayOrder: null,
      bannerAssetbundleName: null
    });
    expect(
      normalizeGameNewsItem(
        makeItem({ id: Number.MAX_SAFE_INTEGER + 1, displayOrder: "9007199254740992" }),
        "jp"
      )
    ).toBeNull();

    const itemWithoutEndAt = makeItem();
    delete itemWithoutEndAt.endAt;
    expect(normalizeGameNewsItem(itemWithoutEndAt, "jp")).toMatchObject({ endAt: null });
  });

  it("accepts both raw arrays and items envelopes", () => {
    const raw = parseGameNewsPayload([makeItem({ id: 1 })], "jp");
    const envelope = parseGameNewsPayload({ items: [makeItem({ id: 2 })] }, "jp");

    expect(raw?.[0].id).toBe(1);
    expect(envelope?.[0].id).toBe(2);
  });

  it("rejects invalid required fields and timestamps as a schema failure", () => {
    expect(normalizeGameNewsItem(null, "jp")).toBeNull();
    expect(parseGameNewsPayload([makeItem({ title: " " })], "jp")).toBeNull();
    expect(parseGameNewsPayload([makeItem({ informationTag: "unknown" })], "jp")).toBeNull();
    expect(parseGameNewsPayload([makeItem({ startAt: "invalid" })], "jp")).toBeNull();
    expect(parseGameNewsPayload({ items: "not-an-array" }, "jp")).toBeNull();
  });
});

describe("game news targets", () => {
  it("resolves region-specific internal paths", () => {
    expect(
      resolveGameNewsTarget({
        region: "en",
        browseType: "internal",
        path: "information/index.html?id=guide"
      })
    ).toEqual({
      kind: "internal",
      url: "https://n-production-web.sekai-en.com/information/index.html?id=guide"
    });

    expect(
      resolveGameNewsTarget({
        region: "tw",
        browseType: "internal",
        path: "information/index.html"
      })
    ).toEqual({
      kind: "internal",
      url: "https://production-web.sekai.colorfulpalette.org/information/index.html"
    });
  });

  it("classifies absolute HTTP(S) paths as external targets", () => {
    expect(
      resolveGameNewsTarget({
        region: "jp",
        browseType: "external",
        path: "https://news.example.test/article/1"
      })
    ).toEqual({ kind: "external", url: "https://news.example.test/article/1" });
  });

  it("rejects empty, unsupported, and malformed target paths", () => {
    expect(resolveGameNewsTarget({ region: "jp", browseType: "internal", path: " " })).toEqual({
      kind: "none",
      reason: "invalid-path"
    });
    expect(resolveGameNewsTarget({ region: "jp", browseType: "other", path: "/news" })).toEqual({
      kind: "none",
      reason: "unsupported-browse-type"
    });
    expect(
      resolveGameNewsTarget({ region: "jp", browseType: "internal", path: "http://[" })
    ).toEqual({ kind: "none", reason: "invalid-path" });
    expect(
      resolveGameNewsTarget({ region: "jp", browseType: "external", path: "http://[" })
    ).toEqual({ kind: "none", reason: "invalid-path" });
    expect(
      resolveGameNewsTarget({ region: "jp", browseType: "internal", path: "javascript:alert(1)" })
    ).toEqual({ kind: "none", reason: "unsafe-scheme" });
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,unsafe",
    "blob:https://evil.test/id",
    "ftp://evil.test/file"
  ])("rejects unsafe external schemes: %s", (path) => {
    expect(resolveGameNewsTarget({ region: "jp", browseType: "external", path })).toMatchObject({
      kind: "none"
    });
  });

  it("does not let an internal path replace the compatibility origin", () => {
    expect(
      resolveGameNewsTarget({
        region: "jp",
        browseType: "internal",
        path: "https://evil.example.test/news"
      })
    ).toEqual({ kind: "none", reason: "cross-origin-internal-path" });
  });

  it("exposes target fields for external and rejected normalized items", () => {
    expect(
      normalizeGameNewsItem(
        makeItem({ browseType: "external", path: "https://news.example.test/article/1" }),
        "jp"
      )
    ).toMatchObject({
      target: { kind: "external", url: "https://news.example.test/article/1" },
      internalUrl: null,
      externalUrl: "https://news.example.test/article/1",
      internalUrlKind: "none",
      externalUrlKind: "external"
    });

    expect(normalizeGameNewsItem(makeItem({ browseType: "other" }), "jp")).toMatchObject({
      target: { kind: "none", reason: "unsupported-browse-type" },
      internalUrl: null,
      externalUrl: null,
      internalUrlKind: "none",
      externalUrlKind: "none"
    });
  });
});

describe("loadGameNews", () => {
  beforeEach(() => {
    getGameNewsByRegionList.mockReset();
    getMasterApiBaseUrl.mockReset();
    getMasterApiBaseUrl.mockReturnValue("https://master-api.test/api/v1");
    clearGameNewsCache();
  });

  it("passes the master API base URL and region while caching each region", async () => {
    getGameNewsByRegionList.mockResolvedValue({ data: { items: [] } });

    await expect(loadGameNews("jp")).resolves.toEqual({ status: "empty" });
    await expect(loadGameNews("jp")).resolves.toEqual({ status: "empty" });
    await expect(loadGameNews("en")).resolves.toEqual({ status: "empty" });

    expect(getGameNewsByRegionList).toHaveBeenCalledTimes(2);
    expect(getGameNewsByRegionList).toHaveBeenNthCalledWith(1, {
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "jp" },
      query: { includeAll: true }
    });
    expect(getGameNewsByRegionList).toHaveBeenNthCalledWith(2, {
      baseUrl: "https://master-api.test/api/v1",
      path: { region: "en" },
      query: { includeAll: true }
    });
  });

  it("refreshes successful responses after the 60-second cache TTL", async () => {
    vi.useFakeTimers();
    try {
      getGameNewsByRegionList
        .mockResolvedValueOnce({ data: { items: [] } })
        .mockResolvedValueOnce({ data: { items: [makeItem({ id: 2 })] } });

      await expect(loadGameNews("jp")).resolves.toEqual({ status: "empty" });
      await expect(loadGameNews("jp")).resolves.toEqual({ status: "empty" });
      expect(getGameNewsByRegionList).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(60_000);

      await expect(loadGameNews("jp")).resolves.toMatchObject({
        status: "ready",
        items: [expect.objectContaining({ id: 2 })]
      });
      expect(getGameNewsByRegionList).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("normalizes items returned by the SDK", async () => {
    getGameNewsByRegionList.mockResolvedValue({ data: { items: [makeItem()] } });

    await expect(loadGameNews("jp")).resolves.toMatchObject({
      status: "ready",
      items: [
        expect.objectContaining({
          id: 1,
          informationTag: "information",
          region: "jp",
          internalUrlKind: "iframe"
        })
      ]
    });
  });

  it("distinguishes valid empty responses from SDK and schema errors", async () => {
    getGameNewsByRegionList.mockResolvedValue({ data: { items: [] } });
    await expect(loadGameNews("jp")).resolves.toEqual({ status: "empty" });

    clearGameNewsCache();
    getGameNewsByRegionList.mockResolvedValue({ error: { status: 503 } });
    await expect(loadGameNews("jp")).resolves.toEqual({ status: "error" });

    clearGameNewsCache();
    getGameNewsByRegionList.mockRejectedValue(new Error("network down"));
    await expect(loadGameNews("jp")).resolves.toEqual({ status: "error" });

    clearGameNewsCache();
    getGameNewsByRegionList.mockResolvedValue({ data: { items: [makeItem({ title: "" })] } });
    await expect(loadGameNews("jp")).resolves.toEqual({ status: "error" });
  });

  it("shares an in-flight request for the same region", async () => {
    let resolveResponse: ((value: { data: { items: unknown[] } }) => void) | undefined;
    const response = new Promise<{ data: { items: unknown[] } }>((resolve) => {
      resolveResponse = resolve;
    });
    getGameNewsByRegionList.mockReturnValue(response);

    const first = loadGameNews("jp");
    const second = loadGameNews("jp");

    expect(getGameNewsByRegionList).toHaveBeenCalledOnce();
    resolveResponse?.({ data: { items: [] } });

    await expect(first).resolves.toEqual({ status: "empty" });
    await expect(second).resolves.toEqual({ status: "empty" });
  });

  it("does not restore a cache entry after an in-flight request is cleared", async () => {
    let resolveResponse: ((value: { data: { items: unknown[] } }) => void) | undefined;
    const response = new Promise<{ data: { items: unknown[] } }>((resolve) => {
      resolveResponse = resolve;
    });
    getGameNewsByRegionList.mockReturnValueOnce(response).mockResolvedValueOnce({
      data: { items: [] }
    });

    const request = loadGameNews("jp");
    clearGameNewsCache();
    resolveResponse?.({ data: { items: [] } });

    await expect(request).resolves.toEqual({ status: "empty" });
    await expect(loadGameNews("jp")).resolves.toEqual({ status: "empty" });
    expect(getGameNewsByRegionList).toHaveBeenCalledTimes(2);
  });

  it("returns unavailable for an unsupported region before resolving configuration", async () => {
    const unsupportedRegion = "global" as unknown as Parameters<typeof loadGameNews>[0];

    await expect(loadGameNews(unsupportedRegion)).resolves.toEqual({ status: "unavailable" });
    expect(getMasterApiBaseUrl).not.toHaveBeenCalled();
    expect(getGameNewsByRegionList).not.toHaveBeenCalled();
  });

  it("returns unavailable without calling the SDK when the master API is not configured", async () => {
    getMasterApiBaseUrl.mockImplementation(() => {
      throw new Error("Missing required environment variable: SEKAI_MASTER_API_BASE_URL");
    });

    await expect(loadGameNews("jp")).resolves.toEqual({ status: "unavailable" });
    expect(getGameNewsByRegionList).not.toHaveBeenCalled();
  });
});
