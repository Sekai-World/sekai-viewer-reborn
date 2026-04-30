import { browser } from "$app/environment";
import { PUBLIC_SEKAI_I18N_BASE_URL } from "$env/static/public";
import {
  getContentSiteCommonText,
  repoLocaleByUiLocale,
  supportedUiLocales,
  themeModeLabelsByLocale,
  type SupportedUiLocale
} from "$lib/i18n-data";
import { _, init, isLoading, locale as svelteLocale, register, waitLocale } from "svelte-i18n";
import { derived, get, writable } from "svelte/store";
import { normalizeUiLocale } from "$lib/region";

const toRepoLocale = (uiLocale: SupportedUiLocale): string => repoLocaleByUiLocale[uiLocale] ?? "en";

/**
 * Converts flat JSON (dot-separated keys) to a nested object.
 * e.g. { "a.b": "c" } -> { a: { b: "c" } }
 * Required because Weblate outputs flat JSON and svelte-i18n does dot-path lookups.
 */
const unflattenObject = (flat: Record<string, string>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    let current: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (typeof current[parts[i]] !== "object" || current[parts[i]] === null) {
        current[parts[i]] = {};
      }
      current = current[parts[i]] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]] = value;
  }
  return result;
};

const getI18nBaseUrl = (): string => {
  const value = PUBLIC_SEKAI_I18N_BASE_URL?.trim();
  if (!value) {
    throw new Error("Missing required environment variable: PUBLIC_SEKAI_I18N_BASE_URL");
  }
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

  const baseUrl = getI18nBaseUrl();
  const seenRepoLocales = new Set<string>();

  for (const uiLocale of supportedUiLocales) {
    const repoLocale = toRepoLocale(uiLocale);
    if (seenRepoLocales.has(repoLocale)) continue;
    seenRepoLocales.add(repoLocale);

    register(repoLocale, () =>
      fetch(`${baseUrl}/${repoLocale}/common.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.json();
        })
        .then((flat: Record<string, string>) => unflattenObject(flat))
        .catch(() => ({})) // on CDN failure, bundled TS fallback is used via tCommon
    );
  }

  init({
    fallbackLocale: "en",
    initialLocale: toRepoLocale(initialUiLocale)
  });
};

export const setI18nLocale = async (localeValue: string): Promise<SupportedUiLocale> => {
  const uiLocale = normalizeUiLocale(localeValue);
  if (!browser) return uiLocale;

  const repoLocale = toRepoLocale(uiLocale);
  setupI18n(uiLocale);

  localeLoadingCount.update((n) => n + 1);
  try {
    if (get(svelteLocale) !== repoLocale) {
      svelteLocale.set(repoLocale);
    }
    await waitLocale(repoLocale);
  } finally {
    localeLoadingCount.update((n) => Math.max(0, n - 1));
  }

  return uiLocale;
};

export const tCommon = (localeValue: string, key: string, fallback?: string): string => {
  const uiLocale = normalizeUiLocale(localeValue);
  // Bundled TS translation is always the fallback (works on SSR + CDN failure)
  const fallbackValue = getContentSiteCommonText(uiLocale, key, fallback ?? key);

  if (!browser || !initialized) return fallbackValue;

  const translateFn = get(_);
  const value = translateFn(key, { default: fallbackValue });
  return typeof value === "string" ? value : fallbackValue;
};

export const getThemeModeLabel = (
  localeValue: string,
  themeMode: "light" | "dark" | "auto"
): string => {
  const locale = normalizeUiLocale(localeValue);
  return themeModeLabelsByLocale[locale][themeMode];
};
