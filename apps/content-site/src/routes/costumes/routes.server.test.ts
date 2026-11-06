import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({
  fetchCostumeListPage: vi.fn(),
  fetchCostumeOutfitDetail: vi.fn(),
  fetchMissionCharacterOptions: vi.fn()
}));
vi.mock("#lib/server/costumes.js", () => ({
  fetchCostumeListPage: server.fetchCostumeListPage,
  fetchCostumeOutfitDetail: server.fetchCostumeOutfitDetail
}));
vi.mock("#lib/server/mission-characters.js", () => ({
  fetchMissionCharacterOptions: server.fetchMissionCharacterOptions
}));
vi.mock("#lib/server/config.js", () => ({ getMasterApiBaseUrl: () => "https://master-api.test" }));

import { load as loadDetail } from "../costume/[region]/[id]/+page.server";
import { load as loadList } from "./[region]/+page.server";
import { GET } from "./[region]/data/+server";

type Loaded<T extends (...args: never[]) => unknown> = Exclude<
  ReturnType<T>,
  void | Promise<unknown>
>;
const list = (region: string, search = "") =>
  loadList({
    params: { region },
    url: new URL(`https://site.test/costumes/${region}${search}`)
  } as never) as Loaded<typeof loadList>;
const detail = (region: string, id: string) =>
  loadDetail({ params: { region, id } } as never) as Loaded<typeof loadDetail>;

beforeEach(() => {
  vi.resetAllMocks();
  server.fetchMissionCharacterOptions.mockResolvedValue([{ id: 1, name: "Ichika" }]);
});

describe("costume list loader", () => {
  it("streams the page for the URL's filters", async () => {
    const page = { items: [{ id: 11 }], pagination: {} };
    server.fetchCostumeListPage.mockResolvedValueOnce(page);

    const data = list("tw", "?name=star&rarity=rare&character=3");

    expect(data.region).toBe("tw");
    expect(data.query).toEqual({ name: "star", rarity: "rare", characterId: 3, sortOrder: "asc" });
    await expect(data.catalogue).resolves.toBe(page);
    await expect(data.characters).resolves.toEqual([{ id: 1, name: "Ichika" }]);
  });

  it("resolves failures to null", async () => {
    server.fetchCostumeListPage.mockRejectedValueOnce(new Error("offline"));
    server.fetchMissionCharacterOptions.mockRejectedValueOnce(new Error("offline"));

    const data = list("xx");

    expect(data.region).toBe("jp");
    await expect(data.catalogue).resolves.toBeNull();
    await expect(data.characters).resolves.toBeNull();
  });
});

describe("costume list data endpoint", () => {
  const get = (search: string) =>
    GET({
      params: { region: "kr" },
      url: new URL(`https://site.test/costumes/kr/data${search}`)
    } as never);

  it("returns the requested page", async () => {
    server.fetchCostumeListPage.mockResolvedValueOnce({ items: [], pagination: {} });

    const response = await get("?page=3&rarity=normal");

    expect(response.status).toBe(200);
    expect(server.fetchCostumeListPage).toHaveBeenCalledWith(
      "https://master-api.test",
      "kr",
      { name: "", rarity: "normal", characterId: null, sortOrder: "asc" },
      3
    );
  });

  it("reports a failure", async () => {
    server.fetchCostumeListPage.mockRejectedValueOnce(new Error("offline"));

    expect((await get("")).status).toBe(500);
  });
});

describe("costume detail loader", () => {
  it("streams the outfit and its character names", async () => {
    server.fetchCostumeOutfitDetail.mockResolvedValueOnce({ id: 11 });

    const data = detail("cn", "11");

    expect(data.region).toBe("cn");
    expect(data.id).toBe("11");
    await expect(data.payload).resolves.toEqual({ status: "ready", item: { id: 11 } });
    expect(server.fetchCostumeOutfitDetail).toHaveBeenCalledWith(
      "https://master-api.test",
      "cn",
      11
    );
  });

  it("reports an unknown outfit, a bad ID, and a failure", async () => {
    server.fetchCostumeOutfitDetail.mockResolvedValueOnce(null);
    await expect(detail("jp", "12").payload).resolves.toEqual({ status: "notFound", item: null });

    await expect(detail("jp", "abc").payload).resolves.toEqual({ status: "notFound", item: null });

    server.fetchCostumeOutfitDetail.mockRejectedValueOnce(new Error("offline"));
    await expect(detail("jp", "11").payload).resolves.toEqual({ status: "error", item: null });
  });

  it("still loads when the character names fail", async () => {
    server.fetchCostumeOutfitDetail.mockResolvedValueOnce({ id: 11 });
    server.fetchMissionCharacterOptions.mockRejectedValueOnce(new Error("offline"));

    await expect(detail("jp", "11").characters).resolves.toBeNull();
  });
});
