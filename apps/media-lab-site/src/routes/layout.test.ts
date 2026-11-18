// @vitest-environment jsdom

import { cleanup, fireEvent, render, waitFor } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uiLocaleNameByCode, type SupportedUiLocale } from "#lib/i18n/region.js";
import type { LayoutData } from "./$types";

const navigation = vi.hoisted(() => ({
  refreshAll: vi.fn<() => Promise<void>>(async () => {})
}));

vi.mock("$app/navigation", () => ({
  beforeNavigate: vi.fn(),
  goto: vi.fn(),
  refreshAll: navigation.refreshAll
}));
vi.mock("$app/state", () => ({
  navigating: { to: null },
  page: { url: new URL("http://localhost/story-reader") }
}));
vi.mock("#lib/story/asset-cache-client.js", () => ({ registerStoryAssetCache: vi.fn() }));

import Layout from "./+layout.svelte";

const LANGUAGE_MENU_ID = "media-lab-site-desktop-language-menu";

let cookieWrites: string[] = [];

const renderLayout = (uiLocale: SupportedUiLocale = "en") =>
  render(Layout, {
    data: {
      uiLocale,
      siteVersion: "0.0.0",
      i18nMessages: {},
      globalNotices: [],
      assetBase: "/assets"
    } satisfies LayoutData,
    children: createRawSnippet(() => ({ render: () => "<div></div>" }))
  });

const openLanguageMenu = async (container: HTMLElement): Promise<HTMLElement> => {
  const trigger = container.querySelector<HTMLButtonElement>(
    `button[aria-controls="${LANGUAGE_MENU_ID}"]`
  );
  if (!trigger) throw new Error("language menu trigger not rendered");
  await fireEvent.click(trigger);
  const menu = container.querySelector<HTMLElement>(`#${LANGUAGE_MENU_ID}`);
  if (!menu) throw new Error("language menu did not open");
  return menu;
};

const optionFor = (menu: HTMLElement, locale: SupportedUiLocale): HTMLButtonElement => {
  const label = menu.querySelector(`li button > span[lang="${locale}"]`);
  const option = label?.closest("button");
  if (!(option instanceof HTMLButtonElement)) throw new Error(`no option for ${locale}`);
  return option;
};

beforeEach(() => {
  cookieWrites = [];
  vi.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
    cookieWrites.push(value);
  });
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("lang");
  document.documentElement.removeAttribute("dir");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("media-lab-site language selector", () => {
  it("lists all 29 locales by native name, each tagged with its language", async () => {
    const { container } = renderLayout("en");
    const menu = await openLanguageMenu(container);

    const labels = [...menu.querySelectorAll<HTMLElement>("li button > span[lang]")];
    expect(labels).toHaveLength(29);
    const locales = labels.map((label) => label.getAttribute("lang"));
    expect(new Set(locales).size).toBe(29);
    expect(locales).toEqual(expect.arrayContaining(["en", "ja-JP", "zh-TW", "ar", "he-IL"]));
    for (const label of labels) {
      const locale = label.getAttribute("lang") as SupportedUiLocale;
      expect(label.textContent).toBe(uiLocaleNameByCode[locale]);
    }
  });

  it("marks only the current locale as current", async () => {
    const { container } = renderLayout("ja-JP");
    const menu = await openLanguageMenu(container);

    const current = [...menu.querySelectorAll("li button[aria-current]")];
    expect(current).toEqual([optionFor(menu, "ja-JP")]);
    expect(current[0]?.getAttribute("aria-current")).toBe("true");
    expect(current[0]?.classList.contains("menu-active")).toBe(true);
    expect(optionFor(menu, "en").classList.contains("menu-active")).toBe(false);
  });

  it("stores the chosen locale in the site cookie, reloads data, and closes the menu", async () => {
    const { container } = renderLayout("en");
    const menu = await openLanguageMenu(container);

    await fireEvent.click(optionFor(menu, "he-IL"));

    expect(cookieWrites).toEqual([
      "media_lab_site_ui_locale=he-IL; Path=/; Max-Age=31536000; SameSite=Lax"
    ]);
    expect(navigation.refreshAll).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(container.querySelector(`#${LANGUAGE_MENU_ID}`)).toBeNull());
  });

  it("does nothing but close the menu when the current locale is chosen again", async () => {
    const { container } = renderLayout("en");
    const menu = await openLanguageMenu(container);

    await fireEvent.click(optionFor(menu, "en"));

    expect(cookieWrites).toEqual([]);
    expect(navigation.refreshAll).not.toHaveBeenCalled();
    await waitFor(() => expect(container.querySelector(`#${LANGUAGE_MENU_ID}`)).toBeNull());
  });

  it("offers the same locales in the mobile settings menu", async () => {
    const { container } = renderLayout("en");
    const trigger = container.querySelector<HTMLButtonElement>(
      'button[aria-controls="media-lab-site-mobile-settings-menu"]'
    );
    await fireEvent.click(trigger!);
    await tick();

    const menu = container.querySelector<HTMLElement>("#media-lab-site-mobile-settings-menu")!;
    expect(menu.querySelectorAll("li button > span[lang]")).toHaveLength(29);
  });
});

describe("media-lab-site document language", () => {
  it.each([
    ["ar", "rtl"],
    ["he-IL", "rtl"],
    ["ja-JP", "ltr"],
    ["en", "ltr"]
  ] as const)("renders %s as <html lang dir=%s>", async (locale, direction) => {
    renderLayout(locale);

    await waitFor(() => {
      expect(document.documentElement.lang).toBe(locale);
      expect(document.documentElement.dir).toBe(direction);
    });
  });
});
