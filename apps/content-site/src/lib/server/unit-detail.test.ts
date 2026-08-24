import { describe, expect, it } from "vitest";
import { parseUnitDetail, parseUnitMembers } from "./unit-detail";

describe("parseUnitDetail", () => {
  it("parses the profile with the raw unitProfileName fallback", () => {
    expect(
      parseUnitDetail({
        unit: "IDOL",
        unitName: "MORE MORE JUMP!",
        unitProfileName: "The hopeful idols",
        profileSentence: "Delivering hope.",
        colorCode: "#88cc22"
      })
    ).toEqual({
      unit: "idol",
      unitName: "MORE MORE JUMP!",
      profileName: "The hopeful idols",
      profileSentence: "Delivering hope.",
      colorCode: "#88cc22"
    });
  });

  it("returns null for non-record payloads or missing identity fields", () => {
    expect(parseUnitDetail(null)).toBeNull();
    expect(parseUnitDetail("idol")).toBeNull();
    expect(parseUnitDetail({ unit: "idol" })).toBeNull();
    expect(parseUnitDetail({ unitName: "MORE MORE JUMP!" })).toBeNull();
  });
});

describe("parseUnitMembers", () => {
  it("parses, sorts by gameCharacterId, and drops malformed records", () => {
    expect(
      parseUnitMembers({
        items: [
          { gameCharacterId: 12, firstName: "Aoyagi", unit: " IDOL ", colorCode: "#2" },
          { gameCharacterId: 6, firstName: "Kiritani", firstNameEnglish: "KIRITANI" },
          { gameCharacterId: 99 },
          "not-a-record",
          { gameCharacterId: -1, firstName: "Invalid" }
        ]
      })
    ).toEqual([
      {
        id: null,
        gameCharacterId: 6,
        unit: null,
        colorCode: null,
        firstName: "Kiritani",
        givenName: null,
        firstNameEnglish: "KIRITANI",
        givenNameEnglish: null,
        resourceId: null
      },
      {
        id: null,
        gameCharacterId: 12,
        unit: "idol",
        colorCode: "#2",
        firstName: "Aoyagi",
        givenName: null,
        firstNameEnglish: null,
        givenNameEnglish: null,
        resourceId: null
      },
      {
        id: null,
        gameCharacterId: 99,
        unit: null,
        colorCode: null,
        firstName: null,
        givenName: null,
        firstNameEnglish: null,
        givenNameEnglish: null,
        resourceId: null
      }
    ]);
  });

  it("returns an empty list for non-record payloads", () => {
    expect(parseUnitMembers(null)).toEqual([]);
    expect(parseUnitMembers({ items: "nope" })).toEqual([]);
  });
});
