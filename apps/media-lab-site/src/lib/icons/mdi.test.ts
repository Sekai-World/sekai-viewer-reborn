import { describe, expect, it, vi } from "vitest";
import "./mdi";

const { addIcon } = vi.hoisted(() => ({ addIcon: vi.fn() }));

vi.mock("@iconify/svelte", () => ({ addIcon }));

// Vitest clears mock calls before each test, so capture what importing `./mdi` registered.
const registeredIconNames = addIcon.mock.calls.map(([name]) => name);

describe("media-lab-site mdi icon registration", () => {
  it("registers all shell icons synchronously", () => {
    expect(registeredIconNames).toHaveLength(47);
    expect(registeredIconNames).toEqual([
      "mdi:menu",
      "mdi:close",
      "mdi:home-variant-outline",
      "mdi:palette-outline",
      "mdi:cog-outline",
      "mdi:tune-variant",
      "mdi:check",
      "mdi:brightness-auto",
      "mdi:white-balance-sunny",
      "mdi:weather-night",
      "mdi:drama-masks",
      "mdi:cube-outline",
      "mdi:book-open-variant",
      "mdi:arrow-right",
      "mdi:arrow-left",
      "mdi:progress-wrench",
      "mdi:map-search-outline",
      "mdi:refresh-circle",
      "mdi:reload",
      "mdi:pause",
      "mdi:restart",
      "mdi:translate",
      "mdi:flask-outline",
      "mdi:alert-circle-outline",
      "mdi:script-text-outline",
      "mdi:swap-horizontal",
      "mdi:play-circle-outline",
      "mdi:stop-circle-outline",
      "mdi:volume-off",
      "mdi:image-outline",
      "mdi:music-note-outline",
      "mdi:movie-open-outline",
      "mdi:magnify",
      "mdi:alert",
      "mdi:skip-next",
      "mdi:account-group-outline",
      "mdi:calendar-star",
      "mdi:account-voice",
      "mdi:card-multiple-outline",
      "mdi:map-marker-radius-outline",
      "mdi:auto-fix",
      "mdi:skip-previous",
      "mdi:download-circle-outline",
      "mdi:fullscreen",
      "mdi:fullscreen-exit",
      "mdi:phone-rotate-landscape",
      "mdi:hand-heart"
    ]);
  });
});
