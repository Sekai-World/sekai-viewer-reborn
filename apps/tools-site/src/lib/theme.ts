import {
  isThemeMode,
  isThemeName,
  type ThemeMode,
  type ThemeName
} from "@platform/ui-shell/theme-controls";

export type { ThemeMode, ThemeName };
export type ResolvedTheme = "light" | "dark";

export const THEME_MODE_STORAGE_KEY = "tools_site_theme_mode";
export const THEME_NAME_STORAGE_KEY = "tools_site_theme_name";

export const normalizeThemeMode = (value: string | null): ThemeMode =>
  value !== null && isThemeMode(value) ? value : "auto";

export const normalizeThemeName = (value: string | null): ThemeName =>
  value !== null && isThemeName(value) ? value : "default";

export const resolveThemeMode = (mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme =>
  mode === "auto" ? systemTheme : mode;

export const applyDocumentTheme = (
  documentElement: Element,
  name: ThemeName,
  mode: ThemeMode,
  systemTheme: ResolvedTheme
): ResolvedTheme => {
  const resolvedTheme = resolveThemeMode(mode, systemTheme);
  documentElement.setAttribute("data-theme", name);
  documentElement.classList.toggle("dark", resolvedTheme === "dark");
  return resolvedTheme;
};
