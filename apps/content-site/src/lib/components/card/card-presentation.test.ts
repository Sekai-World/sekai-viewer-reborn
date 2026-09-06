import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import CardThumbnail from "./CardThumbnail.svelte";
import {
  getCardThumbnailPresentation,
  isTrainedOnlyCard,
  resolveCardTrained
} from "./card-presentation";

vi.mock("$env/dynamic/public", () => ({
  env: { PUBLIC_REMOTE_ASSET_BASE_URL: "https://assets.example.test" }
}));

afterEach(cleanup);

describe("card training presentation", () => {
  it.each(["rarity_3", "rarity_4"])(
    "uses after-training assets and stars for trained-only %s cards",
    (rarityType) => {
      const card = {
        rarityType,
        assetBundleName: "special-card",
        initialSpecialTrainingStatus: "done"
      };
      const presentation = getCardThumbnailPresentation(card, "en", false);
      expect(presentation.src).toContain(
        "/sekai-jp-assets/thumbnail/chara/special-card_after_training.webp"
      );
      expect(presentation.fallbackSrc).toContain(
        "/sekai-en-assets/thumbnail/chara/special-card_after_training.webp"
      );
      expect(presentation.trained).toBe(true);

      const rarityCount = rarityType === "rarity_3" ? 3 : 4;
      const { container, getByAltText } = render(CardThumbnail, {
        ...presentation,
        rarityType,
        rarityCount,
        alt: "Special card",
        loadMode: "immediate"
      });
      expect(getByAltText("Special card").getAttribute("src")).toBe(presentation.src);
      expect(
        container.querySelectorAll('image[href$="/rarity_star_afterTraining.png"]')
      ).toHaveLength(rarityCount);
      expect(container.querySelector('image[href$="/rarity_star_normal.png"]')).toBeNull();
    }
  );

  it.each([false, true])("preserves ordinary cards' selected trained=%s state", (trained) => {
    const card = {
      rarityType: "rarity_4",
      assetBundleName: "ordinary-card",
      initialSpecialTrainingStatus: "not_done"
    };
    const presentation = getCardThumbnailPresentation(card, "jp", trained);
    expect(presentation.trained).toBe(trained);
    expect(presentation.src).toContain(
      `ordinary-card_${trained ? "after_training" : "normal"}.webp`
    );
    expect(presentation.fallbackSrc).toBeNull();
    const { container } = render(CardThumbnail, {
      ...presentation,
      rarityType: card.rarityType,
      rarityCount: 4,
      alt: "Ordinary card",
      loadMode: "immediate"
    });
    expect(
      container.querySelectorAll(
        `image[href$="/rarity_star_${trained ? "afterTraining" : "normal"}.png"]`
      )
    ).toHaveLength(4);
  });

  it.each(["rarity_1", "rarity_2", "rarity_birthday", null])(
    "does not force %s into after-training state even with a done marker",
    (rarityType) => {
      const card = { rarityType, initialSpecialTrainingStatus: "done" };
      expect(isTrainedOnlyCard(card)).toBe(false);
      expect(resolveCardTrained(card, false)).toBe(false);
      expect(resolveCardTrained(card, true)).toBe(true);
    }
  );

  it.each([undefined, null, "not_done"])("does not force an absent/non-done marker %s", (status) => {
    expect(
      resolveCardTrained({ rarityType: "rarity_4", initialSpecialTrainingStatus: status })
    ).toBe(false);
  });

  it("keeps missing artwork nullable while retaining the trained star state", () => {
    expect(
      getCardThumbnailPresentation(
        { rarityType: "rarity_4", initialSpecialTrainingStatus: "done", assetBundleName: null },
        "en"
      )
    ).toEqual({ src: null, fallbackSrc: null, trained: true });
  });

  it.each([false, true])("preserves the birthday icon with caller-selected trained=%s", (trained) => {
    const presentation = getCardThumbnailPresentation(
      {
        rarityType: "rarity_birthday",
        initialSpecialTrainingStatus: "done",
        assetBundleName: "birthday-card"
      },
      "jp",
      trained
    );
    const { container } = render(CardThumbnail, {
      ...presentation,
      rarityType: "rarity_birthday",
      alt: "Birthday card",
      loadMode: "immediate"
    });
    expect(presentation.src).toContain(
      `birthday-card_${trained ? "after_training" : "normal"}.webp`
    );
    expect(container.querySelectorAll('image[href$="/rarity_birthday.png"]')).toHaveLength(1);
    expect(container.querySelector('image[href*="/rarity_star_"]')).toBeNull();
  });
});
