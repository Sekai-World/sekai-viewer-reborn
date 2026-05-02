import { _, addMessages, init, isLoading, locale as svelteLocale } from "svelte-i18n";
import { derived, get, writable } from "svelte/store";

export type I18nMessages = Record<string, string>;
export type I18nFetcher = (input: string) => Promise<Response>;
export type I18nLocaleResolver = (localeValue: string) => string;
export type I18nTranslator = (key: string, fallback?: string) => string;

export interface RemoteI18nRuntimeOptions {
  baseUrl: string;
  fallbackLocale: string;
  toRemoteLocale: I18nLocaleResolver;
  normalizeLocale: I18nLocaleResolver;
  isBrowser?: () => boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeMessages = (payload: unknown): I18nMessages => {
  if (!isRecord(payload)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string"
    )
  );
};

const trimTrailingSlash = (value: string): string => value.trim().replace(/\/+$/, "");

export const createRemoteI18nRuntime = (options: RemoteI18nRuntimeOptions) => {
  const messageCache = new Map<string, Promise<I18nMessages>>();
  const localeLoadingCount = writable(0);
  let initialized = false;

  const isLocaleLoading = derived(
    [localeLoadingCount, isLoading],
    ([count, loading]) => count > 0 || loading
  );

  const getBaseUrl = (): string => trimTrailingSlash(options.baseUrl);

  const setupI18n = (localeValue: string): void => {
    if (initialized) return;
    initialized = true;

    init({
      fallbackLocale: options.fallbackLocale,
      handleMissingMessage: ({ id, defaultValue }) => defaultValue ?? id,
      initialLocale: options.toRemoteLocale(options.normalizeLocale(localeValue))
    });
  };

  const loadMessages = (
    localeValue: string,
    namespace: string,
    fetcher: I18nFetcher = (input) => fetch(input)
  ): Promise<I18nMessages> => {
    const locale = options.normalizeLocale(localeValue);
    const remoteLocale = options.toRemoteLocale(locale);
    const cacheKey = `${remoteLocale}:${namespace}`;
    const cached = messageCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const promise = fetcher(`${getBaseUrl()}/${remoteLocale}/${namespace}.json`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load ${remoteLocale}/${namespace}.json: ${response.status}`);
        }

        return response.json() as Promise<unknown>;
      })
      .then(normalizeMessages)
      .catch(() => {
        messageCache.delete(cacheKey);
        return {};
      });

    messageCache.set(cacheKey, promise);
    return promise;
  };

  const addLocaleMessages = (localeValue: string, messages: I18nMessages): string => {
    const locale = options.normalizeLocale(localeValue);
    addMessages(options.toRemoteLocale(locale), messages);
    return locale;
  };

  const createTranslator = (localeValue: string, messages: I18nMessages): I18nTranslator => {
    const locale = addLocaleMessages(localeValue, messages);
    const remoteLocale = options.toRemoteLocale(locale);
    const translateFn = get(_);

    return (key: string, fallback = key): string => {
      const value = translateFn(key, { default: fallback, locale: remoteLocale });
      return typeof value === "string" ? value : fallback;
    };
  };

  const setLocale = async (localeValue: string, messages?: I18nMessages): Promise<string> => {
    const locale = options.normalizeLocale(localeValue);
    const isBrowser = options.isBrowser?.() ?? typeof window !== "undefined";
    if (!isBrowser) {
      if (messages) {
        addLocaleMessages(locale, messages);
      }
      return locale;
    }

    setupI18n(locale);

    localeLoadingCount.update((n) => n + 1);
    try {
      addLocaleMessages(locale, messages ?? (await loadMessages(locale, "common")));
      const remoteLocale = options.toRemoteLocale(locale);
      if (get(svelteLocale) !== remoteLocale) {
        svelteLocale.set(remoteLocale);
      }
    } finally {
      localeLoadingCount.update((n) => Math.max(0, n - 1));
    }

    return locale;
  };

  const translate = (localeValue: string, key: string, fallback?: string): string => {
    const locale = options.normalizeLocale(localeValue);
    const translateFn = get(_);
    const fallbackValue = fallback ?? key;
    const value = translateFn(key, {
      default: fallbackValue,
      locale: options.toRemoteLocale(locale)
    });
    return typeof value === "string" ? value : fallbackValue;
  };

  const getServerText = async (
    localeValue: string,
    namespace: string,
    key: string,
    fetcher: I18nFetcher = (input) => fetch(input)
  ): Promise<string> => {
    const messages = await loadMessages(localeValue, namespace, fetcher);
    return createTranslator(localeValue, messages)(key);
  };

  return {
    createTranslator,
    getServerText,
    isLocaleLoading,
    loadMessages,
    setLocale,
    translate
  };
};
