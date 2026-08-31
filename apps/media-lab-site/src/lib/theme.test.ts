import { describe, expect, it, vi } from "vitest";
import {
  applyDocumentTheme,
  normalizeThemeMode,
  normalizeThemeName,
  resolveThemeMode,
  THEME_MODE_STORAGE_KEY,
  THEME_NAME_STORAGE_KEY
} from "./theme";

describe("media-lab-site theme preferences", () => {
  it("uses app-scoped storage keys", () => {
    expect(THEME_MODE_STORAGE_KEY).toBe("media_lab_site_theme_mode");
    expect(THEME_NAME_STORAGE_KEY).toBe("media_lab_site_theme_name");
  });

  it("normalizes supported values and falls back for invalid values", () => {
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("unexpected")).toBe("auto");
    expect(normalizeThemeMode(null)).toBe("auto");
    expect(normalizeThemeName("mint")).toBe("mint");
    expect(normalizeThemeName("unexpected")).toBe("default");
    expect(normalizeThemeName(null)).toBe("default");
  });

  it("resolves auto and applies the palette and dark class", () => {
    const classes = new Set<string>();
    const element = {
      dataset: {} as DOMStringMap,
      classList: {
        toggle: (name: string, enabled: boolean) =>
          enabled ? classes.add(name) : classes.delete(name)
      },
      setAttribute: vi.fn()
    } as unknown as Element;

    expect(resolveThemeMode("auto", "dark")).toBe("dark");
    expect(resolveThemeMode("light", "dark")).toBe("light");
    expect(applyDocumentTheme(element, "sakura", "auto", "dark")).toBe("dark");
    expect((element as Element & { dataset: DOMStringMap }).dataset.theme).toBe("sakura");
    expect(classes.has("dark")).toBe(true);
    expect(element.setAttribute).not.toHaveBeenCalled();
  });
});
