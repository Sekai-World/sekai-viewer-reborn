import { describe, expect, it, vi } from "vitest";

const { addIcon } = vi.hoisted(() => ({ addIcon: vi.fn() }));

vi.mock("@iconify/svelte", () => ({ addIcon }));

describe("media-lab-site mdi icon registration", () => {
  it("registers all shell icons synchronously", async () => {
    await import("./mdi");

    expect(addIcon).toHaveBeenCalledTimes(10);
    expect(addIcon.mock.calls.map(([name]) => name)).toEqual([
      "mdi:menu",
      "mdi:close",
      "mdi:home-variant-outline",
      "mdi:palette-outline",
      "mdi:cog-outline",
      "mdi:tune-variant",
      "mdi:check",
      "mdi:brightness-auto",
      "mdi:white-balance-sunny",
      "mdi:weather-night"
    ]);
  });
});
