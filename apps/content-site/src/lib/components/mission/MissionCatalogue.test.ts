import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import MissionCatalogue, { type MissionCatalogueGroup } from "./MissionCatalogue.svelte";

afterEach(cleanup);

const groups: MissionCatalogueGroup[] = [
  {
    family: "storyMissions",
    label: "Story missions",
    countLabel: "On this page: 2",
    items: [
      {
        key: "story-1",
        sentence: "Read a story",
        requirementLabel: "Target: 1",
        rewardLabels: ["Coins ×100"]
      },
      {
        key: "story-2",
        sentence: "Read a story",
        requirementLabel: "Target: 2",
        rewardLabels: ["Coins ×200"]
      }
    ]
  },
  {
    family: "normalMissions",
    label: "Normal missions",
    countLabel: "On this page: 1",
    items: [{ key: "normal-1", sentence: "Play a live" }]
  }
];

const props = {
  groups,
  catalogueKey: "jp?page=1",
  rewardsLabel: "Rewards",
  homeHref: "/",
  regions: [
    { key: "jp", label: "JP", active: true, href: "/missions/jp" },
    { key: "en", label: "EN", active: false, href: "/missions/en" }
  ],
  labels: {
    title: "Missions",
    home: "Home",
    search: "",
    searchAction: "",
    loading: "Loading missions...",
    empty: "No missions found. Try another region.",
    error: "Missions could not be loaded.",
    retry: "Try again",
    previous: "Previous",
    next: "Next"
  }
};

describe("MissionCatalogue", () => {
  it("renders family identity once and exposes every member through a native disclosure", async () => {
    const { container } = render(MissionCatalogue, props);
    expect(screen.getAllByText("Story missions")).toHaveLength(1);
    expect(screen.getAllByText("Normal missions")).toHaveLength(1);
    expect(container.querySelectorAll("details")).toHaveLength(1);
    const details = container.querySelector("details")!;
    const summary = details.querySelector("summary")!;
    expect(details.open).toBe(false);
    expect(summary.querySelector("button, a, input")).toBeNull();
    await fireEvent.click(summary);
    expect(details.open).toBe(true);
    expect(screen.getAllByText("Read a story")).toHaveLength(2);
    expect(screen.getByText("Target: 1")).toBeTruthy();
    expect(screen.getByText("Target: 2")).toBeTruthy();
    expect(screen.getByText("Coins ×100")).toBeTruthy();
    expect(screen.getByText("Coins ×200")).toBeTruthy();
    expect(screen.getByText("Play a live").closest("details")).toBeNull();
    await fireEvent.click(summary);
    expect(details.open).toBe(false);
  });

  it("resets disclosure state on page or region changes", async () => {
    const { container, rerender } = render(MissionCatalogue, props);
    await fireEvent.click(container.querySelector("summary")!);
    expect(container.querySelector("details")?.open).toBe(true);
    await rerender({ ...props, catalogueKey: "jp?page=2" });
    expect(container.querySelector("details")?.open).toBe(false);
    await fireEvent.click(container.querySelector("summary")!);
    await rerender({ ...props, catalogueKey: "en?page=2" });
    expect(container.querySelector("details")?.open).toBe(false);
  });

  it("keeps region links and pagination callbacks", async () => {
    const onPrevious = vi.fn();
    const onNext = vi.fn();
    render(MissionCatalogue, { ...props, onPrevious, onNext, pageLabel: "Page 2 of 3" });
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe("/missions/en");
    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onPrevious).toHaveBeenCalledOnce();
    expect(onNext).toHaveBeenCalledOnce();
    expect(screen.getByText("Page 2 of 3")).toBeTruthy();
  });

  it("renders grouped loading placeholders and disables page navigation", () => {
    const { container } = render(MissionCatalogue, {
      ...props,
      status: "loading",
      groups: [],
      loadingGroupCount: 2,
      onNext: vi.fn()
    });
    expect(screen.getByRole("status").textContent).toBe("Loading missions...");
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"] > .flex')?.children).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Next" }).hasAttribute("disabled")).toBe(true);
    expect(container.querySelector("details")).toBeNull();
  });

  it("preserves error retry and empty feedback", async () => {
    const onRetry = vi.fn();
    const { rerender } = render(MissionCatalogue, {
      ...props,
      status: "error",
      groups: [],
      onRetry
    });
    expect(screen.getByText("Missions could not be loaded.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    await rerender({ ...props, status: "ready", groups: [] });
    expect(screen.getByRole("status").textContent).toContain("Try another region.");
    expect(screen.queryByRole("search")).toBeNull();
  });
});
