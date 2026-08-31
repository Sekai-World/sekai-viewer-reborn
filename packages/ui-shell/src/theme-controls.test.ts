import { render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import ThemeControls from "./theme-controls.svelte";
import {
  applyDocumentTheme,
  normalizeThemeMode,
  normalizeThemeName,
  resolveThemeMode
} from "./theme-controls.types";

it("normalizes unsupported theme preferences", () => {
  expect(normalizeThemeMode("dark")).toBe("dark");
  expect(normalizeThemeMode("unexpected")).toBe("auto");
  expect(normalizeThemeMode(null)).toBe("auto");
  expect(normalizeThemeName("mint")).toBe("mint");
  expect(normalizeThemeName("unexpected")).toBe("default");
  expect(normalizeThemeName(null)).toBe("default");
});

it("resolves and applies a theme to an element with a dataset", () => {
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

it("sets the theme attribute when an element has no dataset", () => {
  const attributes = new Map<string, string>();
  const classes = new Set<string>();
  const element = {
    setAttribute: (name: string, value: string) => attributes.set(name, value),
    classList: {
      toggle: (name: string, enabled: boolean) =>
        enabled ? classes.add(name) : classes.delete(name)
    }
  } as unknown as Element;

  expect(applyDocumentTheme(element, "default", "light", "dark")).toBe("light");
  expect(attributes.get("data-theme")).toBe("default");
  expect(classes.has("dark")).toBe(false);
});

it("delegates palette and mode selections to its controlled callbacks", async () => {
  const onThemeNameChange = vi.fn();
  const onThemeModeChange = vi.fn();
  render(ThemeControls, {
    themeName: "default",
    themeMode: "auto",
    paletteLabel: "Palette",
    modeLabel: "Mode",
    labels: {
      default: "Default",
      sakura: "Sakura",
      mint: "Mint",
      auto: "Auto",
      light: "Light",
      dark: "Dark"
    },
    onThemeNameChange,
    onThemeModeChange
  });

  await screen.getByRole("button", { name: "Sakura" }).click();
  expect(onThemeNameChange).toHaveBeenCalledWith("sakura");
  const mode = screen.getByRole("combobox", { name: "Mode" }) as HTMLSelectElement;
  await mode.click();
  mode.value = "dark";
  mode.dispatchEvent(new Event("change", { bubbles: true }));
  expect(onThemeModeChange).toHaveBeenCalledWith("dark");
});

it("does not pass unexpected select values to the mode callback", async () => {
  const onThemeModeChange = vi.fn();
  render(ThemeControls, {
    themeName: "default",
    themeMode: "auto",
    paletteLabel: "Palette",
    modeLabel: "Mode",
    labels: {
      default: "Default",
      sakura: "Sakura",
      mint: "Mint",
      auto: "Auto",
      light: "Light",
      dark: "Dark"
    },
    onThemeNameChange: vi.fn(),
    onThemeModeChange
  });
  const mode = screen.getByRole("combobox", { name: "Mode" }) as HTMLSelectElement;
  mode.value = "unexpected";
  mode.dispatchEvent(new Event("change", { bubbles: true }));
  expect(onThemeModeChange).not.toHaveBeenCalled();
});
