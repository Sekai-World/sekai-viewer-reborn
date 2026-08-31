export const themeNames = ["default", "sakura", "mint"] as const;
export const themeModes = ["auto", "light", "dark"] as const;

export type ThemeName = (typeof themeNames)[number];
export type ThemeMode = (typeof themeModes)[number];

export const isThemeName = (value: string): value is ThemeName =>
  themeNames.includes(value as ThemeName);
export const isThemeMode = (value: string): value is ThemeMode =>
  themeModes.includes(value as ThemeMode);

export type ResolvedTheme = "light" | "dark";

export const normalizeThemeMode = (value: string | null): ThemeMode =>
  value !== null && isThemeMode(value) ? value : "auto";

export const normalizeThemeName = (value: string | null): ThemeName =>
  value !== null && isThemeName(value) ? value : "default";

export const resolveThemeMode = (mode: ThemeMode, systemTheme: ResolvedTheme): ResolvedTheme =>
  mode === "auto" ? systemTheme : mode;

const hasDataset = (element: Element): element is Element & { dataset: DOMStringMap } =>
  "dataset" in element;

export const applyDocumentTheme = (
  documentElement: Element,
  name: ThemeName,
  mode: ThemeMode,
  systemTheme: ResolvedTheme
): ResolvedTheme => {
  const resolvedTheme = resolveThemeMode(mode, systemTheme);
  if (hasDataset(documentElement)) {
    documentElement.dataset.theme = name;
  } else {
    documentElement.setAttribute("data-theme", name);
  }
  documentElement.classList.toggle("dark", resolvedTheme === "dark");
  return resolvedTheme;
};
