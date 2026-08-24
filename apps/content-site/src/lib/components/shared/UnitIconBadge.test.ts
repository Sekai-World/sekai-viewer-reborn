import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import UnitIconBadge from "./UnitIconBadge.svelte";

describe("UnitIconBadge", () => {
  it("renders its complete icon frame as an accessible link when given an href", () => {
    render(UnitIconBadge, {
      unit: "idol",
      href: "/unit/jp/idol",
      ariaLabel: "MORE MORE JUMP!"
    });

    const link = screen.getByRole("link", { name: "MORE MORE JUMP!" });
    expect(link.getAttribute("href")).toBe("/unit/jp/idol");
    expect(link.querySelector("img")).not.toBeNull();
  });
});
