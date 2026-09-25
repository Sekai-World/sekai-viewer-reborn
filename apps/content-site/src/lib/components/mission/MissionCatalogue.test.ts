import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import "$lib/icons/mdi";
import MissionCatalogue, { type MissionCatalogueGroup } from "./MissionCatalogue.svelte";

afterEach(cleanup);

const groups: MissionCatalogueGroup[] = [
  {
    family: "storyMissions",
    label: "Story missions",
    countLabel: "2 missions shown",
    items: [
      {
        key: "story-1",
        sentence: "Read a story",
        requirementLabel: "Target: 1",
        rewards: [
          {
            detail: { resourceType: "coin", resourceId: null },
            label: "Coins",
            quantityLabel: "×100"
          }
        ]
      },
      {
        key: "story-2",
        sentence: "Read a story",
        requirementLabel: "Target: 2",
        rewards: [
          {
            detail: { resourceType: "coin", resourceId: null },
            label: "Coins",
            quantityLabel: "×200"
          }
        ]
      }
    ]
  },
  {
    family: "normalMissions",
    label: "Normal missions",
    countLabel: "1 mission shown",
    items: [{ key: "normal-1", sentence: "Play a live" }]
  }
];

const familyLabel = (family: "storyMissions" | "characterMissionV2s" | "normalMissions" | null) =>
  family === null
    ? "All missions"
    : family === "storyMissions"
      ? "Story missions"
      : family === "characterMissionV2s"
        ? "Character missions"
        : "Normal missions";

const props = {
  groups,
  catalogueKey: "jp:all",
  rewardsLabel: "Rewards",
  region: "jp" as const,
  familyLabel: "Mission family",
  selectedFamily: null,
  getFamilyLabel: familyLabel,
  onFamilyChange: vi.fn(),
  loadMoreLabel: "Load more missions",
  loadingMoreLabel: "Loading more missions...",
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
    previous: "",
    next: ""
  }
};

