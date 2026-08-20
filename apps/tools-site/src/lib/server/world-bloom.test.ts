import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getWorldBloomsByRegionList: vi.fn() }));

vi.mock("@platform/sekai-master-api-sdk", () => mocks);

import { getWorldBloomMetadata, parseWorldBloomItems } from "./world-bloom";

describe("World Bloom metadata", () => {
  beforeEach(() => vi.clearAllMocks());

  it("groups flat chapter records by event and preserves real chapter timestamps", () => {
    expect(parseWorldBloomItems([
      { id: 9, eventId: "42", chapterNo: "2", gameCharacterId: "3", chapterStartAt: 1_700_000_000_000, chapterEndAt: "2026-01-02T00:00:00Z", aggregateAt: "2026-01-03T00:00:00Z" },
      { id: 8, eventId: 42, chapterNo: 1, gameCharacterId: 2, chapterStartAt: "2026-01-01T00:00:00Z", chapterEndAt: 1_700_086_400_000, aggregateAt: 1_700_172_800_000 }
    ])).toEqual([{
      eventId: 42,
      chapters: [
        { id: 8, chapterNo: 1, gameCharacterId: 2, chapterStartAt: "2026-01-01T00:00:00Z", chapterEndAt: 1_700_086_400_000, aggregateAt: 1_700_172_800_000 },
        { id: 9, chapterNo: 2, gameCharacterId: 3, chapterStartAt: 1_700_000_000_000, chapterEndAt: "2026-01-02T00:00:00Z", aggregateAt: "2026-01-03T00:00:00Z" }
      ]
    }]);
  });

  it("preserves Unix timestamp forms", () => {
    expect(parseWorldBloomItems([{ id: 1, eventId: 42, chapterNo: 1, gameCharacterId: 2, chapterStartAt: 1_767_244_800, chapterEndAt: 1_767_291_723_000, aggregateAt: 1_767_300_000_000 }])[0].chapters[0]).toMatchObject({ chapterStartAt: 1_767_244_800, chapterEndAt: 1_767_291_723_000, aggregateAt: 1_767_300_000_000 });
  });

  it("loads all pages and deduplicates repeated flat chapter records", async () => {
    mocks.getWorldBloomsByRegionList
      .mockResolvedValueOnce({ data: { items: [{ id: 1, eventId: 42, chapterNo: 1, gameCharacterId: 2 }], pagination: { totalPages: 2 } } })
      .mockResolvedValueOnce({ data: { items: [{ id: 1, eventId: 42, chapterNo: 1, gameCharacterId: 2 }, { id: 2, eventId: 42, chapterNo: 2, gameCharacterId: 3 }], pagination: { totalPages: 2 } } });

    await expect(getWorldBloomMetadata("https://master.example.test", "en")).resolves.toMatchObject({
      status: "available", items: [{ eventId: 42, chapters: [{ chapterNo: 1 }, { chapterNo: 2 }] }]
    });
    expect(mocks.getWorldBloomsByRegionList).toHaveBeenNthCalledWith(2, expect.objectContaining({ query: expect.objectContaining({ page: 2 }) }));
  });

  it("drops malformed flat records instead of treating nested data as a chapter", () => {
    expect(parseWorldBloomItems([
      { id: 1, eventId: 42, chapters: [{ chapterNo: 1, gameCharacterId: 2 }] },
      { id: 2, eventId: 42, chapterNo: 1, gameCharacterId: 2, chapterStartAt: {}, chapterEndAt: [], aggregateAt: {} }
    ])).toEqual([{ eventId: 42, chapters: [{ id: 2, chapterNo: 1, gameCharacterId: 2, chapterStartAt: null, chapterEndAt: null, aggregateAt: null }] }]);
  });
});
