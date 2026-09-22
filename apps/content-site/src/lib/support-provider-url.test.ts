import { describe, expect, it } from "vitest";
import { getKofiSupportUrl, getPatreonSupportUrl } from "./support-provider-url";

describe("support provider URLs", () => {
  it.each([
    ["https://patreon.com/sekai", "https://patreon.com/sekai"],
    ["https://www.patreon.com/sekai", "https://www.patreon.com/sekai"]
  ])("accepts allowed Patreon URL %s", (value, expected) => {
    expect(getPatreonSupportUrl(value)).toBe(expected);
  });

  it.each([
    ["https://ko-fi.com/sekai", "https://ko-fi.com/sekai"],
    ["https://www.ko-fi.com/sekai", "https://www.ko-fi.com/sekai"]
  ])("accepts allowed Ko-fi URL %s", (value, expected) => {
    expect(getKofiSupportUrl(value)).toBe(expected);
  });

  it.each([
    "http://patreon.com/sekai",
    "https://patreon.com.example/sekai",
    "https://other.example/sekai",
    "https://user@patreon.com/sekai",
    "https://patreon.com:8443/sekai",
    "not a URL",
    "  "
  ])("rejects invalid Patreon URL %s", (value) => {
    expect(getPatreonSupportUrl(value)).toBeNull();
  });

  it.each([
    "http://ko-fi.com/sekai",
    "https://ko-fi.com.example/sekai",
    "https://other.example/sekai",
    "https://user@ko-fi.com/sekai",
    "https://ko-fi.com:8443/sekai",
    "not a URL",
    "  "
  ])("rejects invalid Ko-fi URL %s", (value) => {
    expect(getKofiSupportUrl(value)).toBeNull();
  });

  it("hides missing provider values", () => {
    expect(getPatreonSupportUrl(undefined)).toBeNull();
    expect(getKofiSupportUrl(undefined)).toBeNull();
  });
});
