import { describe, expect, it } from "vitest";
import { createPageTitle } from "./page-title";

describe("createPageTitle", () => {
  it("joins segments before the site name", () => {
    expect(createPageTitle("Card story", "Live2D Model Viewer")).toBe(
      "Card story | Live2D Model Viewer | Sekai Media Lab"
    );
  });

  it("degrades to the bare site name when segments are missing", () => {
    expect(createPageTitle()).toBe("Sekai Media Lab");
    expect(createPageTitle(null, undefined)).toBe("Sekai Media Lab");
  });

  it("drops blank segments instead of rendering empty separators", () => {
    expect(createPageTitle("  ", "Card story")).toBe("Card story | Sekai Media Lab");
  });
});
