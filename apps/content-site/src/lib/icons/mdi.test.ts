import { describe, expect, it, vi } from "vitest";

const { addIcon } = vi.hoisted(() => ({ addIcon: vi.fn() }));

vi.mock("@iconify/svelte", () => ({ addIcon }));

describe("content-site support icon registration", () => {
  it("registers support icons synchronously", async () => {
    await import("./mdi");

    const supportIconNames = [
      "mdi:hand-heart",
      "mdi:patreon",
      "mdi:coffee",
      "mdi:twitter",
      "mdi:github"
    ];

    expect(
      addIcon.mock.calls
        .map(([name]) => name)
        .filter((name) => supportIconNames.includes(name))
    ).toEqual(supportIconNames);
  });
});
