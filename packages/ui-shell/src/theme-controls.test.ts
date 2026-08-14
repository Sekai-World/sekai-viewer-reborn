import { render, screen } from "@testing-library/svelte";
import { expect, it, vi } from "vitest";
import ThemeControls from "./theme-controls.svelte";

it("delegates palette and mode selections to its controlled callbacks", async () => {
  const onThemeNameChange = vi.fn();
  const onThemeModeChange = vi.fn();
  render(ThemeControls, {
    themeName: "default",
    themeMode: "auto",
    paletteLabel: "Palette",
    modeLabel: "Mode",
    labels: { default: "Default", sakura: "Sakura", mint: "Mint", auto: "Auto", light: "Light", dark: "Dark" },
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
    themeName: "default", themeMode: "auto", paletteLabel: "Palette", modeLabel: "Mode",
    labels: { default: "Default", sakura: "Sakura", mint: "Mint", auto: "Auto", light: "Light", dark: "Dark" },
    onThemeNameChange: vi.fn(), onThemeModeChange
  });
  const mode = screen.getByRole("combobox", { name: "Mode" }) as HTMLSelectElement;
  mode.value = "unexpected";
  mode.dispatchEvent(new Event("change", { bubbles: true }));
  expect(onThemeModeChange).not.toHaveBeenCalled();
});
