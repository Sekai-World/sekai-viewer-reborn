import { describe, expect, it } from "vitest";
import type { MissionFamily } from "$lib/domain/mission";
import { groupMissionsByFamily } from "./catalogue-groups";

describe("groupMissionsByFamily", () => {
  it("groups only by family and preserves source family and member order", () => {
    const items = [
      { family: "normalMissions", id: 9, sentence: "Same", parameterGroupId: 1 },
      { family: "storyMissions", id: 9, sentence: "Same", parameterGroupId: 1 },
      { family: "normalMissions", id: 2, sentence: "Different", parameterGroupId: 2 },
      { family: "characterMissionV2s", id: 3, sentence: "Same", parameterGroupId: 1 }
    ] satisfies { family: MissionFamily; id: number; sentence: string; parameterGroupId: number }[];

    const groups = groupMissionsByFamily(items);

    expect(groups.map((group) => group.family)).toEqual([
      "normalMissions",
      "storyMissions",
      "characterMissionV2s"
    ]);
    expect(groups.map((group) => group.items)).toEqual([
      [items[0], items[2]],
      [items[1]],
      [items[3]]
    ]);
    expect(groups[0].items[0]).toBe(items[0]);
    expect(items.map((item) => item.id)).toEqual([9, 9, 2, 3]);
  });

  it("does not deduplicate or discard source members with identical fields", () => {
    const item = { family: "normalMissions" as const, id: 1 };
    expect(groupMissionsByFamily([item, item])).toEqual([
      { family: "normalMissions", items: [item, item] }
    ]);
  });

  it("does not synthesize missing families or retain groups from another page", () => {
    expect(groupMissionsByFamily([{ family: "storyMissions" as const }])).toHaveLength(1);
    expect(groupMissionsByFamily([])).toEqual([]);
  });
});
