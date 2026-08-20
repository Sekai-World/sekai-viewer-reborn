import { describe, expect, it } from "vitest";
import { applyDocumentTheme, normalizeThemeMode, normalizeThemeName, resolveThemeMode } from "./theme";

describe("tools-site theme preferences", () => {
  it("normalizes only supported persisted values", () => {
    expect(normalizeThemeMode("dark")).toBe("dark");
    expect(normalizeThemeMode("unexpected")).toBe("auto");
    expect(normalizeThemeMode(null)).toBe("auto");
    expect(normalizeThemeName("mint")).toBe("mint");
    expect(normalizeThemeName("unexpected")).toBe("default");
    expect(normalizeThemeName(null)).toBe("default");
  });

  it("resolves auto against the system theme and updates a document-like element", () => {
    const attributes = new Map<string, string>();
    const classes = new Set<string>();
    const element = {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      classList: { toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name) }
    } as unknown as Element;
    expect(resolveThemeMode("auto", "dark")).toBe("dark");
    expect(applyDocumentTheme(element, "sakura", "auto", "dark")).toBe("dark");
    expect(attributes.get("data-theme")).toBe("sakura");
    expect(classes.has("dark")).toBe(true);
  });
});
