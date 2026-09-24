import { describe, expect, it } from "vitest";
import { registeredIcons } from "../test/iconify-stub";
import "./mdi";

// Capture what importing `./mdi` registered before any test hook can reset the stub.
const registeredIconNames = [...registeredIcons];

describe("tools-site support icon registration", () => {
  it("registers the hand-heart icon synchronously", () => {
    expect(registeredIconNames).toContain("mdi:hand-heart");
  });
});
