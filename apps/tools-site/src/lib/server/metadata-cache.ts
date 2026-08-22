type CacheEntry<T> = {
  value?: T;
  expiresAt: number;
  staleUntil: number;
  promise?: Promise<T>;
};

const DEFAULT_GRACE_MS = 10 * 60 * 1000;
const entries = new Map<string, CacheEntry<unknown>>();

export const getCachedMetadata = async <T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs: number,
  isCacheable: (value: T) => boolean = () => true,
  now = Date.now
): Promise<T> => {
  const existing = entries.get(key) as CacheEntry<T> | undefined;
  const timestamp = now();
  if (existing?.promise) return existing.promise;
  if (existing?.value !== undefined && existing.expiresAt > timestamp) return existing.value;

  const promise = loader().then(
    (value) => {
      if (isCacheable(value))
        entries.set(key, {
          value,
          expiresAt: now() + ttlMs,
          staleUntil: now() + ttlMs + DEFAULT_GRACE_MS
        });
      else entries.delete(key);
      return value;
    },
    (error: unknown) => {
      const latest = entries.get(key) as CacheEntry<T> | undefined;
      if (latest?.value !== undefined && latest.staleUntil > now()) {
        entries.set(key, { ...latest, promise: undefined });
        return latest.value;
      }
      entries.delete(key);
      throw error;
    }
  );
  entries.set(key, { ...(existing ?? { expiresAt: 0, staleUntil: 0 }), promise });
  return promise;
};

export const clearMetadataCache = (): void => entries.clear();
