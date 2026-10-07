import { describe, expect, it } from "vitest";
import { parseMusicListItem, parseMusicCategories } from "./music-list";
import { parseMusicDetail } from "./music-detail";

describe("parseMusicCategories", () => {
  it("returns the deduped categories for a canonical string[]", () => {
    expect(parseMusicCategories(["vivid", "street", "vivid"])).toEqual(["vivid", "street"]);
  });

  it("normalizes missing/malformed input to an empty array", () => {
    expect(parseMusicCategories(undefined)).toEqual([]);
    expect(parseMusicCategories(null)).toEqual([]);
    expect(parseMusicCategories("vivid")).toEqual([]);
    expect(parseMusicCategories(42)).toEqual([]);
    expect(parseMusicCategories({ categories: ["vivid"] })).toEqual([]);
  });

  it("drops non-string entries and keeps valid strings", () => {
    expect(parseMusicCategories(["vivid", 1, null, false, "", "street"])).toEqual([
      "vivid",
      "street"
    ]);
  });
});

describe("parseMusicListItem categories", () => {
  it("reads independent categories from the canonical string[] field", () => {
    const item = parseMusicListItem({
      id: "101",
      title: "Leo/need original",
      categories: ["vivid", "light_music_club", "vivid"]
    });

    expect(item?.categories).toEqual(["vivid", "light_music_club"]);
  });

  it("normalizes missing, null, and empty categories to an empty array", () => {
    expect(parseMusicListItem({ id: "1", title: "A" })?.categories).toEqual([]);
    expect(parseMusicListItem({ id: "1", title: "A", categories: null })?.categories).toEqual([]);
    expect(parseMusicListItem({ id: "1", title: "A", categories: [] })?.categories).toEqual([]);
  });

  it("drops malformed entries and keeps valid strings", () => {
    expect(
      parseMusicListItem({
        id: "1",
        title: "A",
        categories: ["vivid", 1, null, {}, "", "street"]
      })?.categories
    ).toEqual(["vivid", "street"]);
  });

  it("treats a non-array category value as empty (preserves compatibility)", () => {
    expect(parseMusicListItem({ id: "1", title: "A", categories: "vivid" })?.categories).toEqual(
      []
    );
  });
});

describe("parseMusicDetail categories", () => {
  it("reads independent categories from the canonical string[] field", () => {
    const detail = parseMusicDetail({
      music: { id: "101", title: "Leo/need original", categories: ["vivid", "street", "street"] }
    });

    expect(detail?.categories).toEqual(["vivid", "street"]);
  });

  it("normalizes missing and null categories to an empty array", () => {
    expect(parseMusicDetail({ music: { id: "1", title: "A" } })?.categories).toEqual([]);
    expect(
      parseMusicDetail({ music: { id: "1", title: "A", categories: null } })?.categories
    ).toEqual([]);
  });

  it("drops malformed entries and keeps valid strings", () => {
    expect(
      parseMusicDetail({
        music: { id: "1", title: "A", categories: [2, "vivid", false, "light_music_club"] }
      })?.categories
    ).toEqual(["vivid", "light_music_club"]);
  });
});

describe("parseMusicDetail music videos", () => {
  it("parses original and 2D descriptors while preserving explicit vocal references", () => {
    const detail = parseMusicDetail({
      music: { id: "1", title: "A" },
      musicVideos: [
        { category: "original", assetbundleName: "orig_0001", musicVocalId: "vocal-1" },
        { category: "mv_2d", assetbundleName: "mv_0001" }
      ]
    });

    expect(detail?.musicVideos).toEqual([
      { category: "original", assetBundleName: "orig_0001", musicVocalId: "vocal-1" },
      { category: "mv_2d", assetBundleName: "mv_0001", musicVocalId: null }
    ]);
  });

  it("defaults missing and malformed music videos to an empty array", () => {
    expect(parseMusicDetail({ music: { id: "1", title: "A" } })?.musicVideos).toEqual([]);
    expect(
      parseMusicDetail({
        music: { id: "1", title: "A" },
        musicVideos: [
          null,
          { category: "unknown", assetbundleName: "bad" },
          { category: "original", assetbundleName: " " },
          { category: "mv_2d", assetbundleName: "../escape" },
          { category: "mv_2d", assetbundleName: "bad?name" },
          { category: "mv_2d", assetbundleName: "valid", musicVocalId: {} },
          { category: "mv_2d", assetbundleName: "valid", musicVocalId: "" },
          { category: "mv_2d", assetbundleName: "valid" }
        ]
      })?.musicVideos
    ).toEqual([{ category: "mv_2d", assetBundleName: "valid", musicVocalId: null }]);
  });

  it("does not turn a missing explicit vocal into an implicit reference", () => {
    const detail = parseMusicDetail({
      music: { id: "1", title: "A" },
      musicVideos: [{ category: "original", assetbundleName: "orig", musicVocalId: "missing" }]
    });

    expect(detail?.musicVideos[0]?.musicVocalId).toBe("missing");
  });
});

describe("list/detail category consistency", () => {
  it("produces the same categories for the same canonical input", () => {
    const source = ["vivid", "street", "light_music_club", "vivid"];
    const listItem = parseMusicListItem({ id: "55", title: "Shared", categories: source });
    const detail = parseMusicDetail({ music: { id: "55", title: "Shared", categories: source } });

    expect(listItem?.categories).toEqual(detail?.categories);
  });

  it("produces consistent empty categories when the field is missing", () => {
    const listItem = parseMusicListItem({ id: "55", title: "Shared" });
    const detail = parseMusicDetail({ music: { id: "55", title: "Shared" } });

    expect(listItem?.categories).toEqual([]);
    expect(detail?.categories).toEqual([]);
  });

  it("produces consistent normalization for malformed input", () => {
    const malformed = ["vivid", 7, null, "street"];
    const listItem = parseMusicListItem({ id: "55", title: "Shared", categories: malformed });
    const detail = parseMusicDetail({
      music: { id: "55", title: "Shared", categories: malformed }
    });

    expect(listItem?.categories).toEqual(detail?.categories);
  });
});
