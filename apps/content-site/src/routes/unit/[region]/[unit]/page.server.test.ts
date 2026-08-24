import { beforeEach, describe, expect, it, vi } from "vitest";

const { getMasterApiBaseUrl } = vi.hoisted(() => ({ getMasterApiBaseUrl: vi.fn(() => "https://master-api.test") }));
vi.mock("$lib/server/config", () => ({ getMasterApiBaseUrl }));
const { getUnitProfilesByRegionByUnit, getUnitProfilesByRegionByUnitMembers } = vi.hoisted(() => ({
  getUnitProfilesByRegionByUnit: vi.fn(),
  getUnitProfilesByRegionByUnitMembers: vi.fn()
}));
vi.mock("@platform/sekai-master-api-sdk", () => ({
  getUnitProfilesByRegionByUnit,
  getUnitProfilesByRegionByUnitMembers
}));

import { load } from "./+page.server";

describe("unit detail page load", () => {
  beforeEach(() => {
    getMasterApiBaseUrl.mockClear();
  });

  it("parses the profile and roster from the normalized route", async () => {
    getUnitProfilesByRegionByUnit.mockResolvedValue({
      data: {
        unit: "idol",
        unitName: "MORE MORE JUMP!",
        unitProfileName: "The hopeful idols",
        profileSentence: "Delivering hope.",
        colorCode: "#88cc22"
      }
    });
    getUnitProfilesByRegionByUnitMembers.mockResolvedValue({
      data: { items: [{ gameCharacterId: 2, firstName: "Minori", unit: "idol" }] }
    });

    const result = (await load({ params: { region: "JP", unit: " IDOL " } } as Parameters<typeof load>[0])) as {
      region: string;
      unit: string | null;
      payload: Promise<unknown>;
    };
    expect(result.region).toBe("jp");
    expect(result.unit).toBe("idol");
    await expect(result.payload).resolves.toMatchObject({
      unit: { unitName: "MORE MORE JUMP!", profileName: "The hopeful idols" },
      members: [{ gameCharacterId: 2, firstName: "Minori" }],
      loadFailed: false
    });
    expect(getUnitProfilesByRegionByUnit).toHaveBeenCalledWith({
      baseUrl: "https://master-api.test",
      path: { region: "jp", unit: "idol" }
    });
  });

  it("normalizes route input and returns an unavailable state for an invalid unit", async () => {
    const result = (await load({ params: { region: "invalid", unit: "unknown" } } as Parameters<typeof load>[0])) as {
      region: string;
      unit: string | null;
      payload: Promise<unknown>;
    };
    expect(result.region).toBe("jp");
    expect(result.unit).toBeNull();
    await expect(result.payload).resolves.toEqual({ unit: null, members: [], loadFailed: false });
    expect(getMasterApiBaseUrl).toHaveBeenCalledOnce();
  });

  it("reports a load failure when the profile request rejects", async () => {
    getUnitProfilesByRegionByUnit.mockRejectedValueOnce(new Error("master api unavailable"));

    const result = (await load({ params: { region: "jp", unit: "idol" } } as Parameters<typeof load>[0])) as {
      payload: Promise<{ loadFailed: boolean }>;
    };
    await expect(result.payload).resolves.toEqual({
      unit: null,
      members: [],
      loadFailed: true
    });
  });
});
