import { describe, expect, it } from "vitest";

import { parseSimpleSelectableChoices } from "./SimpleSelectable";

describe("parseSimpleSelectableChoices", () => {
  it("splits slash-separated 『』-wrapped choices", () => {
    expect(parseSimpleSelectableChoices("『もちろん！』/『いつでも見守ってるよ』")).toEqual([
      "もちろん！",
      "いつでも見守ってるよ"
    ]);
  });

  it("handles choices without brackets", () => {
    expect(parseSimpleSelectableChoices("はい/いいえ")).toEqual(["はい", "いいえ"]);
  });

  it("trims surrounding whitespace and drops empty segments", () => {
    expect(parseSimpleSelectableChoices(" 『 a 』 / 『b』 / / ")).toEqual(["a", "b"]);
  });

  it("returns an empty list for an empty payload", () => {
    expect(parseSimpleSelectableChoices("")).toEqual([]);
  });
});
