import { browser } from "$app/environment";
import { PUBLIC_SEKAI_I18N_BASE_URL } from "$env/static/public";
import {
  contentSiteCommonByRepoLocale,
  getContentSiteCommonText,
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

let initPromise: Promise<void> | null = null;
const localeLoadingCount = writable(0);

export const isLocaleLoading = derived(localeLoadingCount, (count) => count > 0);

const toRepoLocale = (locale: SupportedUiLocale): string => repoLocaleByUiLocale[locale] ?? "en";

const applyExtraCommonResources = (): void => {
  for (const [locale, resources] of Object.entries(contentSiteCommonByRepoLocale)) {
    i18next.addResourceBundle(locale, COMMON_NAMESPACE, resources, true, true);
  }
};

const getI18nBaseUrl = (): string => {
  const value = PUBLIC_SEKAI_I18N_BASE_URL?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: PUBLIC_SEKAI_I18N_BASE_URL");
  }

  return value.replace(/\/+$/, "");
};

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
          loadPath: `${getI18nBaseUrl()}/{{lng}}/{{ns}}.json`
        }
      })
      .then(() => {
        applyExtraCommonResources();
      });
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

export const tCommon = (localeValue: string, key: string, fallback?: string): string => {
  const locale = normalizeUiLocale(localeValue);
  const fallbackValue = getContentSiteCommonText(locale, key, fallback ?? key);

  if (!browser || !i18next.isInitialized) {
    return fallbackValue;
  }

  const value = i18next.t(key, { ns: COMMON_NAMESPACE, defaultValue: fallbackValue });
  return typeof value === "string" ? value : fallbackValue;
};

export const getThemeModeLabel = (
  localeValue: string,
  themeMode: "light" | "dark" | "auto"
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
