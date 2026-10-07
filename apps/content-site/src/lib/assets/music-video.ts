import { getRemoteAssetEndpointURL, type AssetServer } from "$lib/assets/index";
import type { MusicVideoDescriptor } from "$lib/domain/music-detail";

const MAX_LIST_PAGES = 20;
const DEFAULT_TIMEOUT_MS = 10_000;

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type MusicVideoListingOptions = {
  server?: AssetServer;
  baseUrlOverride?: string | null;
  fetcher?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const getMusicVideoFolder = (category: MusicVideoDescriptor["category"]): string =>
  category === "original" ? "original_mv" : "sekai_mv";

export const getMusicVideoPrefix = (descriptor: MusicVideoDescriptor): string => {
  if (
    !/^[A-Za-z0-9_-]+$/.test(descriptor.assetBundleName) ||
    (descriptor.category !== "original" && descriptor.category !== "mv_2d")
  ) {
    throw new Error("Invalid music video asset bundle name or category.");
  }
  return `live/2dmode/${getMusicVideoFolder(descriptor.category)}/${descriptor.assetBundleName}/`;
};

export const getMusicVideoListingURL = (
  prefix: string,
  continuationToken?: string,
  baseUrlOverride?: string | null,
  server: AssetServer = "jp"
): string => {
  const params = new URLSearchParams({
    "list-type": "2",
    delimiter: "/",
    "max-keys": "500",
    prefix
  });
  if (continuationToken) {
    params.set("continuation-token", continuationToken);
  }

  return getRemoteAssetEndpointURL(`?${params.toString()}`, server, baseUrlOverride);
};

const getElementText = (root: Element, name: string): string | null => {
  const element = Array.from(root.children).find((child) => child.localName === name);
  const value = element?.textContent?.trim() ?? "";
  return value.length > 0 ? value : null;
};

const parseListing = (
  xml: string,
  prefix: string
): { key: string | null; truncated: boolean; token: string | null } => {
  if (typeof DOMParser === "undefined") {
    throw new Error("Music video listings require a browser XML parser.");
  }

  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (
    !document.documentElement ||
    document.documentElement.localName !== "ListBucketResult" ||
    document.getElementsByTagName("parsererror").length > 0
  ) {
    throw new Error("Music video listing returned malformed XML.");
  }

  const contents = Array.from(document.documentElement.children).filter(
    (element) => element.localName === "Contents"
  );
  const key =
    contents
      .map((content) => getElementText(content, "Key"))
      .find((value): value is string =>
        Boolean(
          value &&
          value.startsWith(prefix) &&
          /^[A-Za-z0-9_-][A-Za-z0-9_.-]*\.mp4$/.test(value.slice(prefix.length)) &&
          !value.slice(prefix.length).includes("..")
        )
      ) ?? null;
  const truncated = getElementText(document.documentElement, "IsTruncated") === "true";
  const token = getElementText(document.documentElement, "NextContinuationToken");

  return { key, truncated, token };
};

const fetchListingPage = async (
  url: string,
  fetcher: FetchLike,
  signal: AbortSignal,
  timeoutMs: number
): Promise<string> => {
  const timeoutController = new AbortController();
  const abortFromCaller = (): void => timeoutController.abort(signal.reason);
  if (signal.aborted) {
    abortFromCaller();
  } else {
    signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(
    () => timeoutController.abort(new Error("Music video listing timed out.")),
    timeoutMs
  );
  try {
    if (signal.aborted) {
      throw signal.reason ?? new Error("Music video listing was aborted.");
    }
    const response = await fetcher(url, { signal: timeoutController.signal });
    if (!response.ok) {
      throw new Error(`Music video listing failed with status ${response.status}.`);
    }
    const xml = await response.text();
    if (timeoutController.signal.aborted) {
      throw timeoutController.signal.reason ?? new Error("Music video listing was aborted.");
    }
    return xml;
  } finally {
    clearTimeout(timeoutId);
    signal.removeEventListener("abort", abortFromCaller);
  }
};

export const resolveMusicVideoAssetURL = async (
  descriptor: MusicVideoDescriptor,
  options: MusicVideoListingOptions = {}
): Promise<string> => {
  const prefix = getMusicVideoPrefix(descriptor);

  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
  const signal = options.signal ?? new AbortController().signal;
  const timeoutMs =
    Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0
      ? options.timeoutMs!
      : DEFAULT_TIMEOUT_MS;
  let continuationToken: string | undefined;

  for (let page = 0; page < MAX_LIST_PAGES; page += 1) {
    const listingURL = getMusicVideoListingURL(
      prefix,
      continuationToken,
      options.baseUrlOverride,
      options.server
    );
    const xml = await fetchListingPage(listingURL, fetcher, signal, timeoutMs);
    const listing = parseListing(xml, prefix);
    if (listing.key) {
      return getRemoteAssetEndpointURL(
        listing.key,
        options.server ?? "jp",
        options.baseUrlOverride
      );
    }

    if (!listing.truncated) {
      throw new Error("Music video listing contains no MP4 file.");
    }
    if (!listing.token || listing.token === continuationToken) {
      throw new Error("Music video listing is truncated without a continuation token.");
    }
    continuationToken = listing.token;
  }

  throw new Error("Music video listing exceeded the pagination limit.");
};
