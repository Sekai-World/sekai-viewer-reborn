import { cleanup, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardListCard from "./CardListCard.svelte";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));

vi.mock("$lib/settings/content-display", () => ({
  getContentDisplaySettings: () => ({ mosaickedSpoilerContent: false })
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const props = {
  href: "/card/jp/1",
  region: "en" as const,
  idLabel: "ID",
  spoilerContentLabel: "Spoiler",
  cardListCharacterFallback: "Character",
  cardListReleaseLabel: "Release",
  cardImageAltSuffix: "artwork",
  displayLocale: "en",
  item: {
    id: "1",
    prefix: "Special card",
    assetBundleName: "special-card",
    attr: "cool",
    rarityType: "rarity_4",
    characterId: null,
    characterName: null,
    unit: null,
    supportUnit: null,
    initialSpecialTrainingStatus: "done",
    releaseAt: null,
    archivePublishedAt: null
  }
};

describe("CardListCard trained-only artwork and stars", () => {
  it.each(["grid", "agenda", "comfy"] as const)(
    "shows only trained artwork and one trained star stack in %s view",
    async (viewMode) => {
      vi.stubGlobal("IntersectionObserver", undefined);
      const { container, getAllByAltText } = render(CardListCard, { ...props, viewMode });
      await tick();
      const images = getAllByAltText("Special card artwork");
      expect(images).toHaveLength(1);
      expect(images[0].getAttribute("src")).toContain("after_training.webp");
      expect(
        container.querySelectorAll('image[href$="/rarity_star_afterTraining.png"]')
      ).toHaveLength(4);
      expect(container.querySelector('image[href$="/rarity_star_normal.png"]')).toBeNull();
      expect(container.querySelector(".card-grid-split-stage")).toBeNull();
      expect(container.querySelector(".card-grid-hover-area")).toBeNull();
    }
  );

  it("preserves both artwork states and star stacks for ordinary trainable grid cards", async () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    const { container, getAllByAltText } = render(CardListCard, {
      ...props,
      viewMode: "grid",
      item: { ...props.item, initialSpecialTrainingStatus: "not_done" }
    });
    await tick();
    const sources = getAllByAltText("Special card artwork").map((image) =>
      image.getAttribute("src")
    );
    expect(sources).toHaveLength(2);
    expect(sources.some((src) => src?.endsWith("card_normal.webp"))).toBe(true);
    expect(sources.some((src) => src?.endsWith("card_after_training.webp"))).toBe(true);
    expect(container.querySelectorAll('image[href$="/rarity_star_normal.png"]')).toHaveLength(4);
    expect(
      container.querySelectorAll('image[href$="/rarity_star_afterTraining.png"]')
    ).toHaveLength(4);
    expect(container.querySelector(".card-grid-split-stage")).not.toBeNull();
  });
});
