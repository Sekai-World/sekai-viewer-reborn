import { describe, expect, it } from "vitest";
import { getNewsRegionOptions } from "./region-options";

describe("getNewsRegionOptions", () => {
  it("marks the current route region active after navigation", () => {
    const regions = ["jp", "en", "tw", "kr", "cn"] as const;

    expect(getNewsRegionOptions(regions, "jp").find((option) => option.active)?.key).toBe("jp");
    expect(getNewsRegionOptions(regions, "en")).toEqual([
      { key: "jp", label: "JP", active: false, href: "/news/jp" },
      { key: "en", label: "EN", active: true, href: "/news/en" },
      { key: "tw", label: "TW", active: false, href: "/news/tw" },
      { key: "kr", label: "KR", active: false, href: "/news/kr" },
      { key: "cn", label: "CN", active: false, href: "/news/cn" }
    ]);
  });
});
