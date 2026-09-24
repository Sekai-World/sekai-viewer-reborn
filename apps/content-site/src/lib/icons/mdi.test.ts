import { describe, expect, it, vi } from "vitest";
import "./mdi";

const { addIcon } = vi.hoisted(() => ({ addIcon: vi.fn() }));

vi.mock("@iconify/svelte", () => ({ addIcon }));

// Vitest clears mock calls before each test, so capture what importing `./mdi` registered.
const registeredIconNames = addIcon.mock.calls.map(([name]) => name);

describe("content-site support icon registration", () => {
  it("registers support icons synchronously", () => {
    const supportIconNames = [
      "mdi:hand-heart",
      "mdi:patreon",
      "mdi:coffee",
      "mdi:twitter",
      "mdi:github"
    ];

    expect(registeredIconNames.filter((name) => supportIconNames.includes(name))).toEqual(
      supportIconNames
    );
  });
});
