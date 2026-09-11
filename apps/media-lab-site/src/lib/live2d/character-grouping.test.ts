import { describe, expect, it } from "vitest";
import { getLive2dCharacterGroupKey, getLive2dCharacterTypeKey } from "./character-grouping";

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
});
