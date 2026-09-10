import { describe, expect, it } from "vitest";
import { getLive2dCharacterGroupKey } from "./character-grouping";

describe("Live2D character grouping", () => {
  it("keeps mob and game-character groups distinct for the same numeric ID", () => {
    const mobKey = getLive2dCharacterGroupKey(1, "mob");
    const gameCharacterKey = getLive2dCharacterGroupKey(1, "game_character");

    expect(mobKey).toBe("character-mob-1");
    expect(gameCharacterKey).toBe("character-1");
    expect(mobKey).not.toBe(gameCharacterKey);
  });
});
