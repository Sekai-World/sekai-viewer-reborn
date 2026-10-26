import { describe, expect, it } from "vitest";
import { parseMusicDetail } from "./music-detail";

describe("parseMusicDetail vocal characters", () => {
  it("preserves character types when outside and game characters share an ID", () => {
    const detail = parseMusicDetail({
      music: { id: 812, title: "Example song" },
      vocals: [
        {
          id: 1856,
          musicId: 812,
          characters: [{ characterId: 3, characterType: "outside_character" }]
        },
        {
          id: 2097,
          musicId: 812,
          characters: [
            { characterId: 3, characterType: "game_character" },
            { characterId: 25, characterType: "game_character" },
            { characterId: 1, characterType: "game_character" },
            { characterId: 2, characterType: "game_character" },
            { characterId: 4, characterType: "game_character" }
          ]
        }
      ]
    });

    expect(detail?.vocals[0]?.characters).toEqual([
      { characterId: 3, unit: "", characterType: "outside_character" }
    ]);
    expect(detail?.vocals[1]?.characters).toEqual([
      { characterId: 3, unit: "", characterType: "game_character" },
      { characterId: 25, unit: "", characterType: "game_character" },
      { characterId: 1, unit: "", characterType: "game_character" },
      { characterId: 2, unit: "", characterType: "game_character" },
      { characterId: 4, unit: "", characterType: "game_character" }
    ]);
  });

  it("preserves character types for override characters", () => {
    const detail = parseMusicDetail({
      music: { id: 812, title: "Example song" },
      vocals: [
        {
          id: 1856,
          musicId: 812,
          characters: [{ characterId: 3, characterType: "game_character" }],
          overrideCharas: [{ characterId: 3, characterType: "outside_character" }]
        }
      ]
    });

    expect(detail?.vocals[0]?.characters).toEqual([
      { characterId: 3, unit: "", characterType: "game_character" }
    ]);
    expect(detail?.vocals[0]?.overrideChara).toEqual([
      { characterId: 3, unit: "", characterType: "outside_character" }
    ]);
  });

  it("keeps the legacy missing-type shape and distinguishes invalid types", () => {
    const detail = parseMusicDetail({
      music: { id: 812, title: "Example song" },
      vocals: [
        {
          id: 1,
          musicId: 812,
          characters: [{ characterId: 3, unit: "legacy" }]
        },
        {
          id: 2,
          musicId: 812,
          characters: [
            { characterId: 3, characterType: " custom_character " },
            { characterId: 4, characterType: "   " },
            { characterId: 5, characterType: null }
          ]
        }
      ]
    });

    expect(detail?.vocals[0]?.characters).toEqual([{ characterId: 3, unit: "legacy" }]);
    expect(detail?.vocals[0]?.characters?.[0]?.characterType).toBeUndefined();
    expect(detail?.vocals[1]?.characters).toEqual([
      { characterId: 3, unit: "", characterType: "custom_character" },
      { characterId: 4, unit: "", characterType: null },
      { characterId: 5, unit: "", characterType: null }
    ]);
  });

  it("trims canonical names, preserves explicit nulls, and omits missing names", () => {
    const detail = parseMusicDetail({
      music: { id: 812, title: "Example song" },
      vocals: [
        {
          id: 1,
          musicId: 812,
          characters: [
            { characterId: 3 },
            { characterId: 3, characterType: " outside_character ", name: " flower " },
            { characterId: 5, name: null },
            { characterId: 6, name: 7 }
          ],
          overrideCharas: [{ characterId: 3, name: "  Override name  " }]
        }
      ]
    });

    expect(detail?.vocals[0]?.characters).toEqual([
      { characterId: 3, unit: "" },
      { characterId: 3, unit: "", characterType: "outside_character", name: "flower" },
      { characterId: 5, unit: "", name: null },
      { characterId: 6, unit: "", name: null }
    ]);
    expect(detail?.vocals[0]?.overrideChara).toEqual([
      { characterId: 3, unit: "", name: "Override name" }
    ]);
  });
});
