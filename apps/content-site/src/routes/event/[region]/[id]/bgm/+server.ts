import { getEventsByRegionById } from "@platform/sekai-master-api-sdk";
import type { SupportedRegion } from "$lib/regions";
import { error, type RequestEvent, type RequestHandler } from "@sveltejs/kit";
import { getEventBgmAssetURL, getEventLogoAssetURL } from "$lib/assets";
import { normalizeRegion } from "$lib/region";
import {
  publishDownloadTask,
  registerDownloadTaskAbort,
  type DownloadTaskSnapshot,
  type DownloadTaskState,
  unregisterDownloadTaskAbort
} from "$lib/server/download-progress";
import { getInternalRemoteAssetBaseUrl, getMasterApiBaseUrl } from "$lib/server/config";
import { parseEventDetail } from "$lib/server/event-detail";
import { TagLib, type Picture } from "taglib-wasm";

const SUPPORTED_DOWNLOAD_FORMATS = new Set(["mp3", "wav"]);
const PARALLEL_DOWNLOAD_MIN_BYTES = 8 * 1024 * 1024;
const PARALLEL_DOWNLOAD_CHUNK_BYTES = 4 * 1024 * 1024;
const PARALLEL_DOWNLOAD_CONCURRENCY = 6;

let tagLibPromise: Promise<TagLib> | null = null;

const getTagLib = (): Promise<TagLib> => {
  if (!tagLibPromise) {
    tagLibPromise = TagLib.initialize();
  }

  return tagLibPromise;
};

const sanitizeFilename = (value: string): string => {
  const sanitized = Array.from(value.trim(), (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    const isControlCharacter = codePoint <= 0x1f || codePoint === 0x7f;
    return isControlCharacter || '<>:"/\\|?*'.includes(character) ? "-" : character;
  })
    .join("")
    .replace(/\s+/g, " ")
    .slice(0, 160);

  return sanitized || "event-bgm";
};

const getAudioMimeType = (format: string): string => {
  if (format === "wav") {
    return "audio/wav";
  }

  return "audio/mpeg";
};

const isAbortError = (value: unknown): boolean =>
  value instanceof Error && value.name === "AbortError";

const ensureNotAborted = (signal: AbortSignal): void => {
  if (signal.aborted) {
    throw new DOMException("The operation was aborted.", "AbortError");
  }
};

const createProgressReporter = (taskId: string | null) => {
  let lastProgress = -1;
  let lastDetail = "";
  let lastState: DownloadTaskState | "" = "";

  const report = (
    state: DownloadTaskState,
    progress: number,
    detail = ""
  ): DownloadTaskSnapshot | null => {
    if (!taskId) {
      return null;
    }

    const normalizedProgress = Math.max(0, Math.min(100, Math.round(progress)));
    if (state === lastState && normalizedProgress === lastProgress && detail === lastDetail) {
      return null;
    }

    lastState = state;
    lastProgress = normalizedProgress;
    lastDetail = detail;
    return publishDownloadTask(taskId, {
      state,
      progress: normalizedProgress,
      detail
    });
  };

  return {
    waiting(detail = ""): void {
      report("waiting", 0, detail);
    },
    fetching(progress: number, detail = ""): void {
      report("fetching", progress, detail);
    },
    tagging(progress: number, detail = ""): void {
      report("tagging", progress, detail);
    },
    finalizing(progress: number, detail = ""): void {
      report("finalizing", progress, detail);
    },
    done(detail = ""): void {
      report("done", 100, detail);
    },
    error(detail = ""): void {
      report("error", 100, detail);
    }
  };
};

