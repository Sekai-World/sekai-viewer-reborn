import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import RewardItem from "./RewardItem.svelte";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.test" }
}));

afterEach(cleanup);

describe("RewardItem", () => {
  it("shows a game icon with its quantity and names it in the tooltip and label", () => {
    const { container } = render(RewardItem, {
      detail: { resourceType: "jewel", resourceId: null },
      region: "jp",
      label: "Crystals",
      quantityLabel: "×100"
    });

    const item = screen.getByRole("img", { name: "Crystals ×100" });
    expect(item.getAttribute("data-tip")).toBe("Crystals");
    expect(item.classList).toContain("tooltip");
    expect(item.textContent?.trim()).toBe("×100");
    expect(screen.queryByText("Crystals")).toBeNull();
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://assets.test/sekai-jp-assets/thumbnail/common_material/jewel.webp"
    );
  });

  it("tries the fallback icon, then shows the name as text", async () => {
    const { container } = render(RewardItem, {
      detail: { resourceType: "material", resourceId: 13 },
      region: "tw",
      label: "音樂卡",
      quantityLabel: "×10"
    });

    const image = () => container.querySelector("img");
    expect(image()?.getAttribute("src")).toContain("sekai-tc-assets");
    await fireEvent.error(image()!);
    expect(image()?.getAttribute("src")).toContain("sekai-jp-assets");
    await fireEvent.error(image()!);
    expect(image()).toBeNull();
    expect(screen.getByText("音樂卡")).toBeTruthy();
    expect(screen.getByText("×10")).toBeTruthy();
  });

  it("shows items without a known icon as text", () => {
    render(RewardItem, {
      detail: { resourceType: "honor", resourceId: 1 },
      region: "jp",
      label: "Honor",
      quantityLabel: "×1"
    });

    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText("Honor")).toBeTruthy();
  });
});
