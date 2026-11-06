import { describe, expect, it } from "vitest";
import { parseCharacterList } from "./character-list";

const ids = (items: object[]): string[] =>
  parseCharacterList({ items }, []).map((character) => String(character.id));

describe("parseCharacterList", () => {
  it("orders characters by seq", () => {
    expect(
      ids([
        { id: 2, seq: 1, firstName: "A" },
        { id: 1, seq: 2, firstName: "B" }
      ])
    ).toEqual(["2", "1"]);
  });

  it("orders characters without seq numerically by ID", () => {
    expect(
      ids([
        { id: 1, firstName: "A" },
        { id: 10, firstName: "B" },
        { id: 2, firstName: "C" }
      ])
    ).toEqual(["1", "2", "10"]);
  });
});
