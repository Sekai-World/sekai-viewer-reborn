import { describe, expect, it } from "vitest";
import { createCardListRequestQuery, parseCardListQueryState } from "./card-list";

describe("card list API query", () => {
  it("does not forward the presentation view to the API", () => {
    const queryState = parseCardListQueryState(
      new URLSearchParams("view=agenda&sort_by=id&character=123")
    );
    const query = createCardListRequestQuery(queryState, 2, 24);

    expect(query).toMatchObject({
      page: 2,
      page_size: 24,
      sort_by: "id",
      character: "123"
    });
    expect(query).not.toHaveProperty("view");
  });
});
