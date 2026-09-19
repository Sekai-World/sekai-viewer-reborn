import { describe, expect, it } from "vitest";
import { createPageTitle } from "./page-title";

describe("createPageTitle", () => {
  it("builds content | catalog | site", () => {
    expect(createPageTitle("Sekai Viewer", "Miku's Card", "Card List")).toBe(
      "Miku's Card | Card List | Sekai Viewer"
    );
  });

  it("builds catalog | site for list pages", () => {
    expect(createPageTitle("Sekai Tools", "Event Tracker")).toBe("Event Tracker | Sekai Tools");
  });

  it("falls back to the bare site name when segments are missing", () => {
    expect(createPageTitle("Sekai Media Lab")).toBe("Sekai Media Lab");
    expect(createPageTitle("Sekai Media Lab", null, undefined)).toBe("Sekai Media Lab");
  });

  it("drops blank segments instead of rendering empty separators", () => {
    expect(createPageTitle("Sekai Viewer", "  ", "Card List")).toBe("Card List | Sekai Viewer");
  });

  it("trims segments", () => {
    expect(createPageTitle("Sekai Viewer", " Card 1 ", " Card List ")).toBe(
      "Card 1 | Card List | Sekai Viewer"
    );
  });
});
