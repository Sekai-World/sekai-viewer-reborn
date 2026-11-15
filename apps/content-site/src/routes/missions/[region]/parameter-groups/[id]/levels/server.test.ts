import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("#lib/server/config.js", () => ({
  getMasterApiBaseUrl: () => "https://master-api.test"
}));

const { fetchMissionParameterGroupLevels } = vi.hoisted(() => ({
  fetchMissionParameterGroupLevels: vi.fn()
}));
vi.mock("#lib/server/mission-list.js", () => ({ fetchMissionParameterGroupLevels }));

import { GET } from "./+server";

const callGet = (id: string, search = "") =>
  GET({
    params: { region: "jp", id },
    url: new URL(
      `http://localhost/missions/jp/parameter-groups/${encodeURIComponent(id)}/levels${search}`
    )
  } as Parameters<typeof GET>[0]);

describe("mission parameter group levels endpoint", () => {
  beforeEach(() => {
    fetchMissionParameterGroupLevels.mockReset();
    fetchMissionParameterGroupLevels.mockResolvedValue({ items: [] });
  });

  it("loads the requested page of a parameter group", async () => {
    const response = await callGet("12", "?page=2");

    expect(response.status).toBe(200);
    expect(fetchMissionParameterGroupLevels).toHaveBeenCalledWith(
      "https://master-api.test",
      "jp",
      12,
      2
    );
  });

  it.each([
    ["zero", "0"],
    ["a negative number", "-1"],
    ["text", "abc"],
    ["hexadecimal", "0x10"],
    ["an exponent", "1e2"],
    ["a leading zero", "012"],
    ["a leading space", " 1"],
    ["a very large number", "99999999999999999999"]
  ])("answers 400 for %s without calling the master API", async (_label, id) => {
    const response = await callGet(id);

    expect(response.status).toBe(400);
    expect(fetchMissionParameterGroupLevels).not.toHaveBeenCalled();
  });
});
