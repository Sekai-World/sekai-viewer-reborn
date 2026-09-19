import { describe, expect, it, vi } from "vitest";

const { loadGameNews } = vi.hoisted(() => ({ loadGameNews: vi.fn() }));
vi.mock("$lib/server/game-news", () => ({ loadGameNews }));

import { load } from "./+page.server";

describe("game news page load", () => {
  it("normalizes the route region before loading news", async () => {
    loadGameNews.mockResolvedValueOnce({ status: "empty" });

    await expect(
      load({ params: { region: "unsupported" } } as Parameters<typeof load>[0])
    ).resolves.toEqual({ region: "jp", news: { status: "empty" } });

    expect(loadGameNews).toHaveBeenCalledWith("jp");
  });
});