const readBinaryResponse = async (
  response: Response,
  onChunk?: (loadedBytes: number, totalBytes: number | null) => void
): Promise<Uint8Array> => {
  const totalBytesHeader = Number(response.headers.get("content-length") ?? "");
  const totalBytes =
    Number.isFinite(totalBytesHeader) && totalBytesHeader > 0 ? totalBytesHeader : null;

  if (!response.body) {
    const buffer = new Uint8Array(await response.arrayBuffer());
    onChunk?.(buffer.byteLength, totalBytes ?? buffer.byteLength);
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (!value) {
      continue;
    }

    chunks.push(value);
    loadedBytes += value.byteLength;
    onChunk?.(loadedBytes, totalBytes);
  }

  const merged = new Uint8Array(loadedBytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return merged;
};

const fetchBinary = async (
  fetchFn: RequestEvent["fetch"],
  url: string,
  signal: AbortSignal,
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void
): Promise<Uint8Array> => {
  ensureNotAborted(signal);
  const response = await fetchFn(url, { signal });
  if (!response.ok) {
    throw error(response.status, "Failed to fetch remote asset.");
  }

  return readBinaryResponse(response, onProgress);
};

const probeParallelDownload = async (
  fetchFn: RequestEvent["fetch"],
  url: string,
  signal: AbortSignal
): Promise<{ size: number; supportsRanges: boolean } | null> => {
  ensureNotAborted(signal);
  const response = await fetchFn(url, { method: "HEAD", signal });
  if (!response.ok) {
    return null;
  }

  const size = Number(response.headers.get("content-length") ?? "");
  if (!Number.isFinite(size) || size <= 0) {
    return null;
  }

  const supportsRanges =
    response.headers.get("accept-ranges")?.toLowerCase().includes("bytes") ?? false;

  return { size, supportsRanges };
};

const fetchBinaryRange = async (
  fetchFn: RequestEvent["fetch"],
  url: string,
  start: number,
  end: number,
  signal: AbortSignal,
  onProgress?: (loadedBytes: number) => void
): Promise<Uint8Array> => {
  ensureNotAborted(signal);
  const response = await fetchFn(url, {
    headers: {
      range: `bytes=${start}-${end}`
    },
    signal
  });

  if (response.status !== 206) {
    throw new Error(`Expected partial content for ${url}, got ${response.status}`);
  }

  const chunk = await readBinaryResponse(response, (loadedBytes) => {
    onProgress?.(loadedBytes);
  });
  const expectedLength = end - start + 1;
  if (chunk.byteLength !== expectedLength) {
    throw new Error(`Expected ${expectedLength} bytes for ${url}, got ${chunk.byteLength}`);
  }

  return chunk;
};

const fetchBinaryWithAcceleration = async ({
  fetchFn,
  url,
  signal,
  onProgress
}: {
  fetchFn: RequestEvent["fetch"];
  url: string;
  signal: AbortSignal;
  onProgress?: (loadedBytes: number, totalBytes: number | null) => void;
}): Promise<Uint8Array> => {
  const probe = await probeParallelDownload(fetchFn, url, signal).catch((probeError) => {
    if (isAbortError(probeError)) {
      throw probeError;
    }

    return null;
  });

  if (!probe || !probe.supportsRanges || probe.size < PARALLEL_DOWNLOAD_MIN_BYTES) {
    return fetchBinary(fetchFn, url, signal, onProgress);
  }

  const ranges: Array<{ start: number; end: number }> = [];
  for (let start = 0; start < probe.size; start += PARALLEL_DOWNLOAD_CHUNK_BYTES) {
    ranges.push({
      start,
      end: Math.min(start + PARALLEL_DOWNLOAD_CHUNK_BYTES - 1, probe.size - 1)
    });
  }

  const merged = new Uint8Array(probe.size);
  let nextRangeIndex = 0;
  let loadedBytes = 0;

  try {
    await Promise.all(
      Array.from({ length: Math.min(PARALLEL_DOWNLOAD_CONCURRENCY, ranges.length) }, async () => {
        while (nextRangeIndex < ranges.length) {
          const currentIndex = nextRangeIndex;
          nextRangeIndex += 1;
          const { start, end } = ranges[currentIndex];
          let previousLoadedBytes = 0;
          const chunk = await fetchBinaryRange(
            fetchFn,
            url,
            start,
            end,
            signal,
            (rangeLoadedBytes) => {
              const delta = rangeLoadedBytes - previousLoadedBytes;
              if (delta <= 0) {
                return;
              }

              previousLoadedBytes = rangeLoadedBytes;
              loadedBytes += delta;
              onProgress?.(loadedBytes, probe.size);
            }
          );
          merged.set(chunk, start);
        }
      })
    );

    onProgress?.(probe.size, probe.size);
    return merged;
  } catch (parallelDownloadError) {
    if (isAbortError(parallelDownloadError)) {
      throw parallelDownloadError;
    }

    console.warn("Falling back to single-request audio download.", parallelDownloadError);
    return fetchBinary(fetchFn, url, signal, onProgress);
  }
};

export const GET: RequestHandler = async ({ params, fetch, request, url }) => {
  const eventId = params.id?.trim() ?? "";
  if (!eventId) {
    throw error(400, "Missing event id.");
  }

  const region: SupportedRegion = normalizeRegion(params.region);
  const format = (url.searchParams.get("format") ?? "mp3").trim().toLowerCase();
  if (!SUPPORTED_DOWNLOAD_FORMATS.has(format)) {
    throw error(400, "Unsupported BGM download format.");
  }

  const taskId = url.searchParams.get("taskId")?.trim() || null;
  const progress = createProgressReporter(taskId);
  const abortController = new AbortController();
  const abortFromRequest = (): void => {
    abortController.abort();
  };

  if (taskId) {
    registerDownloadTaskAbort(taskId, () => {
      abortController.abort();
    });
  }
  request.signal.addEventListener("abort", abortFromRequest, { once: true });

  try {
    progress.waiting("preparing");

    const baseUrl = getMasterApiBaseUrl();
    const response = await getEventsByRegionById({
      baseUrl,
      path: { region, id: eventId }
    });

    if (response.error) {
      throw error(404, "Event not found.");
    }

    const event = parseEventDetail(response.data);
    if (!event?.bgmAssetbundleName) {
      throw error(404, "Event BGM not available.");
    }

    const internalRemoteAssetBaseUrl = getInternalRemoteAssetBaseUrl();
    const audioUrl = getEventBgmAssetURL(
      event.bgmAssetbundleName,
      region,
      format,
      internalRemoteAssetBaseUrl
    );
    const coverUrl = event.assetBundleName
      ? getEventLogoAssetURL(event.assetBundleName, region, "png", internalRemoteAssetBaseUrl)
      : null;

    progress.fetching(2, "fetching-audio");
    const audioBytes = await fetchBinaryWithAcceleration({
      fetchFn: fetch,
      url: audioUrl,
      signal: abortController.signal,
      onProgress: (loadedBytes, totalBytes) => {
        if (!totalBytes || totalBytes <= 0) {
          return;
        }

        const ratio = loadedBytes / totalBytes;
        progress.fetching(2 + ratio * 82, "fetching-audio");
      }
    });

    progress.fetching(86, "fetching-cover");
    const [coverBytes, tagLib] = await Promise.all([
      coverUrl
        ? fetchBinary(fetch, coverUrl, abortController.signal).catch((coverError) => {
            if (isAbortError(coverError)) {
              throw coverError;
            }

            return null;
          })
        : Promise.resolve(null),
      getTagLib()
    ]);

    ensureNotAborted(abortController.signal);
    progress.tagging(92, "writing-metadata");
    const taggedAudio = await tagLib
      .edit(audioBytes, async (file) => {
        const tag = file.tag();
        tag.setTitle(event.title);

        if (event.unitName) {
          tag.setArtist(event.unitName);
          file.setProperty("albumArtist", event.unitName);
        }

        tag.setAlbum(event.title);

        if (coverBytes) {
          file.setPictures([
            {
              data: coverBytes,
              mimeType: "image/png",
              type: "FrontCover",
              description: event.title
            } satisfies Picture
          ]);
        }

        file.save();
      })
      .catch((routeError) => {
        console.error("Failed to embed event BGM metadata on the server.", routeError);
        return audioBytes;
      });

    ensureNotAborted(abortController.signal);
    progress.finalizing(98, "finalizing");

    const fileName = sanitizeFilename(`${event.id}-${region}-event-bgm.${format}`);
    const body = Uint8Array.from(taggedAudio);

    progress.done("ready");

    return new Response(body, {
      headers: {
        "content-type": getAudioMimeType(format),
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
        "content-length": String(body.byteLength)
      }
    });
  } catch (routeError) {
    if (isAbortError(routeError)) {
      progress.error("cancelled");
      return new Response(null, { status: 499 });
    }

    progress.error("failed");
    throw routeError;
  } finally {
    if (taskId) {
      unregisterDownloadTaskAbort(taskId);
    }
    request.signal.removeEventListener("abort", abortFromRequest);
  }
};
