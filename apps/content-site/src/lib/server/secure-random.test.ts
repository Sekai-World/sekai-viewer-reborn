import { beforeEach, describe, expect, it, vi } from "vitest";

const { randomInt } = vi.hoisted(() => ({
  randomInt: vi.fn()
}));

vi.mock("node:crypto", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:crypto")>()),
  default: { randomInt },
  randomInt
}));

import { getSecureRandomUnit } from "./secure-random";

describe("getSecureRandomUnit", () => {
  beforeEach(() => {
    randomInt.mockReset();
  });

  it("maps the cryptographic integer source to a unit interval", () => {
    randomInt.mockReturnValue(2 ** 31);

    expect(getSecureRandomUnit()).toBe(0.5);
    expect(randomInt).toHaveBeenCalledWith(2 ** 32);
  });

  it("keeps the exclusive upper bound below one", () => {
    randomInt.mockReturnValue(2 ** 32 - 1);

    const value = getSecureRandomUnit();

    expect(value).toBeGreaterThan(0);
    expect(value).toBeLessThan(1);
  });
});
