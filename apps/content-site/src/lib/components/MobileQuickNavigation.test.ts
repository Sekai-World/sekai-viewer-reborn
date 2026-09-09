import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import MobileQuickNavigation from "./MobileQuickNavigation.svelte";

const items = [
  { label: "Home", href: "/", active: false, icon: "mdi:home-variant-outline" },
  { label: "Cards", href: "/cards/jp", active: true, icon: "mdi:cards-outline" },
  { label: "Songs", href: "/musics/jp", active: false, icon: "mdi:music-note-outline" },
  { label: "Events", href: "/events/jp", active: false, icon: "mdi:calendar-star" },
  { label: "Gachas", href: "/gachas/jp", active: false, icon: "mdi:gift-outline" },
  {
    label: "Virtual Lives",
    href: "/virtual-lives/jp",
    active: false,
    icon: "mdi:account-voice"
  }
];

describe("MobileQuickNavigation", () => {
  it("renders six route links with current-page semantics", () => {
    render(MobileQuickNavigation, {
      items,
      navigationLabel: "Quick navigation"
    });

    expect(screen.getByRole("navigation", { name: "Quick navigation" })).toBeTruthy();
    expect(screen.getAllByRole("link")).toHaveLength(6);
    expect(screen.getByRole("link", { name: "Cards" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Home" }).getAttribute("aria-current")).toBeNull();
    expect(screen.getByRole("link", { name: "Gachas" }).getAttribute("href")).toBe("/gachas/jp");
    expect(screen.getByRole("link", { name: "Virtual Lives" }).getAttribute("href")).toBe(
      "/virtual-lives/jp"
    );
  });
});
