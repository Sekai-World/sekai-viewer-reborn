import type { I18nMessages, I18nTranslator } from "@platform/i18n-runtime";
import commonSourceMessages from "@platform/i18n-source/media-lab-site/common.json";
import homeSourceMessages from "@platform/i18n-source/media-lab-site/home.json";
import live2dSourceMessages from "@platform/i18n-source/media-lab-site/live2d.json";
import storyReaderSourceMessages from "@platform/i18n-source/media-lab-site/story-reader.json";

// Route-aware namespaces: `common` powers the shared shell, while `home`,
// `live2d`, and `story-reader` scope their route tracks.
export const mediaLabI18nNamespaces = ["common", "home", "live2d", "story-reader"] as const;

export type I18nNamespace = (typeof mediaLabI18nNamespaces)[number];
export type MediaLabTranslator = I18nTranslator;

// media-lab has no published namespaces in the remote sekai-i18n-reborn
// dictionaries yet, so the externalized source bundles under
// `@platform/i18n-source/media-lab-site` are the authoritative local fallback.
// The bundle loader stays async and the translator stays pure so the shared
// remote runtime can be layered in later without changing call sites.
const localSourceMessagesByNamespace: Record<I18nNamespace, I18nMessages> = {
  common: commonSourceMessages,
  home: homeSourceMessages,
  live2d: live2dSourceMessages,
  "story-reader": storyReaderSourceMessages
};

export const getLocalI18nMessages = (namespaces: readonly I18nNamespace[]): I18nMessages =>
  namespaces.reduce<I18nMessages>(
    (messages, namespace) => ({ ...messages, ...localSourceMessagesByNamespace[namespace] }),
    {}
  );

export const loadI18nMessageBundle = async (
  _locale: string,
  namespaces: readonly I18nNamespace[]
): Promise<I18nMessages> => getLocalI18nMessages(namespaces);

// Mirrors @platform/i18n-runtime's pure translator: a side-effect-free lookup
// against the provided messages, safe for SSR and fallback rendering.
export const createI18nTranslator =
  (_locale: string, messages: I18nMessages): MediaLabTranslator =>
  (key: string, fallback = key): string =>
    messages[key] ?? fallback;
