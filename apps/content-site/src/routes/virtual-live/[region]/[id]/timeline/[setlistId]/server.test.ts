import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  getCharacter3DsByRegionBatch: vi.fn(),
  getGameCharactersByRegionById: vi.fn(),
  getVirtualLivesByRegionByIdSetlists: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => sdk);
vi.mock("#lib/server/config.js", () => ({
  getMasterApiBaseUrl: () => "https://master-api.test",
  getInternalRemoteAssetBaseUrl: () => "https://assets.test"
}));

import { GET } from "./+server";

const callGet = (region: string, id: string, setlistId: string) =>
  GET({ params: { region, id, setlistId }, fetch: vi.fn() } as unknown as Parameters<
    typeof GET
  >[0]);

describe("virtual live timeline endpoint", () => {
  beforeEach(() => {
    sdk.getVirtualLivesByRegionByIdSetlists.mockReset();
  });

  it("looks up the setlist for canonical ids", async () => {
    sdk.getVirtualLivesByRegionByIdSetlists.mockRejectedValue(new Error("stop after the lookup"));

    await expect(callGet("jp", "12", "3")).rejects.toThrow("stop after the lookup");
    expect(sdk.getVirtualLivesByRegionByIdSetlists).toHaveBeenCalledWith(
      expect.objectContaining({ path: { region: "jp", id: "12" } })
    );
  });

  it.each([
    ["a zero id", "0", "3"],
    ["a text id", "abc", "3"],
    ["a hexadecimal id", "0x10", "3"],
    ["an exponent id", "1e2", "3"],
    ["an id with a leading zero", "012", "3"],
    ["an id with a leading space", " 1", "3"],
    ["a very large id", "99999999999999999999", "3"],
    ["a zero setlist id", "12", "0"],
    ["a hexadecimal setlist id", "12", "0x10"],
    ["an exponent setlist id", "12", "1e2"],
    ["a setlist id with a leading zero", "12", "03"],
    ["a setlist id with a trailing space", "12", "3 "]
  ])("answers 400 for %s without calling the master API", async (_label, id, setlistId) => {
    await expect(callGet("jp", id, setlistId)).rejects.toMatchObject({ status: 400 });
    expect(sdk.getVirtualLivesByRegionByIdSetlists).not.toHaveBeenCalled();
  });

  it("answers 400 for an unsupported region", async () => {
    await expect(callGet("xx", "12", "3")).rejects.toMatchObject({ status: 400 });
    expect(sdk.getVirtualLivesByRegionByIdSetlists).not.toHaveBeenCalled();
  });
});
