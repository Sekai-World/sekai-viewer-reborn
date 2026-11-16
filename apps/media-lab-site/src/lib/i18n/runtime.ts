import { browser, dev } from "$app/env";
import { PUBLIC_SEKAI_I18N_BASE_URL } from "$app/env/public";
import {
  createRemoteI18nRuntime,
  createScopedI18nLoader,
  type I18nFetcher,
  type I18nMessages,
  type I18nTranslator
} from "@platform/i18n-runtime";
import chibiSourceMessages from "@platform/i18n-source/media-lab-site/chibi.json";
import commonSourceMessages from "@platform/i18n-source/media-lab-site/common.json";
import homeSourceMessages from "@platform/i18n-source/media-lab-site/home.json";
import live2dSourceMessages from "@platform/i18n-source/media-lab-site/live2d.json";
import storyReaderSourceMessages from "@platform/i18n-source/media-lab-site/story-reader.json";
import { normalizeUiLocale, repoLocaleByUiLocale } from "#lib/i18n/region.js";

// Route-aware namespaces: `common` powers the shared shell, while `home`,
// `live2d`, `chibi`, and `story-reader` scope their route tracks.
export const mediaLabI18nNamespaces = [
  "common",
  "home",
  "live2d",
  "chibi",
  "story-reader"
] as const;

export type I18nNamespace = (typeof mediaLabI18nNamespaces)[number];
export type MediaLabTranslator = I18nTranslator;

const DEFAULT_SEKAI_I18N_BASE_URL = "https://sekai-world.github.io/sekai-i18n-reborn";

// The externalized source bundles under `@platform/i18n-source/media-lab-site`
// are the English fallback beneath every remote dictionary.
const localSourceMessagesByNamespace: Record<I18nNamespace, I18nMessages> = {
  common: commonSourceMessages,
  home: homeSourceMessages,
  live2d: live2dSourceMessages,
  chibi: chibiSourceMessages,
  "story-reader": storyReaderSourceMessages
};

const toRepoLocale = (locale: string): string =>
  repoLocaleByUiLocale[normalizeUiLocale(locale)] ?? "en";

const getI18nBaseUrl = (): string =>
  (PUBLIC_SEKAI_I18N_BASE_URL?.trim() || DEFAULT_SEKAI_I18N_BASE_URL).replace(/\/+$/, "");

const i18nRuntime = createRemoteI18nRuntime({
  baseUrl: getI18nBaseUrl(),
  fallbackLocale: "en",
  isBrowser: () => browser,
  normalizeLocale: (locale) => normalizeUiLocale(locale),
  toRemoteLocale: toRepoLocale
});

/**
 * media-lab-site dictionaries live under `<repoLocale>/media-lab-site/` because
 * every site owns a `common` namespace. In dev, English resolves from the local
 * source files so source edits show up without waiting for a dictionary sync.
 */
const loadRemoteMessages = (
  locale: string,
  namespace: I18nNamespace,
  fetcher?: I18nFetcher
): Promise<I18nMessages> => {
  if (dev && toRepoLocale(locale) === "en") {
    return Promise.resolve(localSourceMessagesByNamespace[namespace]);
  }
  return i18nRuntime.loadMessages(locale, `media-lab-site/${namespace}`, fetcher);
};

const scopedI18nLoader = createScopedI18nLoader<I18nNamespace>({
  commonNamespace: "common",
  fallbackLocale: "en",
  localSourceMessagesByNamespace,
  loadRemoteMessages,
  normalizeLocale: (locale) => normalizeUiLocale(locale),
  toRemoteLocale: toRepoLocale
});

export const getLocalI18nMessages = (namespaces: readonly I18nNamespace[]): I18nMessages =>
  namespaces.reduce<I18nMessages>(
    (messages, namespace) => ({ ...messages, ...localSourceMessagesByNamespace[namespace] }),
    {}
  );

export const loadI18nMessageBundle = (
  locale: string,
  namespaces: readonly I18nNamespace[],
  fetcher?: I18nFetcher
): Promise<I18nMessages> => scopedI18nLoader.loadMessageBundle(locale, namespaces, fetcher);

// A side-effect-free lookup against the provided messages, safe for SSR and
// fallback rendering.
export const createI18nTranslator = (locale: string, messages: I18nMessages): MediaLabTranslator =>
  i18nRuntime.createPureTranslator(locale, messages);
