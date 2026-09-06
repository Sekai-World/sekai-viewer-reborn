import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import GachaDetailPickupCard from "./GachaDetailPickupCard.svelte";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("GachaDetailPickupCard training presentation", () => {
  it.each([
    ["done", "after_training", "afterTraining"],
    ["not_done", "normal", "normal"],
    [null, "normal", "normal"]
  ])("uses matching artwork and stars for status %s", async (status, artworkState, starState) => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container, getByAltText } = render(GachaDetailPickupCard, {
      region: "en",
      title: "Pickups",
      weightLabel: "Weight",
      noPickupsLabel: "No pickups",
      cardAltSuffix: "artwork",
      pickupCards: [
        {
          cardId: "1",
          title: "Pickup card",
          assetBundleName: "pickup-card",
          rarityType: "rarity_4",
          initialSpecialTrainingStatus: status,
          attr: "cool",
          weight: null
        }
      ]
    });
    await tick();
    expect(getByAltText("Pickup card artwork").getAttribute("src")).toContain(
      `/sekai-jp-assets/thumbnail/chara/pickup-card_${artworkState}.webp`
    );
    expect(
      container.querySelectorAll(`image[href$="/rarity_star_${starState}.png"]`)
    ).toHaveLength(4);
    const otherState = starState === "normal" ? "afterTraining" : "normal";
    expect(container.querySelector(`image[href$="/rarity_star_${otherState}.png"]`)).toBeNull();
  });
});
