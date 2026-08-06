import { _, addMessages, init, isLoading, locale as svelteLocale } from "svelte-i18n";
import { derived, get, writable } from "svelte/store";

export type I18nMessages = Record<string, string>;
export type I18nFetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type I18nLocaleResolver = (localeValue: string) => string;
export type I18nTranslator = (key: string, fallback?: string) => string;
export type I18nRequestToken = { readonly version: number; readonly isCurrent: () => boolean };

export interface RemoteI18nRuntimeOptions {
  baseUrl: string;
  fallbackLocale: string;
  toRemoteLocale: I18nLocaleResolver;
  normalizeLocale: I18nLocaleResolver;
  isBrowser?: () => boolean;
  messageLoadTimeoutMs?: number;
}

export interface ScopedI18nLoaderOptions<Namespace extends string> {
  fallbackLocale: string;
  localSourceMessagesByNamespace: Record<Namespace, I18nMessages>;
  legacyCommonCompatNamespaces?: ReadonlySet<Namespace>;
  commonNamespace: Namespace;
  loadRemoteMessages: (
    localeValue: string,
    namespace: Namespace,
    fetcher?: I18nFetcher
  ) => Promise<I18nMessages>;
  normalizeLocale: I18nLocaleResolver;
  toRemoteLocale: I18nLocaleResolver;
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

export const createScopedI18nLoader = <Namespace extends string>(
  options: ScopedI18nLoaderOptions<Namespace>
) => {
  const loadNamespaceMessagesWithFallback = async (
    localeValue: string,
    namespace: Namespace,
    fetcher?: I18nFetcher,
    primaryMessages?: I18nMessages
  ): Promise<I18nMessages> => {
    const locale = options.normalizeLocale(localeValue);
    const primaryRemoteLocale = options.toRemoteLocale(locale);
    const fallbackRemoteLocale = options.toRemoteLocale(options.fallbackLocale);

    const primaryMessagesPromise = primaryMessages
      ? Promise.resolve(primaryMessages)
      : options.loadRemoteMessages(locale, namespace, fetcher);

    const localSourceMessages = options.localSourceMessagesByNamespace[namespace];

    if (primaryRemoteLocale === fallbackRemoteLocale) {
      const messages = await primaryMessagesPromise;
      return {
        ...localSourceMessages,
        ...messages
      };
    }

    const [messages, fallbackMessages] = await Promise.all([
      primaryMessagesPromise,
      options.loadRemoteMessages(options.fallbackLocale, namespace, fetcher)
    ]);

    if (options.legacyCommonCompatNamespaces?.has(namespace)) {
      const [legacyMessages, fallbackLegacyMessages] = await Promise.all([
        options.loadRemoteMessages(locale, options.commonNamespace, fetcher),
        options.loadRemoteMessages(options.fallbackLocale, options.commonNamespace, fetcher)
      ]);

      return {
        ...localSourceMessages,
        ...fallbackLegacyMessages,
        ...fallbackMessages,
        ...legacyMessages,
        ...messages
      };
    }

    return {
      ...localSourceMessages,
      ...fallbackMessages,
      ...messages
    };
  };

  const loadMessages = (
    localeValue: string,
    namespace: Namespace,
    fetcher?: I18nFetcher
  ): Promise<I18nMessages> => loadNamespaceMessagesWithFallback(localeValue, namespace, fetcher);

  const loadMessageBundle = async (
    localeValue: string,
    namespaces: readonly Namespace[],
    fetcher?: I18nFetcher
  ): Promise<I18nMessages> => {
    const namespaceMessages = await Promise.all(
      namespaces.map((namespace) => loadMessages(localeValue, namespace, fetcher))
    );

    return namespaceMessages.reduce<I18nMessages>(
      (messages, nextMessages) => ({ ...messages, ...nextMessages }),
      {}
    );
  };

  const mergeCommonMessages = (messages: I18nMessages): I18nMessages => ({
    ...options.localSourceMessagesByNamespace[options.commonNamespace],
    ...messages
  });

  return {
    loadMessageBundle,
    loadMessages,
    mergeCommonMessages
  };
};

export const createRemoteI18nRuntime = (options: RemoteI18nRuntimeOptions) => {
  const messageCache = new Map<string, Promise<I18nMessages>>();
  const localeLoadingCount = writable(0);
  let initialized = false;
  let requestVersion = 0;
  const messageLoadTimeoutMs = options.messageLoadTimeoutMs ?? 2_500;

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

    const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
    const request = async (): Promise<I18nMessages> => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const fetchMessages = fetcher(`${getBaseUrl()}/${remoteLocale}/${namespace}.json`, {
        signal: controller?.signal
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load ${remoteLocale}/${namespace}.json: ${response.status}`);
          }

          return response.json() as Promise<unknown>;
        })
        .then(normalizeMessages);

      try {
        if (messageLoadTimeoutMs <= 0) return await fetchMessages;
        const deadline = new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () => reject(new Error(`Timed out loading ${remoteLocale}/${namespace}.json`)),
            messageLoadTimeoutMs
          );
          if (
            typeof timeout === "object" &&
            timeout !== null &&
            "unref" in timeout &&
            typeof (timeout as { unref?: unknown }).unref === "function"
          ) {
            (timeout as { unref: () => void }).unref();
          }
        });
        return await Promise.race([fetchMessages, deadline]);
      } catch (error) {
        controller?.abort();
        throw error;
      } finally {
        if (timeout !== undefined) clearTimeout(timeout);
      }
    };

    const promise = request().catch(() => {
      if (messageCache.get(cacheKey) === promise) messageCache.delete(cacheKey);
      return {};
    });

    messageCache.set(cacheKey, promise);
    return promise;
  };

  const addLocaleMessages = (localeValue: string, messages: I18nMessages): string => {
    const locale = options.normalizeLocale(localeValue);
    setupI18n(locale);
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

  // Rendering translators must be side-effect free: SSR and page-local fallback
  // rendering must never register a partial catalog in the global svelte-i18n store.
  const createPureTranslator =
    (_localeValue: string, messages: I18nMessages): I18nTranslator =>
    (key: string, fallback = key): string =>
      messages[key] ?? fallback;

  const setLocale = async (
    localeValue: string,
    messages?: I18nMessages,
    isCurrent?: () => boolean
  ): Promise<string> => {
    const locale = options.normalizeLocale(localeValue);
    setupI18n(locale);
    const isBrowser = options.isBrowser?.() ?? typeof window !== "undefined";
    if (!isBrowser) {
      return locale;
    }

    localeLoadingCount.update((n) => n + 1);
    try {
      const resolvedMessages = messages ?? (await loadMessages(locale, "common"));
      const remoteLocale = options.toRemoteLocale(locale);
      if (isCurrent && !isCurrent()) return locale;
      addLocaleMessages(locale, resolvedMessages);
      if (isCurrent && !isCurrent()) return locale;
      if (get(svelteLocale) !== remoteLocale) {
        if (isCurrent && !isCurrent()) return locale;
        svelteLocale.set(remoteLocale);
      }
    } finally {
      localeLoadingCount.update((n) => Math.max(0, n - 1));
    }

    return locale;
  };

  const requestLocale = (): I18nRequestToken => {
    const version = ++requestVersion;
    return { version, isCurrent: () => version === requestVersion };
  };

  const translate = (localeValue: string, key: string, fallback?: string): string => {
    const locale = options.normalizeLocale(localeValue);
    setupI18n(locale);
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
    createPureTranslator,
    getServerText,
    isLocaleLoading,
    loadMessages,
    setLocale,
    requestLocale,
    translate
  };
};
