import { describe, expect, it } from "vitest";
import { createPageTitle } from "./page-title";

describe("createPageTitle", () => {
  it("creates a title with the site name", () => {
    expect(createPageTitle("Game News")).toBe("Game News - Sekai Viewer");
  });

  it("adds trimmed context segments before the site name", () => {
    expect(createPageTitle("Game News", " JP ", " 123 ")).toBe(
      "Game News JP 123 - Sekai Viewer"
    );
  });

  it("ignores empty and whitespace-only segments", () => {
    expect(createPageTitle("  Game News  ", "", "  ", null, undefined, " JP ")).toBe(
      "Game News JP - Sekai Viewer"
    );
    expect(createPageTitle(" ", "\t")).toBe("Sekai Viewer");
  });
});
