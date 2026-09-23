import { beforeEach, describe, expect, it } from "vitest";
import { registeredIcons } from "../test/iconify-stub";

describe("tools-site support icon registration", () => {
  beforeEach(() => {
    registeredIcons.length = 0;
  });

  it("registers the hand-heart icon synchronously", async () => {
    await import("./mdi");

    expect(registeredIcons).toContain("mdi:hand-heart");
  });
});
