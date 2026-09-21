import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Honor, HonorGroup } from "$lib/domain/honor";
import "$lib/icons/mdi";
import HonorsPage from "../../../routes/honors/[region]/+page.svelte";

const { goto, invalidateAll } = vi.hoisted(() => ({ goto: vi.fn(), invalidateAll: vi.fn() }));
vi.mock("$app/navigation", () => ({ goto, invalidateAll }));
vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const honor = (id: number): Honor => ({
  id,
  name: `Variant ${id}`,
  assetBundleName: null,
  group: null,
  groupId: 1,
  honorMissionType: null,
  honorRarity: null,
  honorType: null,
  honorTypeId: null,
  seq: null,
  levels: [
    {
      level: 3,
      description: `Requirement ${id}`,
      assetBundleName: null,
      bonus: null,
      honorId: id,
      honorRarity: null
    },
    {
      level: null,
      description: null,
      assetBundleName: null,
      bonus: null,
      honorId: id,
      honorRarity: null
    }
  ]
});
const group: HonorGroup = {
  id: 1,
  name: "Group identity",
  honorType: "normal",
  backgroundAssetBundleName: "group-art",
  frameName: null,
  honors: [honor(9), honor(2)]
};
type PageData = ComponentProps<typeof HonorsPage>["data"];
const result: Awaited<PageData["catalogue"]> = {
  items: [group],
  loadFailed: false,
  pagination: { page: 2, totalPages: 3, hasNext: true, pageSize: 12, total: 30 }
};
const data = (
  catalogue: PageData["catalogue"] | Awaited<PageData["catalogue"]>,
  region: PageData["region"] = "jp",
  page = 2
): PageData => ({
  region,
  query: { page },
  catalogue: Promise.resolve(catalogue),
  uiLocale: "en",
  preferredRegion: region,
  globalNotices: [],
  siteVersion: "test",
  i18nMessages: {
    "navigation.honors": "Honors",
    home: "Home",
    imageUnavailable: "Image unavailable"
  }
});

describe("Honors page group contract", () => {
  it("labels same-name members by localized rarity with name fallbacks", async () => {
    const rarities = ["low", "middle", "high", "highest", "future", null, ""];
    const variants = rarities.map((honorRarity, index) => ({
      ...honor(index + 1),
      name: index < 4 ? "一歌ファン" : `Fallback ${index}`,
      honorRarity
    }));
    const pageData = data({
      ...result,
      items: [{ ...group, name: "一歌ファン", honors: variants }]
    });
    const { container, rerender } = render(HonorsPage, {
      data: pageData,
      params: { region: "jp" },
      form: null
    });
    await screen.findByText("一歌ファン");
    await fireEvent.click(container.querySelector("summary")!);
    expect(container.querySelector("details")?.open).toBe(true);
    const headings = () =>
      screen.getAllByRole("heading", { level: 3 }).map((node) => node.textContent);
    expect(headings()).toEqual([
      "Low",
      "Middle",
      "High",
      "Highest",
      "Fallback 4",
      "Fallback 5",
      "Fallback 6"
    ]);
    expect(screen.getAllByText("一歌ファン")).toHaveLength(1);
    expect(container.querySelectorAll("dt")).toHaveLength(14);
    for (const member of variants) {
      expect(screen.getByText(`Requirement ${member.id}`)).toBeTruthy();
    }
    await rerender({
      data: {
        ...pageData,
        uiLocale: "ja-JP",
        i18nMessages: {
          "honor.rarity.low": "低",
          "honor.rarity.middle": "中",
          "honor.rarity.high": "高",
          "honor.rarity.highest": "最高"
        }
      }
    });
    await waitFor(() =>
      expect(headings()).toEqual([
        "低",
        "中",
        "高",
        "最高",
        "Fallback 4",
        "Fallback 5",
        "Fallback 6"
      ])
    );
    expect(screen.getAllByText("一歌ファン")).toHaveLength(1);
  });

  it("streams full groups without filtering levels and preserves URL navigation", async () => {
    let complete!: (value: Awaited<PageData["catalogue"]>) => void;
    const pending = new Promise<Awaited<PageData["catalogue"]>>((resolve) => {
      complete = resolve;
    });
    const { container, rerender } = render(HonorsPage, {
      data: data(pending),
      params: { region: "jp" },
      form: null
    });
    expect(screen.getByRole("status").textContent).toContain("Loading honors");
    complete(result);
    await screen.findByText("Group identity");
    expect(screen.getAllByText("Group identity")).toHaveLength(1);
    await fireEvent.click(container.querySelector("summary")!);
    expect(Array.from(container.querySelectorAll("h3"), (node) => node.textContent)).toEqual([
      "Variant 9",
      "Variant 2"
    ]);
    expect(container.querySelectorAll("dt")).toHaveLength(4);
    expect(screen.getByText("Requirement 9")).toBeTruthy();
    expect(screen.getByText("Requirement 2")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(goto).toHaveBeenLastCalledWith("/honors/jp?page=3");
    await fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(goto).toHaveBeenLastCalledWith("/honors/jp?page=1");
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe("/honors/en");
    await rerender({ data: data(result, "jp", 3) });
    await waitFor(() => expect(container.querySelector("details")?.open).toBe(false));
    await fireEvent.click(container.querySelector("summary")!);
    await rerender({ data: data(result, "en", 3) });
    await waitFor(() => expect(container.querySelector("details")?.open).toBe(false));
  });

  it("keeps handled and rejected stream errors retryable and supports empty groups", async () => {
    const { rerender } = render(HonorsPage, {
      params: { region: "jp" },
      form: null,
      data: data(Promise.resolve({ ...result, loadFailed: true, items: [] }))
    });
    await screen.findByText("Honors could not be loaded. Please try again.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invalidateAll).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    await rerender({ data: data(Promise.resolve({ ...result, items: [] })) });
    await screen.findByText("No honors found. Try another region.");
    const rejected = Promise.reject(new Error("Failed"));
    rejected.catch(() => {});
    await rerender({ data: data(rejected) });
    await screen.findByText("Honors could not be loaded. Please try again.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invalidateAll).toHaveBeenCalledTimes(2);
  });
});
