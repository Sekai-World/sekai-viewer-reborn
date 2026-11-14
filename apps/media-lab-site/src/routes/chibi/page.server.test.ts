import { describe, expect, it, vi } from "vitest";

vi.mock("$app/env/private", () => ({ SEKAI_MASTER_API_BASE_URL: "" }));

import type { ChibiCatalog } from "#lib/chibi/chibi-catalog.js";
import { _createChibiCatalogPageLoad } from "./+page.server";

type PageData = { catalog: Promise<ChibiCatalog> };
type LoadEvent = Parameters<ReturnType<typeof _createChibiCatalogPageLoad>>[0];

const runLoad = (resolveCatalog: Parameters<typeof _createChibiCatalogPageLoad>[0]) => {
  const fetcher = vi.fn() as unknown as typeof fetch;
  const data = _createChibiCatalogPageLoad(resolveCatalog)({
    fetch: fetcher
  } as LoadEvent) as PageData;
  return { data, fetcher };
};

describe("Chibi catalog page load", () => {
  it("streams the catalog instead of waiting for it", async () => {
    let resolveCatalog!: (catalog: ChibiCatalog) => void;
    const pending = new Promise<ChibiCatalog>((resolve) => {
      resolveCatalog = resolve;
    });
    const resolver = vi.fn(() => pending);

    const { data, fetcher } = runLoad(resolver);

    expect(data.catalog).toBeInstanceOf(Promise);
    const ready: ChibiCatalog = { status: "ready", models: [], characters: [] };
    resolveCatalog(ready);
    await expect(data.catalog).resolves.toBe(ready);
    expect(resolver).toHaveBeenCalledWith(fetcher);
  });

  it.each([
    ["rejects", () => Promise.reject(new Error("boom"))],
    [
      "throws",
      () => {
        throw new Error("boom");
      }
    ]
  ])("reports an error when the resolver %s", async (_label, resolver) => {
    const { data } = runLoad(resolver);

    await expect(data.catalog).resolves.toEqual({ status: "error" });
  });
});
