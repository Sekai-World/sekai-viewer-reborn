import { describe, expect, it } from "vitest";
import { formatUnitMemberName } from "./unit-detail";

describe("formatUnitMemberName", () => {
  it("prefers the localized given name parts", () => {
    expect(
      formatUnitMemberName({
        gameCharacterId: 1,
        firstName: "星乃",
        givenName: "一歌",
        firstNameEnglish: "HOSHINO",
        givenNameEnglish: "ICHICA"
      })
    ).toBe("星乃 一歌");
  });

  it("falls back to the English name parts", () => {
    expect(
      formatUnitMemberName({
        gameCharacterId: 2,
        firstName: null,
        givenName: null,
        firstNameEnglish: "HANASATO",
        givenNameEnglish: "MINORI"
      })
    ).toBe("HANASATO MINORI");
  });

  it("falls back to the character id when no name is available", () => {
    expect(
      formatUnitMemberName({
        gameCharacterId: 21,
        firstName: null,
        givenName: null,
        firstNameEnglish: null,
        givenNameEnglish: null
      })
    ).toBe("#21");
  });
});
