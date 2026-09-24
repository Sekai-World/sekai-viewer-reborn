import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import "$lib/icons/mdi";
import type { CharacterRankReference, Mission } from "$lib/domain/mission";
import CharacterMissionsCard from "./CharacterMissionsCard.svelte";
import CharacterRankCard from "./CharacterRankCard.svelte";

afterEach(cleanup);

const t = (_key: string, fallback: string): string => fallback;

const rank = (
  characterRank: number,
  rewards: [string, number][],
  powerBonusRate = 0.1
): CharacterRankReference => ({
  characterRank,
  powerBonusRate,
  rewards: [
    {
      id: characterRank,
      resourceBoxPurpose: "character_rank_reward",
      resourceBoxType: "expand",
      details: rewards.map(([resourceType, resourceQuantity], index) => ({
        resourceBoxId: characterRank,
        resourceBoxPurpose: "character_rank_reward",
        resourceId: null,
        resourceLevel: null,
        resourceQuantity,
        resourceType,
        seq: index + 1
      }))
    }
  ]
});

const mission = (id: number, type: string, sentence: string): Mission => ({
  id,
  family: "characterMissionV2s",
  characterId: 1,
  characterMissionType: type,
  eventId: null,
  isAchievementMission: true,
  normalMissionType: null,
  parameterGroup: {
    id,
    levels: [{ seq: 1, requirement: 10, exp: 1, quantity: 0 }],
    lastLevel: { seq: 140, requirement: 50000, exp: 1, quantity: 0 },
    totalLevels: 140
  },
  parameterGroupId: id,
  progressSentence: null,
  requirement: null,
  resourceBoxId: null,
  rewards: [],
  sentence,
  seq: id,
  storyMissionType: null
});

describe("CharacterRankCard", () => {
  const ranks = [
    rank(1, [["jewel", 100]]),
    rank(2, [["jewel", 100]]),
    rank(3, [["jewel", 100]]),
    rank(5, [
      ["honor", 1],
      ["jewel", 300]
    ]),
    rank(8, [["stamp", 1]], 5)
  ];

  it("summarizes totals and shows milestone ranks until every rank is requested", async () => {
    render(CharacterRankCard, {
      ranks: Promise.resolve({ items: ranks, loadFailed: false }),
      locale: "en",
      t
    });

    expect(await screen.findByText("5 ranks · Max power bonus +5%")).toBeTruthy();
    const totals = screen.getByLabelText("Rewards across all ranks");
    expect(within(totals).getByText("Crystals").nextElementSibling?.textContent?.trim()).toBe(
      "600"
    );
    expect(within(totals).getByText("Stamps")).toBeTruthy();

    expect(screen.getByRole("heading", { name: "Milestone ranks" })).toBeTruthy();
    expect(screen.getByText("Rank 5")).toBeTruthy();
    expect(screen.getByText("Honor ×1 · Crystals ×300")).toBeTruthy();
    expect(screen.getByText("Rank 8")).toBeTruthy();
    expect(screen.queryByText("Rank 1")).toBeNull();

    const toggle = screen.getByRole("button", { name: "Show all 5 ranks" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    await fireEvent.click(toggle);
    expect(screen.getByRole("heading", { name: "All ranks" })).toBeTruthy();
    expect(screen.getByText("Rank 1")).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Show milestone ranks only" })
        .getAttribute("aria-expanded")
    ).toBe("true");
  });

  it("keeps the title while loading and reports failures", async () => {
    let resolveRanks!: (value: { items: CharacterRankReference[]; loadFailed: boolean }) => void;
    render(CharacterRankCard, {
      ranks: new Promise<{ items: CharacterRankReference[]; loadFailed: boolean }>(
        (resolve) => (resolveRanks = resolve)
      ),
      locale: "en",
      t
    });

    expect(screen.getByRole("heading", { name: "Character Rank" })).toBeTruthy();
    expect(screen.getByRole("status").textContent?.trim()).toBe(
      "Character Rank rewards are loading..."
    );
    resolveRanks({ items: [], loadFailed: true });
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});

describe("CharacterMissionsCard", () => {
  it("lists each mission with its target range, goal count, and EX marker", async () => {
    render(CharacterMissionsCard, {
      missions: Promise.resolve({
        items: [
          mission(1001, "play_live", "Clear {requirement} lives with Ichika"),
          mission(1101, "play_live_ex", "Clear {requirement} lives with Ichika")
        ],
        loadFailed: false
      }),
      locale: "en",
      viewAllHref: "/missions/jp?family=characterMissionV2s",
      t
    });

    expect(await screen.findByText("2 missions · 280 level goals")).toBeTruthy();
    expect(screen.getAllByText("Clear … lives with Ichika")).toHaveLength(2);
    expect(screen.getAllByText("10 → 50,000 · 140 goals")).toHaveLength(2);
    expect(screen.getAllByText("EX")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "See all character missions" }).getAttribute("href")
    ).toBe("/missions/jp?family=characterMissionV2s");
  });

  it("shows a skeleton while loading and an error when loading fails", async () => {
    let resolveMissions!: (value: { items: Mission[]; loadFailed: boolean }) => void;
    const { container } = render(CharacterMissionsCard, {
      missions: new Promise<{ items: Mission[]; loadFailed: boolean }>(
        (resolve) => (resolveMissions = resolve)
      ),
      locale: "en",
      viewAllHref: "/missions/jp?family=characterMissionV2s",
      t
    });

    expect(screen.getByRole("status").textContent?.trim()).toBe(
      "Character missions are loading..."
    );
    expect(container.querySelectorAll('ul[aria-hidden="true"] > li')).toHaveLength(6);
    resolveMissions({ items: [], loadFailed: true });
    expect((await screen.findByRole("alert")).textContent?.trim()).toBe(
      "Character missions could not be loaded."
    );
  });
});
