import { describe, expect, it, vi } from "vitest";
import packageJson from "../../package.json";

vi.mock("$lib/server/notifications", () => ({
  fetchGlobalNotices: vi.fn().mockResolvedValue([])
}));

import { load } from "../routes/+layout.server";

describe("account-site layout server load", () => {
  it("passes the package version to the site layout", async () => {
    await expect(load({ fetch: vi.fn() } as unknown as Parameters<typeof load>[0])).resolves.toEqual({
      globalNotices: [],
      siteVersion: packageJson.version
    });
  });
});
