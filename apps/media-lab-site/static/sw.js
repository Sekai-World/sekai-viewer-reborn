/* Story asset LRU cache.
 *
 * Cache-first service for game-asset requests only: the configured remote
 * asset origin (region/Live2D buckets) and same-origin relay prefixes. This
 * is the single interception point that covers every loader the player uses —
 * pixi-live2d-display's own XHRs for model JSON/textures/motions, Howler's
 * Web Audio fetches for voices/BGM/SE, and `<img>`/`fetch` preloaders — which
 * no page-side fetch wrapper could reach.
 *
 * Asset object keys are content-addressed, so entries are served without
 * revalidation and evicted least-recently-used once the stored total exceeds
 * the byte cap. The page registers this worker and posts a
 * `configure-story-asset-cache` message with the allowlist (see
 * `$lib/story/asset-cache-client.ts`); until that arrives the worker caches
 * nothing and passes every request through.
 */

const CACHE_NAME = "story-assets-v1";
const INDEX_CACHE_NAME = "story-assets-index-v1";
const INDEX_URL = "https://story-assets-cache.local/__index__";
const DEFAULT_MAX_TOTAL_BYTES = 512 * 1024 * 1024;

/** @type {string[]} */
let allowedOrigins = [];
/** @type {string[]} */
let allowedPathPrefixes = [];
let maxTotalBytes = DEFAULT_MAX_TOTAL_BYTES;

// Concurrent fetch handlers interleave awaits, so index read-modify-write
// cycles must be serialized or they lose each other's updates.
let indexLock = Promise.resolve();
const withIndexLock = (task) => {
  const run = indexLock.then(task);
  indexLock = run.catch(() => {});
  return run;
};

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("story-assets") &&
              name !== CACHE_NAME &&
              name !== INDEX_CACHE_NAME
          )
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  // Cache configuration is only accepted from the same origin that
  // registered this service worker.
  if (event.origin !== self.location.origin) return;
  const data = event.data;
  if (data?.type !== "configure-story-asset-cache") return;
  if (Array.isArray(data.origins)) {
    allowedOrigins = data.origins.filter(
      (origin) => typeof origin === "string" && origin.length > 0
    );
  }
  if (Array.isArray(data.pathPrefixes)) {
    allowedPathPrefixes = data.pathPrefixes.filter(
      (prefix) => typeof prefix === "string" && prefix.length > 0
    );
  }
  if (typeof data.maxTotalBytes === "number" && data.maxTotalBytes > 0) {
    maxTotalBytes = data.maxTotalBytes;
  }
});

const isCacheableRequest = (request) => {
  if (request.method !== "GET") return false;
  // Media elements may issue ranged requests; they must hit the network.
  if (request.headers.has("range")) return false;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.search) return false;
  if (allowedOrigins.includes(url.origin)) return true;
  return (
    url.origin === self.location.origin &&
    allowedPathPrefixes.some(
      (prefix) => prefix && url.pathname.startsWith(prefix)
    )
  );
};

const readIndex = async () => {
  const cache = await caches.open(INDEX_CACHE_NAME);
  const stored = await cache.match(INDEX_URL);
  if (!stored) return { totalBytes: 0, entries: {} };
  try {
    const index = await stored.json();
    if (index && typeof index.entries === "object" && index.entries) {
      return {
        totalBytes: Number(index.totalBytes) || 0,
        entries: index.entries
      };
    }
  } catch {
    // Fall through: a corrupt index is equivalent to an empty one.
  }
  return { totalBytes: 0, entries: {} };
};

const writeIndex = async (index) => {
  const cache = await caches.open(INDEX_CACHE_NAME);
  await cache.put(
    INDEX_URL,
    new Response(JSON.stringify(index), {
      headers: { "content-type": "application/json" }
    })
  );
};

/** Refreshes an entry's recency after a cache hit. Best-effort. */
const touchEntry = (url) => {
  void withIndexLock(async () => {
    const index = await readIndex();
    const entry = index.entries[url];
    if (!entry) return;
    entry.at = Date.now();
    await writeIndex(index);
  });
};

/** Records a stored asset's size in the LRU index, then evicts the
 * least-recently-used entries until the total is back under the cap. */
const recordAndEvict = async (url, bytes) => {
  await withIndexLock(async () => {
    const index = await readIndex();
    const previous = index.entries[url];
    if (previous) index.totalBytes -= Number(previous.bytes) || 0;
    index.entries[url] = { bytes, at: Date.now() };
    index.totalBytes += bytes;
    const cache = await caches.open(CACHE_NAME);
    while (index.totalBytes > maxTotalBytes) {
      let oldestUrl = null;
      let oldestAt = Infinity;
      for (const [entryUrl, entry] of Object.entries(index.entries)) {
        const at = Number(entry?.at) || 0;
        if (at < oldestAt) {
          oldestAt = at;
          oldestUrl = entryUrl;
        }
      }
      if (oldestUrl === null) break;
      await cache.delete(oldestUrl);
      index.totalBytes -= Number(index.entries[oldestUrl]?.bytes) || 0;
      delete index.entries[oldestUrl];
    }
    await writeIndex(index);
  });
};

const serveCacheFirst = async (request) => {
  const cache = await caches.open(CACHE_NAME);
  let cached = null;
  try {
    cached = await cache.match(request, { ignoreVary: true });
  } catch {
    cached = null;
  }
  if (cached) {
    touchEntry(request.url);
    return cached;
  }
  let response;
  try {
    response = await fetch(request);
  } catch {
    return new Response("", {
      status: 504,
      statusText: "story asset unavailable"
    });
  }
  // Opaque responses hide their size and body, so only basic/cors ones are
  // cacheable; assets are content-addressed, so no revalidation is needed.
  if (
    response.ok &&
    (response.type === "basic" || response.type === "cors")
  ) {
    try {
      const copy = response.clone();
      const buffer = await copy.arrayBuffer();
      if (buffer.byteLength > 0) {
        await cache.put(
          request,
          new Response(buffer, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          })
        );
        void recordAndEvict(request.url, buffer.byteLength);
      }
    } catch {
      // Storage failures degrade to pass-through networking.
    }
  }
  return response;
};

self.addEventListener("fetch", (event) => {
  if (!isCacheableRequest(event.request)) return;
  event.respondWith(serveCacheFirst(event.request));
});
