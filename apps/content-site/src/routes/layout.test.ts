import { cleanup, render, screen, waitFor } from "@testing-library/svelte";
import { createRawSnippet, tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Layout from "./+layout.svelte";
import type { LayoutData } from "./$types";

type TourProps = {
  open: boolean;
  steps: readonly { target: string }[];
  onStepChange: (index: number) => Promise<void>;
  resolveTarget: (target: string) => HTMLElement | readonly HTMLElement[] | null;
  onClose: () => void;
};
const tour = vi.hoisted(() => ({ props: null as TourProps | null }));
const appState = vi.hoisted(() => ({ updated: { current: false } }));
const onboardingState = vi.hoisted(() => ({ seen: false, seenVersion: null as string | null }));

vi.mock("#lib/components/OnboardingDialog.svelte", () => ({
  default: (_anchor: unknown, props: TourProps) => {
    tour.props = props;
    return {};
  }
}));
vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/cards/jp") },
  updated: appState.updated
}));
vi.mock("$app/navigation", () => ({ goto: vi.fn(), refreshAll: vi.fn() }));
vi.mock("$app/paths", () => ({ asset: (path: string) => path, resolve: (path: string) => path }));
vi.mock("#lib/onboarding.js", () => ({
  readOnboardingSeen: () => onboardingState.seen,
  readSeenSiteVersion: () => onboardingState.seenVersion,
  writeOnboardingSeen: vi.fn(),
  writeSeenSiteVersion: vi.fn()
}));
vi.mock("#lib/i18n/runtime.js", async () => {
  const { readable } = await import("svelte/store");
  return {
    createI18nTranslator: () => (key: string) => key,
    resolveStreamingMessages: () => ({}),
    requestI18nLocale: () => 0,
    setI18nLocale: async (locale: string) => locale,
    isLocaleLoading: readable(false)
  };
});

