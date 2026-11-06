import { describe, expect, it } from "vitest";
import { filterComicsByTitle, type ComicItem } from "./comic";

const comics: ComicItem[] = [
  { id: 1, title: "Lunch Together" },
  { id: 2, title: "一緒に食べよ！" },
  { id: 3 }
];
const ids = (name: string): (number | undefined)[] =>
  filterComicsByTitle(comics, name).map((comic) => comic.id);

describe("filterComicsByTitle", () => {
  it("keeps every comic without a search", () => {
    expect(ids("")).toEqual([1, 2, 3]);
    expect(ids("   ")).toEqual([1, 2, 3]);
  });

  it("matches part of a title, ignoring case and outer spaces", () => {
    expect(ids(" lunch ")).toEqual([1]);
    expect(ids("食べ")).toEqual([2]);
  });

  it("leaves out comics that do not match, including ones without a title", () => {
    expect(ids("nothing")).toEqual([]);
  });
});
