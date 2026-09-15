import { describe, expect, it } from "vitest";
import {
  DEFAULT_CARD_LIST_VIEW_MODE,
  getCardListViewFromSearchParams,
  parseCardListViewMode,
  withCardListView
} from "./card-list-view";

describe("card list view URL state", () => {
  it.each(["grid", "agenda", "comfy"] as const)("accepts %s as a view mode", (viewMode) => {
    expect(parseCardListViewMode(viewMode)).toBe(viewMode);
  });

  it.each([null, undefined, "", "unsupported"])("defaults %s to grid", (value) => {
    expect(parseCardListViewMode(value)).toBe(DEFAULT_CARD_LIST_VIEW_MODE);
  });

  it("distinguishes a missing view parameter from an invalid one", () => {
    expect(getCardListViewFromSearchParams(new URLSearchParams())).toBeNull();
    expect(getCardListViewFromSearchParams(new URLSearchParams("view=invalid"))).toBe("grid");
  });

  it("adds or replaces view while preserving existing query and hash state", () => {
    expect(withCardListView("/cards/jp?name=hello&page=3#results", "comfy")).toBe(
      "/cards/jp?name=hello&page=3&view=comfy#results"
    );
    expect(withCardListView("/cards/jp?view=agenda&sort_by=id", "grid")).toBe(
      "/cards/jp?view=grid&sort_by=id"
    );
  });

  it("leaves links unchanged when there is no view to preserve", () => {
    expect(withCardListView("/cards/jp?character=1", null)).toBe("/cards/jp?character=1");
  });
});
