import { browser } from "$app/environment";
import { env } from "$env/dynamic/public";
import {
  createRemoteI18nRuntime,
  createScopedI18nLoader,
  type I18nFetcher,
  type I18nMessages,
  type I18nTranslator
} from "@platform/i18n-runtime";
import commonSourceMessages from "@platform/i18n-source/tools-site/common.json";
import serverSourceMessages from "@platform/i18n-source/tools-site/server.json";
import trackerSourceMessages from "@platform/i18n-source/tools-site/tracker.json";
import { repoLocaleByUiLocale, type SupportedUiLocale } from "$lib/i18n/config";
import { normalizeUiLocale } from "$lib/i18n/region";

export const toolsSiteI18nNamespaces = ["common", "server", "tracker"] as const;

export type I18nNamespace = (typeof toolsSiteI18nNamespaces)[number];
export type ToolsSiteTranslator = I18nTranslator;

const DEFAULT_SEKAI_I18N_BASE_URL = "https://sekai-world.github.io/sekai-i18n-reborn";
const localSourceMessagesByNamespace: Record<I18nNamespace, I18nMessages> = {
  common: commonSourceMessages,
  server: serverSourceMessages,
  tracker: trackerSourceMessages
};

const toRepoLocale = (locale: SupportedUiLocale): string => repoLocaleByUiLocale[locale] ?? "en";

const removeTrailingSlashes = (value: string): string => {
  let normalized = value;
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
};

const getI18nBaseUrl = (): string =>
  removeTrailingSlashes(env.PUBLIC_SEKAI_I18N_BASE_URL?.trim() || DEFAULT_SEKAI_I18N_BASE_URL);

const i18nRuntime = createRemoteI18nRuntime({
  baseUrl: getI18nBaseUrl(),
  fallbackLocale: "en",
  isBrowser: () => browser,
  normalizeLocale: normalizeUiLocale,
  toRemoteLocale: (locale) => toRepoLocale(normalizeUiLocale(locale))
});

const scopedI18nLoader = createScopedI18nLoader<I18nNamespace>({
  commonNamespace: "common",
  fallbackLocale: "en",
  localSourceMessagesByNamespace,
  loadRemoteMessages: (locale, namespace, fetcher) =>
    i18nRuntime.loadMessages(locale, namespace, fetcher),
  normalizeLocale: normalizeUiLocale,
  toRemoteLocale: (locale) => toRepoLocale(normalizeUiLocale(locale))
});

export const loadI18nMessageBundle = (
  locale: string,
  namespaces: readonly I18nNamespace[],
  fetcher?: I18nFetcher
): Promise<I18nMessages> => scopedI18nLoader.loadMessageBundle(locale, namespaces, fetcher);

export const createI18nTranslator = (locale: string, messages: I18nMessages): ToolsSiteTranslator =>
  i18nRuntime.createPureTranslator(locale, messages);

export const getLocalI18nMessages = (namespaces: readonly I18nNamespace[]): I18nMessages =>
  namespaces.reduce<I18nMessages>(
    (messages, namespace) => ({ ...messages, ...localSourceMessagesByNamespace[namespace] }),
    {}
  );
