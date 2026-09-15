import { describe, expect, it } from "vitest";
import {
  createGachaListRequestQuery,
  parseGachaListQueryState,
  type GachaListQueryState
} from "./gacha-list";

const defaultQueryState: GachaListQueryState = {
  sortBy: "startAt",
  sortOrder: "desc",
  spoiler: false,
  ongoing: false
};

describe("gacha list query state", () => {
  it("accepts only the literal true value for the ongoing filter", () => {
    expect(parseGachaListQueryState(new URLSearchParams("ongoing=true")).ongoing).toBe(true);
    expect(parseGachaListQueryState(new URLSearchParams("ongoing=false")).ongoing).toBe(false);
    expect(parseGachaListQueryState(new URLSearchParams("ongoing=1")).ongoing).toBe(false);
  });

  it("adds ongoing=true only when the filter is enabled", () => {
    const defaultQuery = createGachaListRequestQuery(defaultQueryState, 2, 20);
    const ongoingQuery = createGachaListRequestQuery(
      { ...defaultQueryState, ongoing: true },
      2,
      20
    );

    expect(defaultQuery).not.toHaveProperty("ongoing");
    expect(ongoingQuery).toMatchObject({ page: 2, page_size: 20, ongoing: true });
  });
});
