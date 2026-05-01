import { browser } from "$app/environment";
import { PUBLIC_SEKAI_I18N_BASE_URL } from "$env/static/public";
import {
  repoLocaleByUiLocale,
  type SupportedUiLocale
} from "$lib/i18n-config";
import { _, addMessages, init, isLoading, locale as svelteLocale } from "svelte-i18n";
import { derived, get, writable } from "svelte/store";
import { normalizeUiLocale } from "$lib/region";

const toRepoLocale = (uiLocale: SupportedUiLocale): string => repoLocaleByUiLocale[uiLocale] ?? "en";

export type I18nMessages = Record<string, string>;
export type I18nNamespace = "common" | "server";
export type CommonTranslator = (key: string, fallback?: string) => string;
export type I18nFetcher = (input: string) => Promise<Response>;
export type ContentSiteServerMessageKey =
  | "homeEventDataUnavailable"
  | "homeEventDataRequestFailed"
  | "invalidEventId"
  | "eventUnavailableInCurrentRegion"
  | "failedToLoadEventData";

const DEFAULT_SEKAI_I18N_BASE_URL = "https://sekai-world.github.io/sekai-i18n-reborn";
const messageCache = new Map<string, Promise<I18nMessages>>();

const getI18nBaseUrl = (): string => {
  const value = PUBLIC_SEKAI_I18N_BASE_URL?.trim() || DEFAULT_SEKAI_I18N_BASE_URL;
  return value.replace(/\/+$/, "");
};

let initialized = false;

// Track explicit locale-switch loading separately from svelte-i18n's internal isLoading.
// This lets the UI show a spinner only for user-triggered locale changes.
const localeLoadingCount = writable(0);
export const isLocaleLoading = derived(
  [localeLoadingCount, isLoading],
  ([count, loading]) => count > 0 || loading
);

const setupI18n = (initialUiLocale: SupportedUiLocale): void => {
  if (initialized) return;
  initialized = true;

  init({
    fallbackLocale: "en",
    handleMissingMessage: ({ id, defaultValue }) => defaultValue ?? id,
    initialLocale: toRepoLocale(initialUiLocale)
  });
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeMessages = (payload: unknown): I18nMessages => {
  if (!isRecord(payload)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(payload).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
};

export const loadI18nMessages = (
  localeValue: string,
  namespace: I18nNamespace,
  fetcher: I18nFetcher = (input) => fetch(input)
): Promise<I18nMessages> => {
  const uiLocale = normalizeUiLocale(localeValue);
  const repoLocale = toRepoLocale(uiLocale);
  const cacheKey = `${repoLocale}:${namespace}`;
  const cached = messageCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const promise = fetcher(`${getI18nBaseUrl()}/${repoLocale}/${namespace}.json`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load ${repoLocale}/${namespace}.json: ${response.status}`);
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

const addLocaleMessages = (localeValue: string, messages: I18nMessages): SupportedUiLocale => {
  const uiLocale = normalizeUiLocale(localeValue);
  addMessages(toRepoLocale(uiLocale), messages);
  return uiLocale;
};

export const createCommonTranslator = (
  localeValue: string,
  messages: I18nMessages
): CommonTranslator => {
  const uiLocale = addLocaleMessages(localeValue, messages);
  const repoLocale = toRepoLocale(uiLocale);
  const translateFn = get(_);

  return (key: string, fallback = key): string => {
    const value = translateFn(key, { default: fallback, locale: repoLocale });
    return typeof value === "string" ? value : fallback;
  };
};

export const getServerI18nText = async (
  localeValue: string,
  key: ContentSiteServerMessageKey,
  fetcher: I18nFetcher = (input) => fetch(input)
): Promise<string> => {
  const messages = await loadI18nMessages(localeValue, "server", fetcher);
  const translate = createCommonTranslator(localeValue, messages);
  return translate(key);
};

export const setI18nLocale = async (
  localeValue: string,
  messages?: I18nMessages
): Promise<SupportedUiLocale> => {
  const uiLocale = normalizeUiLocale(localeValue);
  if (!browser) {
    if (messages) {
      addLocaleMessages(uiLocale, messages);
    }
    return uiLocale;
  }

  setupI18n(uiLocale);

  localeLoadingCount.update((n) => n + 1);
  try {
    addLocaleMessages(uiLocale, messages ?? (await loadI18nMessages(uiLocale, "common")));
    const repoLocale = toRepoLocale(uiLocale);
    if (get(svelteLocale) !== repoLocale) {
      svelteLocale.set(repoLocale);
    }
  } finally {
    localeLoadingCount.update((n) => Math.max(0, n - 1));
  }

  return uiLocale;
};

export const tCommon = (localeValue: string, key: string, fallback?: string): string => {
  const uiLocale = normalizeUiLocale(localeValue);
  const translateFn = get(_);
  const fallbackValue = fallback ?? key;
  const value = translateFn(key, { default: fallbackValue, locale: toRepoLocale(uiLocale) });
  return typeof value === "string" ? value : fallbackValue;
};

export const getThemeModeLabel = (
  localeValue: string,
  themeMode: "light" | "dark" | "auto"
): string => {
  return tCommon(localeValue, `themeMode.${themeMode}`, themeMode);
};
