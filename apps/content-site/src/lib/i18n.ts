import { browser } from "$app/environment";
import {
  regionRoleLabelsByLocale,
  repoLocaleByUiLocale,
  themeModeLabelsByLocale,
  type SupportedUiLocale
} from "@platform/i18n-dicts";
import i18next from "i18next";
import HttpBackend from "i18next-http-backend";
import { derived, writable } from "svelte/store";
import { normalizeUiLocale } from "$lib/region";

const COMMON_NAMESPACE = "common";
const SEKAI_I18N_BASE_URL = "https://raw.githubusercontent.com/Sekai-World/sekai-i18n/main";

let initPromise: Promise<void> | null = null;
const localeLoadingCount = writable(0);

export const isLocaleLoading = derived(localeLoadingCount, (count) => count > 0);

const toRepoLocale = (locale: SupportedUiLocale): string => repoLocaleByUiLocale[locale] ?? "en";

const ensureInitialized = async (locale: SupportedUiLocale): Promise<void> => {
  if (!browser) {
    return;
  }

  if (!initPromise) {
    initPromise = i18next
      .use(HttpBackend)
      .init({
        lng: toRepoLocale(locale),
        fallbackLng: "en",
        defaultNS: COMMON_NAMESPACE,
        ns: [COMMON_NAMESPACE],
        interpolation: { escapeValue: false },
        returnNull: false,
        backend: {
          loadPath: `${SEKAI_I18N_BASE_URL}/{{lng}}/{{ns}}.json`
        }
      })
      .then(() => undefined);
  }

  await initPromise;
};

export const setI18nLocale = async (localeValue: string): Promise<SupportedUiLocale> => {
  const locale = normalizeUiLocale(localeValue);
  if (!browser) {
    return locale;
  }

  localeLoadingCount.update((count) => count + 1);
  try {
    await ensureInitialized(locale);

    const repoLocale = toRepoLocale(locale);
    if (i18next.language !== repoLocale) {
      await i18next.changeLanguage(repoLocale);
    }
  } finally {
    localeLoadingCount.update((count) => Math.max(0, count - 1));
  }

  return locale;
};

export const tCommon = (key: string, fallback: string): string => {
  if (!browser || !i18next.isInitialized) {
    return fallback;
  }

  const value = i18next.t(key, { ns: COMMON_NAMESPACE, defaultValue: fallback });
  return typeof value === "string" ? value : fallback;
};

export const getThemeModeLabel = (
  localeValue: string,
  themeMode: "light" | "dark"
): string => {
  const locale = normalizeUiLocale(localeValue);
  return themeModeLabelsByLocale[locale][themeMode];
};

export const getRegionRoleLabels = (
  localeValue: string
): { primary: string; secondary: string } => {
  const locale = normalizeUiLocale(localeValue);
  return regionRoleLabelsByLocale[locale];
};
