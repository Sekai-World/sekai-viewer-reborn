import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import HonorCatalogue, { type HonorCatalogueGroup } from "./HonorCatalogue.svelte";
import type { CatalogueHonorDegree } from "$lib/honor-degree";

const degree = (bundle: string): CatalogueHonorDegree => ({
  main: { kind: "normal", assetBundleName: bundle, rarity: "high", level: 3 },
  sub: { kind: "normal", assetBundleName: bundle, rarity: "high", level: 3 }
});

afterEach(cleanup);

const originalMatchMedia = window.matchMedia;

const setDialogViewport = (matches: boolean): void => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockReturnValue({
      matches,
      media: "(min-width: 768px)",
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    })
  });
};

afterEach(() => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: originalMatchMedia
  });
});

const items: HonorCatalogueGroup[] = [
  {
    key: "10",
    name: "Together on stage",
    degree: degree("group"),
    countLabel: "Honors: 2",
    members: [
      {
        key: "102",
        name: "Gold performer",
        degree: degree("group"),
        levels: [
          { label: "Level 3", description: "Play 300 lives" },
          { label: "Level 1", description: "Play 100 lives" },
          { label: "Honor levels", description: null }
        ]
      },
      {
        key: "101",
        name: "Silver performer",
        degree: degree("silver"),
        levels: [{ label: "Level 2", description: "Play 200 lives" }]
      }
    ]
  },
  {
    key: "20",
    name: "First steps",
    degree: degree("first"),
    countLabel: "Honors: 1",
    members: [
      {
        key: "201",
        name: "First steps",
        degree: degree("first"),
        levels: [{ label: "Level 1", description: "Complete the tutorial" }]
      }
    ]
  }
];

const props = {
  resolveAsset: (bundle: string, resource: string) => `/${bundle}/${resource}`,
  items,
  catalogueKey: "jp:1",
  imageUnavailableLabel: "Image unavailable",
  levelsLabel: "Honor levels",
  closeLabel: "Close",
  homeHref: "/",
  regions: [
    { key: "jp", label: "JP", active: true, href: "/honors/jp" },
    { key: "en", label: "EN", active: false, href: "/honors/en" }
  ],
  labels: {
    title: "Honors",
    home: "Home",
    search: "",
    searchAction: "",
    loading: "Loading honors...",
    empty: "No honors found. Try another region.",
    error: "Honors could not be loaded.",
    retry: "Try again",
    previous: "Previous",
    next: "Next"
  }
};

