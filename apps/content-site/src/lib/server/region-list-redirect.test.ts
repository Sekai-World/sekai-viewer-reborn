import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getRegionListRedirect, REGION_LIST_PATHS } from "./region-list-redirect";

const routesDir = join(import.meta.dirname, "../../routes");

const hasPage = (dir: string): boolean =>
  readdirSync(dir).some((name) => name.startsWith("+page."));

// Every `<path>/[region]` page whose `<path>` has no page of its own.
const findRegionListPaths = (): string[] =>
  readdirSync(routesDir, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith("/[region]") && !entry.startsWith("api/"))
    .filter((entry) => hasPage(`${routesDir}/${entry}`))
    .map((entry) => entry.slice(0, -"/[region]".length))
    .filter((parent) => !existsSync(`${routesDir}/${parent}`) || !hasPage(`${routesDir}/${parent}`))
    .map((parent) => `/${parent}`)
    .sort();

const redirectFor = (path: string, cookie: string | undefined, method = "GET"): Response | null =>
  getRegionListRedirect(method, new URL(path, "https://example.test"), cookie);

describe("getRegionListRedirect", () => {
  it("covers every list route that needs a region", () => {
    expect([...REGION_LIST_PATHS].sort()).toEqual(findRegionListPaths());
  });

  it("redirects to the default region when the cookie is absent", () => {
    const response = redirectFor("/musics", undefined);

    expect(response?.status).toBe(302);
    expect(response?.headers.get("location")).toBe("/musics/jp");
    expect(response?.headers.get("cache-control")).toBe("private, no-store");
  });

  it("redirects to the preferred region from the cookie", () => {
    expect(redirectFor("/mysekai/fixtures", "tw")?.headers.get("location")).toBe(
      "/mysekai/fixtures/tw"
    );
  });

  it("falls back to the default region for an unsupported cookie value", () => {
    expect(redirectFor("/cards", "xx")?.headers.get("location")).toBe("/cards/jp");
  });

  it("keeps the query string", () => {
    expect(redirectFor("/events?page=2&sort=asc", "en")?.headers.get("location")).toBe(
      "/events/en?page=2&sort=asc"
    );
  });

  it("accepts a trailing slash", () => {
    expect(redirectFor("/stamps/", "kr")?.headers.get("location")).toBe("/stamps/kr");
  });

  it("redirects HEAD requests", () => {
    expect(redirectFor("/news", "cn", "HEAD")?.headers.get("location")).toBe("/news/cn");
  });

  it.each([
    ["a POST request", "/musics", "POST"],
    ["a path that already has a region", "/musics/jp", "GET"],
    ["a detail path without a region", "/music/1", "GET"],
    ["the home page", "/", "GET"],
    ["an unrelated path", "/updates", "GET"]
  ])("leaves %s alone", (_caseName, path, method) => {
    expect(redirectFor(path, "tw", method)).toBeNull();
  });
});
