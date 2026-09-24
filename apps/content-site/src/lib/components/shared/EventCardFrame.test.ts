import { cleanup, render } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EventCardFrame from "./EventCardFrame.svelte";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {}
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("EventCardFrame", () => {
  it("renders a single card link by default", () => {
    const { container } = render(EventCardFrame, {
      href: "/event/jp/1",
      frameClass: "relative block"
    });

    expect(container.querySelector("article")).toBeNull();
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/event/jp/1");
  });

  it("uses a stretched link so the body can hold its own controls", () => {
    const { container, getByRole } = render(EventCardFrame, {
      href: "/event/jp/1",
      frameClass: "relative block",
      stretchedLinkLabel: "Event title"
    });

    expect(container.querySelector("article")).not.toBeNull();
    const link = getByRole("link", { name: "Event title" });
    expect(link.getAttribute("href")).toBe("/event/jp/1");
    expect(link.className).toContain("absolute");
    expect(link.className).toContain("inset-0");
    expect(link.parentElement?.querySelector(".pointer-events-none")).not.toBeNull();
  });
});