describe("HonorCatalogue", () => {
  it("shows only the variant label while retaining member artwork and levels", async () => {
    const { container } = render(HonorCatalogue, {
      ...props,
      items: [
        {
          ...items[0],
          members: items[0].members.map((member) => ({
            ...member,
            variantLabel: member.key === "102" ? "High" : "Middle"
          }))
        }
      ]
    });
    await fireEvent.click(container.querySelector("summary")!);
    expect(screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent)).toEqual([
      "High",
      "Middle"
    ]);
    expect(container.querySelector('svg[aria-label="Silver performer"]')).toBeTruthy();
    expect(container.querySelector('image[href="/honor/silver/degree_main.png"]')).toBeTruthy();
    expect(container.querySelectorAll("dt")).toHaveLength(4);
    expect(screen.getByText("Play 200 lives")).toBeTruthy();
  });

  it("renders group identity/artwork once and exposes all members and levels in source order", async () => {
    const { container } = render(HonorCatalogue, props);
    expect(screen.getAllByText("Together on stage")).toHaveLength(1);
    expect(container.querySelectorAll("details")).toHaveLength(1);
    const details = container.querySelector("details")!;
    const summary = details.querySelector("summary")!;
    expect(details.open).toBe(false);
    expect(summary.querySelector("button, a, input")).toBeNull();
    expect(summary.querySelectorAll('svg[viewBox="0 0 380 80"]')).toHaveLength(1);
    await fireEvent.click(summary);
    expect(details.open).toBe(true);
    expect(
      within(details)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent)
    ).toEqual(["Gold performer", "Silver performer"]);
    expect(Array.from(details.querySelectorAll("dt"), (node) => node.textContent)).toEqual([
      "Level 3",
      "Level 1",
      "Honor levels",
      "Level 2"
    ]);
    for (const description of ["Play 300 lives", "Play 100 lives", "Play 200 lives"]) {
      expect(within(details).getByText(description).closest("details")?.open).toBe(true);
    }
    expect(details.querySelectorAll('svg[viewBox="0 0 380 80"]')).toHaveLength(3);
    expect(details.querySelector("details")).toBeNull();
    await fireEvent.click(summary);
    expect(details.open).toBe(false);
  });

  it("uses an accessible native dialog on tablet and desktop and restores trigger focus", async () => {
    setDialogViewport(true);
    const { container } = render(HonorCatalogue, props);
    const trigger = await screen.findByRole("button", { name: /Together on stage/ });

    expect(container.querySelector("details")).toBeNull();
    expect(trigger.classList).toContain("cursor-pointer");
    expect(trigger.classList).toContain("hover:-translate-y-0.5");
    expect(trigger.classList).toContain("motion-reduce:transform-none");
    expect(trigger.parentElement?.classList).toContain("xl:grid-cols-3");
    expect(trigger.parentElement?.classList).toContain("2xl:grid-cols-4");
    expect(trigger.getAttribute("aria-haspopup")).toBe("dialog");
    await fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog") as HTMLDialogElement;
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(within(dialog).getByRole("heading", { name: "Together on stage" })).toBeTruthy();
    expect(
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((node) => node.textContent)
    ).toEqual(["Gold performer", "Silver performer"]);
    expect(dialog.querySelector("button button")).toBeNull();

    await fireEvent.keyDown(dialog, { key: "Escape" });
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);

    await fireEvent.click(trigger);
    await fireEvent.click(within(dialog).getByTitle("Close"));
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps grouped honors as an inline disclosure on mobile", async () => {
    setDialogViewport(false);
    const { container } = render(HonorCatalogue, props);
    const details = container.querySelector("details")!;

    expect(details).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(details.querySelector("summary button, summary a, summary input")).toBeNull();
    await fireEvent.click(details.querySelector("summary")!);
    expect(details.open).toBe(true);
    expect(within(details).getByRole("heading", { name: "Silver performer" })).toBeTruthy();
  });

  it("renders a singleton directly without repeated identity or a disclosure", () => {
    render(HonorCatalogue, props);
    expect(screen.getAllByText("First steps")).toHaveLength(1);
    expect(screen.getByText("Complete the tutorial")).toBeTruthy();
    expect(screen.getByText("Complete the tutorial").closest("details")).toBeNull();
  });

  it("resets native disclosure on page and region changes, not label updates", async () => {
    const { container, rerender } = render(HonorCatalogue, props);
    await fireEvent.click(container.querySelector("summary")!);
    await rerender({ ...props, levelsLabel: "Levels" });
    expect(container.querySelector("details")?.open).toBe(true);
    await rerender({ ...props, catalogueKey: "jp:2" });
    expect(container.querySelector("details")?.open).toBe(false);
    await fireEvent.click(container.querySelector("summary")!);
    await rerender({ ...props, catalogueKey: "en:2" });
    expect(container.querySelector("details")?.open).toBe(false);
  });

  it("preserves region links and page callbacks", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(HonorCatalogue, { ...props, onPrevious, onNext, pageLabel: "Page 2 of 3" });
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe("/honors/en");
    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("reserves twelve group panels while loading and disables page navigation", () => {
    const { container } = render(HonorCatalogue, {
      ...props,
      items: [],
      status: "loading",
      onNext: vi.fn()
    });
    expect(screen.getByRole("status").textContent).toBe("Loading honors...");
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"] > .grid')?.children).toHaveLength(12);
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
    expect(container.querySelector("details")).toBeNull();
  });

  it("preserves retry and empty feedback without suggesting search", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(HonorCatalogue, { ...props, status: "error", items: [], onRetry });
    expect(screen.getByRole("status").textContent).toContain("Honors could not be loaded.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    await rerender({ ...props, status: "ready", items: [] });
    expect(screen.getByRole("status").textContent).toContain(
      "No honors found. Try another region."
    );
    expect(screen.queryByRole("search")).toBeNull();
  });

  it("keeps category navigation visible for an empty filtered result", async () => {
    const onHonorTypeChange = vi.fn();
    const { container } = render(HonorCatalogue, {
      ...props,
      items: [],
      honorTypes: ["event", "future_category"],
      selectedHonorType: "event",
      categoryLabel: "Honor category",
      getHonorTypeLabel: (honorType) =>
        honorType === null ? "All honors" : honorType === "event" ? "Events" : "Other honors",
      onHonorTypeChange
    });

    const tablist = screen.getByRole("tablist", { name: "Honor category" });
    expect(screen.getByRole("status").textContent).toBe("No honors found. Try another region.");
    expect(within(tablist).getByRole("tab", { name: "Events" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(within(tablist).getByRole("tab", { name: "Other honors" })).toBeTruthy();
    expect(container.querySelector("details")).toBeNull();

    await fireEvent.click(within(tablist).getByRole("tab", { name: "All honors" }));
    expect(onHonorTypeChange).toHaveBeenCalledWith(null);
  });
});
