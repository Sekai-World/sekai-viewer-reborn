import { describe, expect, it, vi } from "vitest";
import type { MusicVideoDescriptor } from "$lib/domain/music-detail";
import {
  getMusicVideoListingURL,
  getMusicVideoPrefix,
  resolveMusicVideoAssetURL
} from "./music-video";
import { getMusicAssetServer } from "./index";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "/storage" }
}));

const descriptor = (overrides: Partial<MusicVideoDescriptor> = {}): MusicVideoDescriptor => ({
  category: "mv_2d",
  assetBundleName: "0008",
  musicVocalId: null,
  ...overrides
});

const listing = (keys: string[], truncated = false, token?: string): string => `
  <ListBucketResult>
    ${keys.map((key) => `<Contents><Key>${key}</Key></Contents>`).join("")}
    <IsTruncated>${truncated}</IsTruncated>
    ${token ? `<NextContinuationToken>${token}</NextContinuationToken>` : ""}
  </ListBucketResult>
`;

describe("music video asset listing", () => {
  it("builds a JP-bucket listing URL with the verified category prefix", () => {
    const prefix = getMusicVideoPrefix(descriptor());
    const url = new URL(
      getMusicVideoListingURL(prefix, undefined, "/storage"),
      "https://local.test"
    );

    expect(url.pathname).toBe("/storage/sekai-jp-assets/");
    expect(url.searchParams.get("list-type")).toBe("2");
    expect(url.searchParams.get("delimiter")).toBe("/");
    expect(url.searchParams.get("max-keys")).toBe("500");
    expect(url.searchParams.get("prefix")).toBe("live/2dmode/sekai_mv/0008/");
  });

  it("resolves the actual MP4 key from the listing instead of guessing its filename", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(
          listing([
            "live/2dmode/sekai_mv/0008/0008.wmv",
            "live/2dmode/sekai_mv/0008/movie_actual_name.mp4"
          ]),
          { status: 200 }
        )
      );

    await expect(
      resolveMusicVideoAssetURL(descriptor(), { fetcher, baseUrlOverride: "/storage" })
    ).resolves.toBe("/storage/sekai-jp-assets/live/2dmode/sekai_mv/0008/movie_actual_name.mp4");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("uses the original MV bucket prefix and follows bounded continuation pages", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(listing(["live/2dmode/original_mv/orig/a.webm"], true, "next"))
      )
      .mockResolvedValueOnce(new Response(listing(["live/2dmode/original_mv/orig/a-final.mp4"])));

    await expect(
      resolveMusicVideoAssetURL(descriptor({ category: "original", assetBundleName: "orig" }), {
        fetcher,
        baseUrlOverride: "/storage"
      })
    ).resolves.toContain("/original_mv/orig/a-final.mp4");
    expect(fetcher.mock.calls[1]?.[0]).toContain("continuation-token=next");
  });

  it("rejects malformed XML, invalid keys, and aborted requests", async () => {
    const malformedFetcher = vi.fn().mockResolvedValue(new Response("<bad>", { status: 200 }));
    await expect(
      resolveMusicVideoAssetURL(descriptor(), {
        fetcher: malformedFetcher,
        baseUrlOverride: "/storage"
      })
    ).rejects.toThrow("malformed XML");

    const invalidFetcher = vi
      .fn()
      .mockResolvedValue(new Response(listing(["other/path/movie.mp4"]), { status: 200 }));
    await expect(
      resolveMusicVideoAssetURL(descriptor(), {
        fetcher: invalidFetcher,
        baseUrlOverride: "/storage"
      })
    ).rejects.toThrow("no MP4");

    const controller = new AbortController();
    controller.abort();
    await expect(
      resolveMusicVideoAssetURL(descriptor(), {
        fetcher: vi.fn(),
        signal: controller.signal,
        baseUrlOverride: "/storage"
      })
    ).rejects.toBeDefined();
  });

  it("rejects listings when the browser XML parser is unavailable", async () => {
    vi.stubGlobal("DOMParser", undefined);
    try {
      await expect(
        resolveMusicVideoAssetURL(descriptor(), {
          fetcher: vi.fn().mockResolvedValue(new Response(listing([]))),
          baseUrlOverride: "/storage"
        })
      ).rejects.toThrow("require a browser XML parser");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("reports unsuccessful listing responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 }));

    await expect(
      resolveMusicVideoAssetURL(descriptor(), { fetcher, baseUrlOverride: "/storage" })
    ).rejects.toThrow("status 503");
  });

  it("uses JP for shared music and the current region for exclusive music", async () => {
    for (const availableRegions of [["jp", "en"], ["en"]] as const) {
      const server = getMusicAssetServer("en", [...availableRegions]);
      const fetcher = vi
        .fn()
        .mockResolvedValue(new Response(listing(["live/2dmode/sekai_mv/0008/0008.mp4"])));
      const source = await resolveMusicVideoAssetURL(descriptor(), {
        server,
        fetcher,
        baseUrlOverride: "/storage"
      });
      expect(source).toBe(`/storage/sekai-${server}-assets/live/2dmode/sekai_mv/0008/0008.mp4`);
      expect(fetcher.mock.calls[0]?.[0]).toContain(`/sekai-${server}-assets/?`);
    }
  });

  it.each(["", "../bad", "/0008", "a/b", "a?x", "a#x", "a%2f", "a\\b", " 0008 "])(
    "rejects unsafe bundle %j before fetching",
    async (assetBundleName) => {
      const fetcher = vi.fn();
      await expect(
        resolveMusicVideoAssetURL(descriptor({ assetBundleName }), { fetcher })
      ).rejects.toThrow("Invalid");
      expect(fetcher).not.toHaveBeenCalled();
    }
  );

  it.each([
    "../escape.mp4",
    "%2e%2e.mp4",
    "sub/file.mp4",
    "file.mp4?x",
    "file.mp4#x",
    "file\\name.mp4"
  ])("rejects unsafe listing key %j", async (file) => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(listing([`live/2dmode/sekai_mv/0008/${file}`])));
    await expect(resolveMusicVideoAssetURL(descriptor(), { fetcher })).rejects.toThrow("no MP4");
  });

  it("bounds pagination and rejects truncated pages without a usable continuation token", async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(
        async () => new Response(listing([], true, `page-${fetcher.mock.calls.length}`))
      );
    await expect(resolveMusicVideoAssetURL(descriptor(), { fetcher })).rejects.toThrow(
      "pagination limit"
    );
    expect(fetcher).toHaveBeenCalledTimes(20);
    await expect(
      resolveMusicVideoAssetURL(descriptor(), {
        fetcher: vi.fn().mockResolvedValue(new Response(listing([], true)))
      })
    ).rejects.toThrow("continuation token");
  });

  it("cancels in-flight listing fetches with a bounded timeout", async () => {
    vi.useFakeTimers();
    try {
      const fetcher = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), {
              once: true
            });
          })
      );
      const request = resolveMusicVideoAssetURL(descriptor(), { fetcher, timeoutMs: 50 });
      const assertion = expect(request).rejects.toThrow("aborted");
      await vi.advanceTimersByTimeAsync(50);
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
      const controller = new AbortController();
      const cancelled = resolveMusicVideoAssetURL(descriptor(), {
        fetcher,
        signal: controller.signal
      });
      const cancelledAssertion = expect(cancelled).rejects.toThrow("aborted");
      controller.abort();
      await cancelledAssertion;
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
