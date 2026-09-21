import { render, screen, within } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { EventDetail, EventHonorBonus, EventRelatedData } from "$lib/domain/event-detail";
import eventMessages from "../../../../../../../packages/i18n-source/content-site/event.json";
import EventPage from "./+page.svelte";
import type { PageData } from "./$types";

const event: EventDetail = {
  id: "1",
  title: "Test event",
  unit: null,
  unitName: null,
  eventType: null,
  eventPointIcon: null,
  bgmAssetbundleName: null,
  startAt: null,
  endAt: null,
  assetBundleName: null,
  bannerGameCharacter: null,
  virtualLive: null
};

const enrichedBonus: EventHonorBonus = {
  honorId: 42,
  bonusRate: 25,
  honor: {
    id: 42,
    name: "Test honor",
    assetBundleName: null,
    group: { name: "Test honor group", honorType: null, backgroundAssetBundleName: null }
  }
};

const createPageData = (
  honorBonuses: EventHonorBonus[],
  honorBonusesLoadFailed = false
): PageData => {
  const relatedData: EventRelatedData = {
    honorBonusesLoadFailed,
    bonuses: {
      honorBonuses,
      honorBonusCount: honorBonuses.length,
      deckBonuses: [],
      rarityBonusRates: [],
      cardBonusLimits: [],
      mySekaiFixtureBonusLimitCount: 0
    },
    cards: [],
    musics: [],
    rewardRanges: [],
    rewardRangesHasMore: false
  };

  return {
    region: "jp",
    regionLabel: "JP",
    eventUnavailableInCurrentRegionMessage: "Event unavailable in this region.",
    failedToLoadEventDataMessage: "Failed to load event.",
    eventId: "1",
    eventPayload: Promise.resolve({ event, relatedData, error: null, debugEventJson: null }),
    availableRegions: Promise.resolve(["jp"]),
    unitProfiles: Promise.resolve({}),
    isCurrentEvent: Promise.resolve(false),
    i18nMessages: eventMessages,
    uiLocale: "en",
    preferredRegion: "jp",
    globalNotices: [],
    siteVersion: "test"
  };
};

describe("event page honor bonuses", () => {
  it("keeps enriched honor names, groups, and bonus rates", async () => {
    render(EventPage, {
      data: createPageData([enrichedBonus]),
      params: { region: "jp", id: "1" },
      form: null
    });

    const section = await screen.findByRole("region", {
      name: eventMessages.eventHonorBonusesTitle
    });
    expect(within(section).getByText("Test honor")).toBeTruthy();
    expect(within(section).getByText("Test honor group")).toBeTruthy();
    expect(within(section).getByText("25%")).toBeTruthy();
    expect(within(section).queryByRole("status")).toBeNull();
  });

  it("keeps the heading and localized status when enrichment fails without showing stubs", async () => {
    render(EventPage, {
      data: createPageData([{ honorId: 42, bonusRate: 25, honor: null }], true),
      params: { region: "jp", id: "1" },
      form: null
    });

    const section = await screen.findByRole("region", {
      name: eventMessages.eventHonorBonusesTitle
    });
    expect(within(section).getByRole("heading", { level: 2 })).toBeTruthy();
    expect(within(section).getByRole("status").textContent).toContain(
      eventMessages.eventHonorBonusesUnavailable
    );
    expect(within(section).queryByText("25%")).toBeNull();
    expect(within(section).queryByText(eventMessages.eventHonorBonusHonorLabel)).toBeNull();
    expect(within(section).queryByRole("img")).toBeNull();
    expect(screen.getByRole("heading", { name: eventMessages.eventBonusCharacterLabel })).toBeTruthy();
  });

  it("does not show the honor section or failure feedback for an event with no bonuses", async () => {
    render(EventPage, {
      data: createPageData([]),
      params: { region: "jp", id: "1" },
      form: null
    });

    await screen.findByRole("heading", { name: eventMessages.eventBonusCharacterLabel });
    expect(screen.queryByRole("region", { name: eventMessages.eventHonorBonusesTitle })).toBeNull();
    expect(screen.queryByText(eventMessages.eventHonorBonusesUnavailable)).toBeNull();
  });
});
