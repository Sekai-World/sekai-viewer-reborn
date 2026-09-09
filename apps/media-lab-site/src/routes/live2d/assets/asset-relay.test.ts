import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./[...assetPath]/+server";

type AssetGetEvent = Parameters<typeof GET>[0];

const encodeAssetPath = (assetPath: string): string =>
  assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const buildEvent = (
  assetPath: string | undefined,
  requestInit: RequestInit = {},
  requestUrl = `http://localhost/live2d/assets/${
    assetPath ? encodeAssetPath(assetPath) : "model/v1/sample/sample.model3.json"
  }`
) =>
  ({
    params: { assetPath },
    request: new Request(requestUrl, requestInit),
    url: new URL(requestUrl)
  }) as unknown as AssetGetEvent;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Live2D asset relay route", () => {
  it.each([
    undefined,
    "",
    "model",
    "model/",
    "model//file.moc3",
    "model/./file.moc3",
    "model/../file.moc3",
    "model/path with spaces/file.moc3",
    "model/file%20name.moc3",
    "model/file.moc3?cache=1",
    "model/file.moc3#fragment",
    "model\\file.moc3",
    "other/file.moc3",
    "/model/file.moc3",
    "//storage.sekai.best/model/file.moc3",
    "https://storage.sekai.best/sekai-live2d-assets/model/file.moc3",
    " model/file.moc3",
    "model/file.moc3 "
  ])(
    "returns 404 without fetching an invalid asset path (%s)",
    async (assetPath: string | undefined) => {
      const upstreamFetch = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", upstreamFetch);

      const response = await GET(buildEvent(assetPath));

      expect(response.status).toBe(404);
      expect(upstreamFetch).not.toHaveBeenCalled();
    }
  );

  it.each<[string, string]>([
    ["model/v1/sample/file.moc3", "/live2d/assets/model/v1/sample%2Ffile.moc3"],
    ["model/v1/file.moc3", "/live2d/assets/model/v1/%2e%2e/file.moc3"]
  ])(
    "rejects a noncanonical encoded asset pathname (%s)",
    async (assetPath: string, rawPathname: string) => {
      const upstreamFetch = vi.fn<typeof fetch>();
      vi.stubGlobal("fetch", upstreamFetch);

      const response = await GET({
        ...buildEvent(assetPath),
        url: { pathname: rawPathname, search: "", hash: "" }
      } as unknown as AssetGetEvent);

      expect(response.status).toBe(404);
      expect(upstreamFetch).not.toHaveBeenCalled();
    }
  );

  it("returns 404 without fetching a query or range request", async () => {
    const upstreamFetch = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", upstreamFetch);

    const queryResponse = await GET(
      buildEvent(
        "model/v1/sample/sample.model3.json",
        {},
        "http://localhost/live2d/assets/model/v1/sample/sample.model3.json?cache=1"
      )
    );
    const rangeResponse = await GET(
      buildEvent("model/v1/sample/sample.model3.json", {
        headers: { Range: "bytes=0-1" }
      })
    );

    expect(queryResponse.status).toBe(404);
    expect(rangeResponse.status).toBe(416);
    expect(rangeResponse.headers.get("accept-ranges")).toBe("none");
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it("streams the upstream body with fixed headers and no forwarded request headers", async () => {
    let pulls = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) {
          controller.enqueue(new TextEncoder().encode("asset"));
        } else {
          controller.close();
        }
      }
    });
    const upstreamFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(body, {
        status: 200,
        headers: {
          "content-type": "text/html",
          "content-length": "5",
          "content-encoding": "gzip",
          "set-cookie": "secret=1"
        }
      })
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(
      buildEvent("motion/v1/sample/face_ worry_01.motion3.json", {
        headers: { Cookie: "secret=1", "X-Forwarded-For": "evil" }
      })
    );

    expect(upstreamFetch).toHaveBeenCalledWith(
      "https://storage.sekai.best/sekai-live2d-assets/live2d/motion/v1/sample/face_%20worry_01.motion3.json",
      { redirect: "error", signal: expect.any(AbortSignal) }
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800"
    );
    expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("accept-ranges")).toBe("none");
    expect(response.headers.get("content-length")).toBeNull();
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.text()).resolves.toBe("asset");
    expect(pulls).toBe(2);
    expect(upstreamFetch.mock.calls[0]?.[1]).not.toHaveProperty("headers");
  });

  it.each<[number, number]>([
    [401, 404],
    [403, 404],
    [404, 404],
    [429, 503],
    [500, 502],
    [503, 502],
    [400, 502],
    [206, 502]
  ])("maps upstream status %s to %s", async (upstreamStatus: number, expectedStatus: number) => {
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: upstreamStatus }));
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(buildEvent("model/v1/sample/sample.model3.json"));

    expect(response.status).toBe(expectedStatus);
  });

  it("maps an upstream timeout to 504 and aborts its fetch", async () => {
    vi.useFakeTimers();
    const upstreamFetch = vi.fn<typeof fetch>().mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const pending = GET(buildEvent("model/v1/sample/sample.model3.json"));
    await vi.advanceTimersByTimeAsync(10_000);

    await expect(pending).resolves.toMatchObject({ status: 504 });
    expect(upstreamFetch.mock.calls[0]?.[1]).toMatchObject({
      redirect: "error",
      signal: expect.any(AbortSignal)
    });
    expect((upstreamFetch.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("does not abort a valid streamed body after the headers timeout", async () => {
    vi.useFakeTimers();
    const clientController = new AbortController();
    const body = new ReadableStream<Uint8Array>({
      pull() {
        return new Promise(() => undefined);
      }
    });
    const upstreamFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(body, { status: 200 }));
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(
      buildEvent("model/v1/sample/sample.model3.json", { signal: clientController.signal })
    );
    await vi.advanceTimersByTimeAsync(10_000);

    expect(response.status).toBe(200);
    expect((upstreamFetch.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(false);
    clientController.abort();
    expect((upstreamFetch.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("propagates a client abort and returns 499 without buffering", async () => {
    const clientController = new AbortController();
    const upstreamFetch = vi.fn<typeof fetch>().mockImplementation(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        })
    );
    vi.stubGlobal("fetch", upstreamFetch);

    const pending = GET(
      buildEvent("model/v1/sample/sample.model3.json", { signal: clientController.signal })
    );
    clientController.abort();

    await expect(pending).resolves.toMatchObject({ status: 499 });
    expect((upstreamFetch.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true);
  });

  it("maps unexpected fetch failures to 502", async () => {
    const upstreamFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", upstreamFetch);

    const response = await GET(buildEvent("model/v1/sample/sample.model3.json"));

    expect(response.status).toBe(502);
  });
});
