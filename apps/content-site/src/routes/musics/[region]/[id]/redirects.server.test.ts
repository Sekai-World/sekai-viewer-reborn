import { describe, expect, it } from "vitest";
import { GET as detailGet } from "./+server";
import { GET as downloadGet } from "./download/+server";
import { GET as progressGet } from "./download/progress/+server";

type LegacyGet = typeof detailGet;

const legacyRoutes: { name: string; get: LegacyGet; suffix: string }[] = [
  { name: "detail", get: detailGet, suffix: "" },
  { name: "download", get: downloadGet as unknown as LegacyGet, suffix: "/download" },
  {
    name: "download progress",
    get: progressGet as unknown as LegacyGet,
    suffix: "/download/progress"
  }
];

const redirectFor = async (
  get: LegacyGet,
  region: string,
  id: string,
  search = ""
): Promise<{ status: number; location: string }> => {
  try {
    await get({
      params: { region, id },
      url: new URL(`https://viewer.test/musics/legacy${search}`)
    } as unknown as Parameters<LegacyGet>[0]);
  } catch (thrown) {
    return thrown as { status: number; location: string };
  }
  throw new Error("Expected the legacy route to redirect.");
};

describe.each(legacyRoutes)("legacy /musics/:region/:id $name redirect", ({ get, suffix }) => {
  it("permanently redirects a valid music to the canonical route with its query", async () => {
    await expect(redirectFor(get, "jp", "123", "?taskId=a%20b&format=flac")).resolves.toEqual(
      expect.objectContaining({
        status: 301,
        location: `/music/jp/123${suffix}?taskId=a%20b&format=flac`
      })
    );
  });

  it.each([
    ["an unknown region", "xx", "1", `/music/xx/1${suffix}`],
    ["a zero id", "jp", "0", `/music/jp/0${suffix}`],
    ["a negative id", "jp", "-1", `/music/jp/-1${suffix}`],
    ["a non-numeric id", "jp", "abc", `/music/jp/abc${suffix}`],
    ["a very large id", "jp", "99999999999999999999", `/music/jp/99999999999999999999${suffix}`]
  ])("leaves validation of %s to the canonical route", async (_case, region, id, location) => {
    await expect(redirectFor(get, region, id)).resolves.toEqual(
      expect.objectContaining({ status: 301, location })
    );
  });

  it.each([
    ["decoded traversal", "jp", "../../cards/jp"],
    ["a decoded slash in the region", "../evil", "1"],
    ["a protocol-relative region", "//evil.test", "1"],
    ["a backslash", "jp", "..\\..\\cards"],
    ["a percent sign", "jp", "%2F"],
    ["CR/LF characters", "jp", "1\r\nset-cookie: x=1"],
    ["non-Latin-1 characters", "jp", "あ"]
  ])("keeps %s inside its canonical path segment", async (_case, region, id) => {
    const { status, location } = await redirectFor(get, region, id);
    expect(status).toBe(301);

    // SvelteKit sends the location as a header; it must be a valid header value.
    expect(() => new Response(null, { status, headers: { location } })).not.toThrow();

    const resolved = new URL(location, "https://viewer.test/musics/jp/1");
    expect(resolved.origin).toBe("https://viewer.test");
    const segments = resolved.pathname.split("/");
    expect(segments.slice(0, 2)).toEqual(["", "music"]);
    expect(segments.slice(2, 4).map(decodeURIComponent)).toEqual([region, id]);
    expect(`/${segments.slice(4).join("/")}`.replace(/^\/$/, "")).toBe(suffix);
  });
});