describe("MissionCatalogue", () => {
  it("renders every family section expanded with mission details visible", () => {
    const { container } = render(MissionCatalogue, props);

    expect(screen.getByRole("heading", { name: /^Story missions/ })).toBeTruthy();
    expect(screen.getByRole("heading", { name: /^Normal missions/ })).toBeTruthy();
    expect(container.querySelectorAll("details")).toHaveLength(0);
    expect(screen.getAllByText("Read a story")).toHaveLength(2);
    expect(screen.getByText("Target: 1")).toBeTruthy();
    expect(screen.getByText("Target: 2")).toBeTruthy();
    const [firstRewards, secondRewards] = screen.getAllByRole("list", { name: "Rewards" });
    expect(firstRewards?.textContent?.replace(/\s+/g, " ").trim()).toBe("Coins ×100");
    expect(secondRewards?.textContent?.replace(/\s+/g, " ").trim()).toBe("Coins ×200");
    expect(screen.getByText("Play a live")).toBeTruthy();
    expect(
      Array.from(container.querySelectorAll("ul")).some((element) =>
        element.classList.contains("lg:grid-cols-2")
      )
    ).toBe(true);
  });

  it("renders a compact overview with family totals, previews, and family actions", async () => {
    const onFamilyChange = vi.fn();
    const { container } = render(MissionCatalogue, {
      ...props,
      overview: true,
      hasNext: true,
      onLoadMore: vi.fn(),
      onFamilyChange,
      groups: [
        {
          ...groups[0],
          countLabel: "40 missions",
          browseLabel: "View all (40)",
          browseAriaLabel: "View all Story missions",
          items: groups[0].items.slice(0, 1)
        }
      ]
    });

    const viewAll = screen.getByRole("button", { name: "View all Story missions" });
    expect(viewAll.textContent?.trim()).toBe("View all (40)");
    expect(viewAll.className).toContain("btn-ghost");
    expect(screen.queryByText("40 missions")).toBeNull();
    expect(screen.getByText("Read a story")).toBeTruthy();
    expect(screen.queryByText("Target: 1")).toBeNull();
    expect(
      screen.getByRole("heading", { name: /Story missions/ }).closest("section")?.classList
    ).toContain("content-card-shell");
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
    expect(screen.queryByText("You have reached the end.")).toBeNull();
    expect(
      Array.from(container.querySelectorAll("div")).some((element) =>
        element.classList.contains("lg:grid-cols-3")
      )
    ).toBe(true);
    await fireEvent.click(viewAll);
    expect(onFamilyChange).toHaveBeenCalledWith("storyMissions");
  });

  it("renders a carded skeleton for an overview family that is still loading", () => {
    render(MissionCatalogue, {
      ...props,
      overview: true,
      groups: [
        {
          ...groups[0],
          status: "loading",
          statusLabel: "Loading missions...",
          countLabel: "",
          browseLabel: "View all",
          browseAriaLabel: "View all Story missions",
          items: []
        }
      ]
    });

    const section = screen.getByRole("heading", { name: /Story missions/ }).closest("section")!;
    expect(section.classList).toContain("content-card-shell");
    expect(section.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("Loading missions...");
    expect(section.querySelectorAll('[aria-hidden="true"] > div')).toHaveLength(3);
    expect(
      screen.getByRole("button", { name: "View all Story missions" }).textContent?.trim()
    ).toBe("View all");
  });

  it("renders a family's custom body in place of the item list", () => {
    const groupBody = createRawSnippet((group: () => MissionCatalogueGroup) => ({
      render: () => `<p>Custom ${group().label}</p>`
    }));
    render(MissionCatalogue, {
      ...props,
      groupBody,
      groups: [
        {
          family: "characterMissionV2s",
          label: "Character missions",
          countLabel: "1 mission shown",
          items: [{ key: "character-1", sentence: "Complete … character tasks" }]
        }
      ]
    });

    const section = screen.getByRole("heading", { name: /Character missions/ }).closest("section")!;
    expect(within(section).getByText("Custom Character missions")).toBeTruthy();
    expect(within(section).queryByText("Complete … character tasks")).toBeNull();
  });

  it("renders the family tablist with one selected family", async () => {
    const onFamilyChange = vi.fn();
    render(MissionCatalogue, { ...props, onFamilyChange, selectedFamily: "storyMissions" });

    const tablist = screen.getByRole("tablist", { name: "Mission family" });
    expect(screen.getAllByRole("tab")).toHaveLength(4);
    expect(screen.getByRole("tab", { name: "All missions" }).getAttribute("aria-selected")).toBe(
      "false"
    );
    expect(screen.getByRole("tab", { name: "Story missions" }).getAttribute("aria-selected")).toBe(
      "true"
    );
    expect(screen.getByRole("tab", { name: "Character missions" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "Normal missions" })).toBeTruthy();
    expect(tablist.querySelectorAll("button")).toHaveLength(4);

    await fireEvent.click(screen.getByRole("tab", { name: "All missions" }));
    expect(onFamilyChange).toHaveBeenCalledWith(null);
  });

  it("keeps region links and does not render page navigation", () => {
    render(MissionCatalogue, props);

    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe("/missions/en");
    expect(screen.queryByRole("button", { name: "Previous" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByText(/Page \d+ of \d+/)).toBeNull();
  });

  it("renders grouped loading placeholders without page navigation", () => {
    const { container } = render(MissionCatalogue, {
      ...props,
      status: "loading",
      groups: [],
      loadingGroupCount: 2
    });

    expect(screen.getByRole("status").textContent).toBe("Loading missions...");
    expect(container.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(container.querySelector('[aria-hidden="true"] > .flex')?.children).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(container.querySelector("details")).toBeNull();
  });

  it("renders load-more, loading, retry, and end states", async () => {
    const onLoadMore = vi.fn();
    const onRetryLoadMore = vi.fn();
    const { rerender } = render(MissionCatalogue, {
      ...props,
      hasNext: true,
      onLoadMore,
      onRetryLoadMore
    });

    await fireEvent.click(screen.getByRole("button", { name: "Load more missions" }));
    expect(onLoadMore).toHaveBeenCalledOnce();

    await rerender({ ...props, hasNext: true, isLoadingMore: true, onLoadMore });
    expect(screen.getByRole("status").textContent).toContain("Loading more missions...");
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();

    await rerender({
      ...props,
      hasNext: true,
      loadMoreError: "More missions could not be loaded.",
      onRetryLoadMore
    });
    expect(screen.getByText("More missions could not be loaded.")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetryLoadMore).toHaveBeenCalledOnce();

    await rerender({ ...props, hasNext: false, loadMoreError: null });
    // A finished list ends without a footer.
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
  });

  it("preserves error retry and empty feedback without a search field", async () => {
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
