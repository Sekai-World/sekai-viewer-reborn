export const themeNames = ["default", "sakura", "mint"] as const;
export const themeModes = ["auto", "light", "dark"] as const;

export type ThemeName = (typeof themeNames)[number];
export type ThemeMode = (typeof themeModes)[number];

export const isThemeName = (value: string): value is ThemeName =>
  themeNames.includes(value as ThemeName);
export const isThemeMode = (value: string): value is ThemeMode =>
  themeModes.includes(value as ThemeMode);
