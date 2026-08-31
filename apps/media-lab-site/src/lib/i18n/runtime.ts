import type { I18nMessages, I18nTranslator } from "@platform/i18n-runtime";
import commonSourceMessages from "$lib/i18n/messages/common.json";

export const mediaLabI18nNamespaces = ["common"] as const;

export type I18nNamespace = (typeof mediaLabI18nNamespaces)[number];
export type MediaLabTranslator = I18nTranslator;

// media-lab has no published namespace in the remote sekai-i18n-reborn
// dictionaries yet, so the local source bundles are the authoritative messages.
// The bundle loader stays async and the translator stays pure so a remote
// runtime can be layered in later without changing call sites.
const localSourceMessagesByNamespace: Record<I18nNamespace, I18nMessages> = {
  common: commonSourceMessages
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
