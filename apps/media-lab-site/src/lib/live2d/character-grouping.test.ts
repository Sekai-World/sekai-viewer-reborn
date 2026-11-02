import { describe, expect, it } from "vitest";
import {
  applyLive2dCharacterOverrides,
  createLive2dCharacterOverrides,
  getLive2dCharacterGroupKey,
  getLive2dCharacterTypeKey
} from "./character-grouping";

describe("Live2D character grouping", () => {
  it("keeps mob and game-character groups distinct for the same numeric ID", () => {
    const mobKey = getLive2dCharacterGroupKey(1, "mob");
    const gameCharacterKey = getLive2dCharacterGroupKey(1, "game_character");

    expect(mobKey).toBe("character-mob-1");
    expect(gameCharacterKey).toBe("character-1");
    expect(mobKey).not.toBe(gameCharacterKey);
  });

  it("maps only explicit character types to category tabs", () => {
    expect(getLive2dCharacterTypeKey(null)).toBe("game_character");
    expect(getLive2dCharacterTypeKey("game_character")).toBe("game_character");
    expect(getLive2dCharacterTypeKey("sub_game_character")).toBe("sub_game_character");
    expect(getLive2dCharacterTypeKey("mob")).toBe("mob");
    expect(getLive2dCharacterTypeKey("other")).toBeNull();
  });

  it("lists only models whose resolved character differs from the catalog", () => {
    const catalogModels = [
      { id: "ichika", characterId: 1 },
      { id: "miku", characterId: 21, characterType: null },
      { id: "mob", characterId: 7 },
      { id: "unmapped" }
    ];
    const resolvedModels = [
      { id: "ichika", characterId: 1, characterType: null },
      { id: "miku", characterId: 21 },
      { id: "mob", characterId: 300, characterType: "mob" },
      { id: "unmapped", characterId: 2 }
    ];

    expect(createLive2dCharacterOverrides(catalogModels, resolvedModels)).toEqual([
      { id: "mob", characterId: 300, characterType: "mob" },
      { id: "unmapped", characterId: 2, characterType: null }
    ]);
  });

  it("applies character overrides by model ID and keeps other models unchanged", () => {
    const models = [
      { id: "ichika", modelName: "ichika", characterId: 1 },
      { id: "mob", modelName: "mob", characterId: 7, characterType: "game_character" }
    ];

    const result = applyLive2dCharacterOverrides(models, [
      { id: "mob", characterId: 300, characterType: "mob" },
      { id: "missing", characterId: 9, characterType: null }
    ]);

    expect(result).toEqual([
      { id: "ichika", modelName: "ichika", characterId: 1 },
      { id: "mob", modelName: "mob", characterId: 300, characterType: "mob" }
    ]);
    expect(result[0]).toBe(models[0]);
    expect(applyLive2dCharacterOverrides(models)).toBe(models);
  });
});
