import type { SupportedUiLocale } from "@platform/i18n-runtime";

export {
  getUiLocaleDirection,
  repoLocaleByUiLocale,
  supportedUiLocales
} from "@platform/i18n-runtime";
export type { SupportedUiLocale } from "@platform/i18n-runtime";

export const uiLocaleNameByCode: Record<SupportedUiLocale, string> = {
  ar: "العربية",
  "ca-ES": "Català",
  cs: "Čeština",
  de: "Deutsch",
  en: "English",
  es: "Español",
  "es-419": "Español (Latinoamérica)",
  "es-MX": "Español (México)",
  fr: "Français",
  "he-IL": "עברית",
  id: "Bahasa Indonesia",
  it: "Italiano",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  ms: "Bahasa Melayu",
  nl: "Nederlands",
  pl: "Polski",
  "pt-BR": "Português (Brasil)",
  pt: "Português",
  ro: "Română",
  ru: "Русский",
  "sk-SK": "Slovenčina",
  th: "ไทย",
  tr: "Türkçe",
  uk: "Українська",
  "vi-VN": "Tiếng Việt",
  yue: "粵語",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文"
};
