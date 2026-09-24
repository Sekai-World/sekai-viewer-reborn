import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Mission, MissionFamily } from "$lib/domain/mission";
import "$lib/icons/mdi";
import MissionsPage from "./+page.svelte";

const { goto, invalidateAll } = vi.hoisted(() => ({
  goto: vi.fn(),
  invalidateAll: vi.fn()
}));
vi.mock("$app/environment", () => ({ browser: true }));
vi.mock("$app/navigation", () => ({ goto, invalidateAll }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

const makeMission = (family: MissionFamily, id: number, sentence: string | null): Mission => ({
  id,
  family,
  characterId: null,
  characterMissionType: null,
  eventId: null,
  isAchievementMission: null,
  normalMissionType: null,
  parameterGroup: null,
  parameterGroupId: null,
  progressSentence: null,
  requirement: id,
  resourceBoxId: null,
  rewards: [],
  sentence,
  seq: id,
  storyMissionType: null
});

type PageData = ComponentProps<typeof MissionsPage>["data"];
type Catalogue = Awaited<NonNullable<PageData["catalogue"]>>;
type SuccessfulCatalogue = Extract<Catalogue, { loadFailed: false }>;
type FamilyOverview = PageData["familyOverviews"][number];

const data = (
  catalogue: Catalogue | FamilyOverview[],
  family: MissionFamily | null = null,
  region: PageData["region"] = "jp"
): PageData => ({
  region,
  query: { family },
  ...(Array.isArray(catalogue)
    ? { catalogue: null, familyOverviews: catalogue }
    : { catalogue: Promise.resolve(catalogue), familyOverviews: [] }),
  uiLocale: "en",
  preferredRegion: region,
  globalNotices: [],
  siteVersion: "test",
  i18nMessages: {
    "navigation.missions": "Missions",
    home: "Home",
    "mission.familyLabel": "Mission family",
    "mission.family.all": "All missions",
    "mission.family.storyMissions": "Story missions",
    "mission.family.characterMissionV2s": "Character missions",
    "mission.family.normalMissions": "Normal missions",
    "mission.browseFamily": "See all {family}",
    "mission.loading": "Loading missions...",
    "mission.loadingMore": "Loading more missions...",
    "mission.loadMore": "Load more missions",
    "mission.loadMoreError": "More missions could not be loaded.",
    "mission.end": "You have reached the end.",
    "mission.empty": "No missions found. Try another region.",
    "mission.error": "Missions could not be loaded.",
    "mission.retry": "Try again",
    "mission.rewards": "Rewards",
    "mission.reward": "Reward",
    "mission.storyUnnamed": "Story mission #{id}",
    "mission.targetUnavailable": "Target data unavailable for this region",
    "mission.unnamed": "Mission",
    "mission.requirement": "Target: {count}",
    "mission.targetLevel": "Level {level} · Target {count}",
    "mission.targetLevelSequence": "{levels}",
    "mission.targetLevelContinuation": "{levels} · … · {lastLevel} ({count} level goals)",
    "mission.shownCount": "{count} missions shown",
    "mission.totalCount": "{count} missions",
    "mission.totalCountOne": "1 mission",
    "mission.totalUnavailable": "Total unavailable",
    "mission.resource.coin": "Coins",
    "mission.resource.jewel": "Crystals",
    "mission.resource.material": "Material",
    "mission.resource.honor": "Honor",
    "mission.resource.bonds_honor": "Bonds honor",
    "mission.resource.virtual_coin": "Virtual coins"
  }
});

const renderPage = (catalogue: Catalogue | FamilyOverview[], family: MissionFamily | null = null) =>
  render(MissionsPage, {
    data: data(catalogue, family),
    params: { region: "jp" },
    form: null
  });

const page = (
  items: Mission[],
  pagination: { page: number; hasNext: boolean }
): SuccessfulCatalogue => ({
  items,
  pagination: {
    ...pagination,
    pageSize: 24,
    total: null,
    totalPages: null
  },
  loadFailed: false
});

describe("Missions page", () => {
  it("keeps one family in the URL state and preserves it across regions", async () => {
    const normal = makeMission("normalMissions", 1, "Play a live");
    renderPage(page([normal], { page: 1, hasNext: false }), "normalMissions");

    const tablist = await screen.findByRole("tablist", { name: "Mission family" });
    expect(withinTab(tablist, "Normal missions").getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Play a live")).toBeTruthy();
    expect(screen.getByRole("link", { name: "EN" }).getAttribute("href")).toBe(
      "/missions/en?family=normalMissions"
    );

    await fireEvent.click(withinTab(tablist, "All missions"));
    expect(goto).toHaveBeenLastCalledWith("/missions/jp", { keepFocus: true, noScroll: true });
  });

  it("appends and de-duplicates later pages for a selected family", async () => {
    const firstNormal = makeMission("normalMissions", 1, "First normal");
    const secondNormal = makeMission("normalMissions", 2, "Second normal");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [firstNormal, secondNormal, secondNormal],
          pagination: { page: 2, hasNext: false }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    renderPage(page([firstNormal], { page: 1, hasNext: true }), "normalMissions");
    await screen.findByText("First normal");
    await fireEvent.click(screen.getByRole("button", { name: "Load more missions" }));

    expect(screen.getAllByText("First normal")).toHaveLength(1);
    expect(await screen.findByText("Second normal")).toBeTruthy();
    expect(screen.getAllByText("Second normal")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/missions/jp/data?page=2&family=normalMissions");
    expect(screen.getByRole("status").textContent).toBe("You have reached the end.");
  });

  it("shows bounded, count-led previews in All mode as each family arrives", async () => {
    const items = [1, 2, 3, 4].map((id) => makeMission("storyMissions", id, `Story ${id}`));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    renderPage([
      {
        family: "storyMissions",
        summary: Promise.resolve({ items, total: 120, loadFailed: false })
      },
      { family: "characterMissionV2s", summary: new Promise(() => {}) },
      {
        family: "normalMissions",
        summary: Promise.resolve({ items: [], total: null, loadFailed: true })
      }
    ]);

    expect(await screen.findByText("120 missions")).toBeTruthy();
    expect(screen.getByText("Story 1")).toBeTruthy();
    expect(screen.getByText("Story 2")).toBeTruthy();
    expect(screen.getByText("Story 3")).toBeTruthy();
    expect(screen.queryByText("Story 4")).toBeNull();

    const characterSection = screen
      .getByRole("heading", { name: "Character missions" })
      .closest("section")!;
    expect(characterSection.getAttribute("aria-busy")).toBe("true");
    expect(characterSection.textContent).toContain("Loading missions...");

    const normalSection = screen
      .getByRole("heading", { name: /Normal missions/ })
      .closest("section")!;
    expect(normalSection.textContent).toContain("Missions could not be loaded.");
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(invalidateAll).toHaveBeenCalledOnce();

    for (const family of ["Story missions", "Character missions", "Normal missions"]) {
      expect(screen.getByRole("button", { name: `See all ${family}` })).toBeTruthy();
    }
    expect(screen.queryByRole("button", { name: "Load more missions" })).toBeNull();
    expect(screen.queryByText("You have reached the end.")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the page error in All mode only when every family fails", async () => {
    renderPage(
      (["storyMissions", "characterMissionV2s", "normalMissions"] as const).map((family) => ({
        family,
        summary: Promise.resolve({ items: [], total: null, loadFailed: true })
      }))
    );

    expect(await screen.findByText("Missions could not be loaded.")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: /Story missions/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Try again" })).toHaveLength(1);
  });

  it("renders one Character Mission V2 threshold with its level label", async () => {
    const mission = makeMission("characterMissionV2s", 1, "Complete {requirement} task");
    mission.parameterGroup = {
      id: 9,
      levels: [{ seq: 1, requirement: 10, exp: null, quantity: null }]
    };
    renderPage(page([mission], { page: 1, hasNext: false }), "characterMissionV2s");

    expect(await screen.findByText("Complete 10 task")).toBeTruthy();
    expect(screen.getByText("Level 1 · Target 10")).toBeTruthy();
  });

  it("renders three Character Mission V2 thresholds with explicit level labels", async () => {
    const mission = makeMission(
      "characterMissionV2s",
      2,
      "Complete {requirement} character tasks {progress}"
    );
    mission.requirement = 999;
    mission.parameterGroup = {
      id: 9,
      levels: [
        { seq: 1, requirement: 10, exp: null, quantity: null },
        { seq: 2, requirement: 20, exp: null, quantity: null },
        { seq: 3, requirement: 40, exp: null, quantity: null }
      ]
    };
    renderPage(page([mission], { page: 1, hasNext: false }), "characterMissionV2s");

    expect(await screen.findByText("Complete … character tasks …")).toBeTruthy();
    expect(screen.getByText("Level 1 · Target 10")).toBeTruthy();
    expect(screen.getByText("Level 2 · Target 20")).toBeTruthy();
    expect(screen.getByText("Level 3 · Target 40")).toBeTruthy();
    expect(screen.queryByText("Complete 999 character tasks 999")).toBeNull();
    expect(screen.queryByText("{requirement}")).toBeNull();
    expect(screen.queryByText("{progress}")).toBeNull();
  });

  it("summarizes longer Character Mission V2 sequences with labeled endpoints and a total", async () => {
    const mission = makeMission("characterMissionV2s", 4, "Complete {requirement} tasks");
    mission.parameterGroup = {
      id: 9,
      levels: [1, 2, 3, 4, 5].map((seq) => ({
        seq,
        requirement: seq * 10,
        exp: null,
        quantity: null
      }))
    };
    const lastLevel = mission.parameterGroup!.levels.at(-1)!;
    lastLevel.requirement = 50000;
    renderPage(page([mission], { page: 1, hasNext: false }), "characterMissionV2s");

    expect(await screen.findByText("Complete … tasks")).toBeTruthy();
    expect(screen.getByText("5 level goals")).toBeTruthy();
    expect(screen.getByText("Level 5 · Target 50,000")).toBeTruthy();
    expect(screen.queryByText("Level 4 · Target 40")).toBeNull();
  });

  it("expands Character Mission V2 level goals in place without loading Character Rank rewards", async () => {
    const mission = makeMission("characterMissionV2s", 5, "Complete {requirement} tasks");
    mission.characterId = 7;
    mission.parameterGroup = {
      id: 9,
      totalLevels: 21,
      levels: [1, 2, 3].map((seq) => ({ seq, requirement: seq * 10, exp: null, quantity: null })),
      lastLevel: {
        seq: 21,
        requirement: 210,
        exp: null,
        quantity: 100,
        reward: { resourceType: "material", resourceQuantity: 100 }
      }
    };
    const fetchMock = vi.fn((input: string) => {
      const page = new URL(input, "http://localhost").searchParams.get("page");
      const items = (page === "1" ? [1, 2, 3, 4] : [5, 6]).map((seq) => ({
        seq,
        requirement: seq * 10
      }));
      return Promise.resolve(
        new Response(
          JSON.stringify({ items, pagination: { page: Number(page), hasNext: page === "1" } }),
          { status: 200, headers: { "content-type": "application/json" } }
        )
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    renderPage(page([mission], { page: 1, hasNext: false }), "characterMissionV2s");
    await screen.findByText("21 level goals");
    const goals = screen.getByRole("region", { name: "21 level goals" });
    expect(screen.getByText("Level 21 · Target 210")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    await fireEvent.click(screen.getByRole("button", { name: "Show all level goals" }));

    expect(await screen.findByText("Level 4 · Target 40")).toBeTruthy();
    expect(screen.queryByText("Level 21 · Target 210")).toBeNull();
    expect(goals.querySelectorAll("ul")).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith("/missions/jp/parameter-groups/9/levels?page=1");
    expect(screen.queryByText(/Character Rank rewards/)).toBeNull();

    await fireEvent.click(screen.getByRole("button", { name: "Load more level goals" }));
    expect(await screen.findByText("Level 6 · Target 60")).toBeTruthy();
    expect(screen.getByText("All level goals are shown.")).toBeTruthy();
    expect(goals.querySelectorAll("ul")).toHaveLength(1);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/missions/jp/parameter-groups/9/levels?page=2");
    expect(screen.queryByText(/Character Rank rewards/)).toBeNull();
  });

  it("keeps scalar requirements for story and normal missions", async () => {
    const mission = makeMission("storyMissions", 3, "Complete {requirement} stories");
    renderPage(page([mission], { page: 1, hasNext: false }), "storyMissions");

    expect(await screen.findByText("Complete 3 stories")).toBeTruthy();
    expect(screen.getByText("Target: 3")).toBeTruthy();
  });

  it("uses the story mission ID when its sentence is missing and keeps its requirement", async () => {
    const mission = makeMission("storyMissions", 42, null);
    mission.requirement = 7;
    renderPage(page([mission], { page: 1, hasNext: false }), "storyMissions");

    expect(await screen.findByText("Story mission #42")).toBeTruthy();
    expect(screen.getByText("Target: 7")).toBeTruthy();
  });

  it("keeps the localized unavailable status when Character Mission V2 levels are missing", async () => {
    const mission = { ...makeMission("characterMissionV2s", 2, "Complete {requirement} tasks") };
    mission.parameterGroup = null;
    mission.progressSentence = "{progress} tasks";
    renderPage(page([mission], { page: 1, hasNext: false }), "characterMissionV2s");

    expect(await screen.findByText("Complete … tasks")).toBeTruthy();
    expect(screen.getByText("Target data unavailable for this region")).toBeTruthy();
    expect(screen.queryByText("{progress} tasks")).toBeNull();
  });

  it("shows the localized loading state while fetching the next page", async () => {
    let resolveFetch!: (response: Response) => void;
    const fetchMock = vi
      .fn()
      .mockImplementation(() => new Promise<Response>((resolve) => (resolveFetch = resolve)));
    vi.stubGlobal("fetch", fetchMock);

    renderPage(
      page([makeMission("storyMissions", 1, "First story")], { page: 1, hasNext: true }),
      "storyMissions"
    );
    await screen.findByText("First story");
    await fireEvent.click(screen.getByRole("button", { name: "Load more missions" }));

    expect(screen.getByRole("status").textContent).toContain("Loading more missions...");
    expect(fetchMock).toHaveBeenCalledWith("/missions/jp/data?page=2&family=storyMissions");
    resolveFetch(
      new Response(JSON.stringify({ items: [], pagination: { page: 2, hasNext: false } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("You have reached the end.")
    );
  });
});

const withinTab = (tablist: HTMLElement, name: string): HTMLElement =>
  Array.from(tablist.querySelectorAll<HTMLElement>('[role="tab"]')).find(
    (tab) => tab.textContent?.trim() === name
  )!;
