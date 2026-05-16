import { browser } from "$app/environment";
import { PUBLIC_SEKAI_I18N_BASE_URL } from "$env/static/public";
import {
  createRemoteI18nRuntime,
  type I18nFetcher,
  type I18nMessages,
  type I18nTranslator
} from "@platform/i18n-runtime";
import { repoLocaleByUiLocale, type SupportedUiLocale } from "$lib/i18n-config";
import { normalizeUiLocale } from "$lib/region";

const toRepoLocale = (uiLocale: SupportedUiLocale): string =>
  repoLocaleByUiLocale[uiLocale] ?? "en";

const FALLBACK_UI_LOCALE: SupportedUiLocale = "en";

export type I18nNamespace = "common" | "server";
export type CommonTranslator = I18nTranslator;
export type ContentSiteServerMessageKey =
  | "homeEventDataUnavailable"
  | "homeEventDataRequestFailed"
  | "invalidEventId"
  | "eventUnavailableInCurrentRegion"
  | "failedToLoadEventData";

const DEFAULT_SEKAI_I18N_BASE_URL = "https://sekai-world.github.io/sekai-i18n-reborn";

const getI18nBaseUrl = (): string => {
  const value = PUBLIC_SEKAI_I18N_BASE_URL?.trim() || DEFAULT_SEKAI_I18N_BASE_URL;
  return value.replace(/\/+$/, "");
};

const i18nRuntime = createRemoteI18nRuntime({
  baseUrl: getI18nBaseUrl(),
  fallbackLocale: "en",
  isBrowser: () => browser,
  normalizeLocale: (localeValue) => normalizeUiLocale(localeValue),
  toRemoteLocale: (localeValue) => toRepoLocale(normalizeUiLocale(localeValue))
});

export const isLocaleLoading = i18nRuntime.isLocaleLoading;

const loadNamespaceMessagesWithFallback = async (
  localeValue: string,
  namespace: I18nNamespace,
  fetcher?: I18nFetcher,
  primaryMessages?: I18nMessages
): Promise<I18nMessages> => {
  const locale = normalizeUiLocale(localeValue);
  const primaryRemoteLocale = toRepoLocale(locale);
  const fallbackRemoteLocale = toRepoLocale(FALLBACK_UI_LOCALE);

  const primaryMessagesPromise = primaryMessages
    ? Promise.resolve(primaryMessages)
    : i18nRuntime.loadMessages(locale, namespace, fetcher);

  if (primaryRemoteLocale === fallbackRemoteLocale) {
    return primaryMessagesPromise;
  }

  const [messages, fallbackMessages] = await Promise.all([
    primaryMessagesPromise,
    i18nRuntime.loadMessages(FALLBACK_UI_LOCALE, namespace, fetcher)
  ]);

  return {
    ...fallbackMessages,
    ...messages
  };
};

export const loadI18nMessages = (
  localeValue: string,
  namespace: I18nNamespace,
  fetcher?: I18nFetcher
): Promise<I18nMessages> => loadNamespaceMessagesWithFallback(localeValue, namespace, fetcher);

export const createCommonTranslator = (
  localeValue: string,
  messages: I18nMessages
): CommonTranslator => i18nRuntime.createTranslator(localeValue, messages);

export const getServerI18nText = async (
  localeValue: string,
  key: ContentSiteServerMessageKey,
  fetcher?: I18nFetcher
): Promise<string> => {
  const messages = await loadNamespaceMessagesWithFallback(localeValue, "server", fetcher);
  return messages[key] ?? key;
};

export const setI18nLocale = (
  localeValue: string,
  messages?: I18nMessages
): Promise<SupportedUiLocale> =>
  loadNamespaceMessagesWithFallback(localeValue, "common", undefined, messages)
    .then((resolvedMessages) => i18nRuntime.setLocale(localeValue, resolvedMessages))
    .then((locale) => normalizeUiLocale(locale));

export const tCommon = (localeValue: string, key: string, fallback?: string): string =>
  i18nRuntime.translate(localeValue, key, fallback);

export const getThemeModeLabel = (
  localeValue: string,
  themeMode: "light" | "dark" | "auto"
): string => {
  return tCommon(localeValue, `themeMode.${themeMode}`, themeMode);
};
