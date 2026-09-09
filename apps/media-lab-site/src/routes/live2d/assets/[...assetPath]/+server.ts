import type { RequestHandler } from "./$types";
import {
  toLive2dAssetBucketUrlFromPath,
  toLive2dAssetRelayUrlFromPath,
  validateLive2dAssetPath
} from "$lib/live2d/associated-catalog";

const FETCH_TIMEOUT_MS = 10_000;
const ASSET_CACHE_CONTROL = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

type UpstreamFetchResult =
  | {
      status: "ok";
      response: Response;
      controller: AbortController;
      cleanup: () => void;
    }
  | { status: "client-aborted" | "timeout" | "error" };

const errorHeaders = (range = false): Headers => {
  const headers = new Headers({
    "cache-control": "no-store",
    "cross-origin-resource-policy": "same-origin",
    "x-content-type-options": "nosniff"
  });
  if (range) headers.set("accept-ranges", "none");
  return headers;
};

const errorResponse = (status: number, range = false): Response =>
  new Response(null, { status, headers: errorHeaders(range) });

const mapUpstreamStatus = (status: number): number => {
  if (status === 401 || status === 403 || status === 404) return 404;
  if (status === 429) return 503;
  if (status >= 500 && status <= 599) return 502;
  return 502;
};

const getSafeContentType = (fileName: string): string => {
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName.endsWith(".json")) return "application/json; charset=utf-8";
  if (lowerFileName.endsWith(".png")) return "image/png";
  if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerFileName.endsWith(".webp")) return "image/webp";
  if (lowerFileName.endsWith(".gif")) return "image/gif";
  if (lowerFileName.endsWith(".avif")) return "image/avif";
  if (lowerFileName.endsWith(".mp3")) return "audio/mpeg";
  return "application/octet-stream";
};

const createStreamingBody = (
  body: ReadableStream<Uint8Array>,
  upstreamController: AbortController,
  requestSignal: AbortSignal,
  cleanup: () => void
): ReadableStream<Uint8Array> => {
  const reader = body.getReader();
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  let settled = false;

  const finish = (): void => {
    if (settled) return;
    settled = true;
    cleanup();
  };

  const abort = (): void => {
    upstreamController.abort();
    void reader.cancel().catch(() => undefined);
    try {
      streamController?.error(new DOMException("Live2D asset request was aborted", "AbortError"));
    } catch {
      // The stream may already have been closed by its consumer.
    }
  };

  const onRequestAbort = (): void => {
    finish();
    abort();
  };

  requestSignal.addEventListener("abort", onRequestAbort, { once: true });

  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      if (requestSignal.aborted) onRequestAbort();
    },
    async pull(controller) {
      if (settled) return;

      try {
        const result = await reader.read();
        if (result.done) {
          finish();
          controller.close();
          return;
        }

        controller.enqueue(result.value);
      } catch (cause) {
        finish();
        try {
          controller.error(cause);
        } catch {
          // The request may have been cancelled at the same time.
        }
      }
    },
    cancel(reason) {
      finish();
      upstreamController.abort();
      return reader.cancel(reason);
    }
  });
};

const fetchUpstreamAsset = async (
  upstreamUrl: string,
  requestSignal: AbortSignal
): Promise<UpstreamFetchResult> => {
  const controller = new AbortController();
  let timedOut = false;
  let clientAborted = requestSignal.aborted;
  let handedOff = false;

  const abortFromRequest = (): void => {
    clientAborted = true;
    controller.abort();
  };
  let timeout: ReturnType<typeof setTimeout> | undefined = setTimeout(() => {
    timedOut = true;
    timeout = undefined;
    controller.abort();
  }, FETCH_TIMEOUT_MS);
  const clearTimeoutIfPending = (): void => {
    if (timeout === undefined) return;
    clearTimeout(timeout);
    timeout = undefined;
  };
  const cleanup = (): void => {
    clearTimeoutIfPending();
    requestSignal.removeEventListener("abort", abortFromRequest);
  };

  requestSignal.addEventListener("abort", abortFromRequest, { once: true });
  try {
    if (clientAborted) return { status: "client-aborted" };

    const response = await globalThis.fetch(upstreamUrl, {
      redirect: "error",
      signal: controller.signal
    });
    clearTimeoutIfPending();
    if (timedOut) return { status: "timeout" };
    if (requestSignal.aborted || clientAborted) return { status: "client-aborted" };

    handedOff = true;
    return { status: "ok", response, controller, cleanup };
  } catch {
    if (requestSignal.aborted || clientAborted) return { status: "client-aborted" };
    if (timedOut) return { status: "timeout" };
    return { status: "error" };
  } finally {
    if (!handedOff) cleanup();
  }
};

export const GET: RequestHandler = async ({ params, request, url }) => {
  if (url.search || url.hash) return errorResponse(404);
  if (request.headers.has("range")) return errorResponse(416, true);

  const parsedPath = validateLive2dAssetPath(params.assetPath);
  if (parsedPath.status !== "ok") return errorResponse(404);

  const canonicalRelayPath = toLive2dAssetRelayUrlFromPath(parsedPath.asset.path);
  if (!canonicalRelayPath || url.pathname !== canonicalRelayPath) {
    return errorResponse(404);
  }

  const upstreamUrl = toLive2dAssetBucketUrlFromPath(parsedPath.asset.path);
  if (!upstreamUrl) return errorResponse(404);

  const fetched = await fetchUpstreamAsset(upstreamUrl, request.signal);
  if (fetched.status !== "ok") {
    if (fetched.status === "client-aborted") return errorResponse(499);
    if (fetched.status === "timeout") return errorResponse(504);
    return errorResponse(502);
  }

  const { response, controller, cleanup } = fetched;
  if (response.status !== 200) {
    cleanup();
    if (response.body) void response.body.cancel().catch(() => undefined);
    return errorResponse(mapUpstreamStatus(response.status));
  }

  const headers = new Headers({
    "accept-ranges": "none",
    "cache-control": ASSET_CACHE_CONTROL,
    "content-type": getSafeContentType(parsedPath.asset.fileName),
    "cross-origin-resource-policy": "same-origin",
    "x-content-type-options": "nosniff"
  });
  const body = response.body
    ? createStreamingBody(response.body, controller, request.signal, cleanup)
    : (cleanup(), null);

  return new Response(body, { status: response.status, headers });
};
