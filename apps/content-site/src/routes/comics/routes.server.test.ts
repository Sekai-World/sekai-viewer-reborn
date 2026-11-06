import { beforeEach, describe, expect, it, vi } from "vitest";

const server = vi.hoisted(() => ({ fetchComics: vi.fn() }));
vi.mock("#lib/server/comics.js", () => ({ fetchComics: server.fetchComics }));
vi.mock("#lib/server/config", () => ({ getMasterApiBaseUrl: () => "https://master-api.test" }));

import { load } from "./[region]/+page.server";

const run = (region: string) =>
  load({ params: { region } } as never) as Exclude<
    ReturnType<typeof load>,
    void | Promise<unknown>
  >;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("comic list loader", () => {
  it("streams the region's comics", async () => {
    server.fetchComics.mockResolvedValueOnce([{ id: 1041 }]);

    const data = run("tw");

    expect(data.region).toBe("tw");
    await expect(data.comics).resolves.toEqual([{ id: 1041 }]);
    expect(server.fetchComics).toHaveBeenCalledWith("https://master-api.test", "tw");
  });

  it("resolves a failure to null and normalizes an unknown region", async () => {
    server.fetchComics.mockRejectedValueOnce(new Error("offline"));

    const data = run("xx");

    expect(data.region).toBe("jp");
    await expect(data.comics).resolves.toBeNull();
  });
});