let viewport = 1440;
let originalRootLanguage: string | null = null;
let originalRootDirection: string | null = null;
beforeEach(() => {
  tour.props = null;
  appState.updated.current = false;
  onboardingState.seen = false;
  onboardingState.seenVersion = null;
  originalRootLanguage = document.documentElement.getAttribute("lang");
  originalRootDirection = document.documentElement.getAttribute("dir");
  localStorage.clear();
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width: 639px")
      ? viewport < 640
      : query.includes("min-width: 1280px") && viewport >= 1280,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }));
  vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue(
    new DOMRect(30, 70, 240, 44)
  );
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(30, 70, 240, 44)
  ] as unknown as DOMRectList);
});
afterEach(() => {
  cleanup();
  if (originalRootLanguage === null) {
    document.documentElement.removeAttribute("lang");
  } else {
    document.documentElement.setAttribute("lang", originalRootLanguage);
  }
  if (originalRootDirection === null) {
    document.documentElement.removeAttribute("dir");
  } else {
    document.documentElement.setAttribute("dir", originalRootDirection);
  }
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const setup = async (width: number, uiLocale: LayoutData["uiLocale"] = "en") => {
  viewport = width;
  const result = render(Layout, {
    data: {
      uiLocale,
      preferredRegion: "jp",
      siteVersion: "0.0.2",
      i18nMessages: {},
      globalNotices: []
    } satisfies LayoutData,
    children: createRawSnippet(() => ({ render: () => "<div></div>" }))
  });
  await waitFor(() => expect(tour.props?.open).toBe(true));
  const props = tour.props!;
  const prepare = (target: string) => {
    const index = props.steps.findIndex((step) => step.target === target);
    expect(index).toBeGreaterThanOrEqual(0);
    return props.onStepChange(index);
  };
  const button = (id: string) =>
    result.container.querySelector<HTMLButtonElement>(`button[aria-controls="${id}"]`)!;
  return { ...result, props, prepare, button };
};

it("sets the document language and direction for an RTL locale", async () => {
  await setup(1440, "ar");

  await waitFor(() => {
    expect(document.documentElement.lang).toBe("ar");
    expect(document.documentElement.dir).toBe("rtl");
  });
});

it("bounds the desktop language menu and keeps all alternative locales focusable", async () => {
  const { props, button, container } = await setup(1440);
  props.onClose();
  await tick();
  const trigger = button("content-site-locale-menu");
  trigger.click();
  await tick();

  const menu = container.querySelector<HTMLElement>("#content-site-locale-menu")!;
  expect(menu.classList.contains("max-h-[calc(100dvh-6rem)]")).toBe(true);
  expect(menu.classList.contains("overflow-y-auto")).toBe(true);
  expect(menu.classList.contains("overflow-x-hidden")).toBe(true);
  expect(menu.classList.contains("overflow-hidden")).toBe(false);
  const options = [...menu.querySelectorAll<HTMLButtonElement>("li button")];
  expect(options).toHaveLength(28);
  for (const option of options) {
    expect(option.disabled).toBe(false);
    expect(option.tabIndex).toBe(0);
    option.focus();
    expect(document.activeElement).toBe(option);
  }
  expect(options.at(-1)?.textContent).toContain("繁體中文(zh-TW)");

  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await tick();
  expect(container.querySelector("#content-site-locale-menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

describe.each([1440, 390])("layout appearance/language tour at %spx", (width) => {
  it("orders real closed triggers before their open option groups, in both directions", async () => {
    const { props, prepare, button, container } = await setup(width);
    const mobile = width < 640;
    const mobileId = "content-site-mobile-settings-menu";
    const themeId = "content-site-desktop-theme-menu";
    const languageId = "content-site-locale-menu";
    const sequence = props.steps.map((step) => step.target);
    const start = sequence.indexOf("content-display-ongoing-first");
    expect(sequence.slice(start, start + 5)).toEqual([
      "content-display-ongoing-first",
      "theme-trigger",
      "theme",
      "language-trigger",
      "language"
    ]);
    const savedPreferences = JSON.stringify({ ...localStorage });

    for (const kind of ["theme", "language"]) {
      const menuId = mobile ? mobileId : kind === "theme" ? themeId : languageId;
      const trigger = button(menuId);
      await prepare(`${kind}-trigger`);
      expect(props.resolveTarget(`${kind}-trigger`)).toBe(trigger);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector(`[id="${menuId}"]`)).toBeNull();
      await prepare(kind);
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      const menu = container.querySelector(`[id="${menuId}"]`)!;
      const options = props.resolveTarget(kind) as HTMLElement;
      expect(menu === options || menu.contains(options)).toBe(true);
      expect(options.querySelectorAll("button:not(:disabled)").length).toBeGreaterThan(1);
      await prepare(`${kind}-trigger`);
      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(container.querySelector(`[id="${menuId}"]`)).toBeNull();
    }

    // Back from the language entry restores appearance options, not language options.
    await prepare("language-trigger");
    await prepare("theme");
    expect(button(mobile ? mobileId : themeId).getAttribute("aria-expanded")).toBe("true");
    if (!mobile) expect(button(languageId).getAttribute("aria-expanded")).toBe("false");
    props.onClose();
    await tick();
    expect(button(mobile ? mobileId : themeId).getAttribute("aria-expanded")).toBe("false");
    expect(JSON.stringify({ ...localStorage })).toBe(savedPreferences);
  });

  it("keeps the last requested open/closed state during fast next/back preparation", async () => {
    const { prepare, button } = await setup(width);
    const trigger = button(
      width < 640 ? "content-site-mobile-settings-menu" : "content-site-desktop-theme-menu"
    );
    await Promise.all([prepare("theme"), prepare("theme-trigger")]);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    await Promise.all([prepare("theme-trigger"), prepare("theme")]);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
  });
});

it("does not resume stale drawer scrolling after a later trigger step", async () => {
  const { prepare, container } = await setup(390);
  const panel = container.querySelector<HTMLElement>("#content-site-drawer-panel")!;
  let finishEntry = () => {};
  const finished = new Promise<void>((resolve) => {
    finishEntry = resolve;
  });
  Object.defineProperty(panel, "getAnimations", { value: () => [{ finished }] });
  const earlierStep = prepare("sidebar-library");
  await tick();
  await prepare("theme-trigger");
  const scroller = panel.parentElement!;
  scroller.scrollTop = 37;
  finishEntry();
  await earlierStep;
  expect(scroller.scrollTop).toBe(37);
});

describe("deployment update prompt", () => {
  const renderReturningVisitor = () => {
    onboardingState.seen = true;
    onboardingState.seenVersion = "0.0.1";
    return render(Layout, {
      data: {
        uiLocale: "en",
        preferredRegion: "jp",
        siteVersion: "0.0.2",
        i18nMessages: {},
        globalNotices: []
      } satisfies LayoutData,
      children: createRawSnippet(() => ({ render: () => "<div></div>" }))
    });
  };

  it("announces a detected deployment in a live region that exists beforehand", async () => {
    appState.updated.current = true;
    let respond: (response: Response) => void = () => {};
    const fetchVersion = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchVersion);

    const { container } = renderReturningVisitor();

    const region = container.querySelector<HTMLElement>("[data-deployment-update-region]");
    expect(region?.getAttribute("role")).toBe("status");
    await waitFor(() => expect(fetchVersion).toHaveBeenCalledTimes(1));
    expect(region?.textContent?.trim()).toBe("");
    expect(fetchVersion).toHaveBeenCalledWith("/_app/version.json", { cache: "no-store" });

    respond(new Response(JSON.stringify({ version: "next-build" }), { status: 200 }));

    const title = await screen.findByText("updates.deployment.title");
    expect(region?.contains(title)).toBe(true);
    expect(title.closest("section")?.hasAttribute("role")).toBe(false);
    expect(screen.getByRole("button", { name: "updates.deployment.reloadLabel" })).toBeTruthy();
    expect(screen.queryByText("updates.notice.title")).toBeNull();

    screen.getByRole("button", { name: "updates.deployment.dismissLabel" }).click();
    await waitFor(() => expect(screen.queryByText("updates.deployment.title")).toBeNull());
    expect(localStorage.getItem("content_site_dismissed_deployment")).toBe("next-build");
    expect(screen.queryByText("updates.notice.title")).toBeNull();
    expect(container.querySelector("[data-deployment-update-region]")).toBe(region);
  });

  it("keeps the curated notice when the deployment check fails", async () => {
    const failingFetch = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    vi.stubGlobal("fetch", failingFetch);
    appState.updated.current = true;

    renderReturningVisitor();

    await waitFor(() => expect(failingFetch).toHaveBeenCalledTimes(1));
    // Let the rejected request settle before checking that nothing changed.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await tick();

    const curatedTitle = await screen.findByText("updates.notice.title");
    expect(curatedTitle.closest("section")?.getAttribute("role")).toBe("alert");
    expect(screen.queryByText("updates.deployment.title")).toBeNull();
  });
});
