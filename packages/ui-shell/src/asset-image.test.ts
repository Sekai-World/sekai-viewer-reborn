import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it } from "vitest";
import AssetImage from "./asset-image.svelte";

describe("AssetImage", () => {
  it("applies initial and changed sources without losing retry behavior", async () => {
    const { container, rerender } = render(AssetImage, {
      src: "/first.png",
      fallbackSrc: "/first-fallback.png",
      alt: "Banner"
    });

    await tick();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/first.png");

    await rerender({ src: "/second.png", fallbackSrc: "/second-fallback.png", alt: "Banner" });
    await tick();
    expect(container.querySelector("img")?.getAttribute("src")).toBe("/second.png");

    await fireEvent.error(container.querySelector("img")!);
    await tick();
    expect(container.querySelector("img")?.getAttribute("src")).toContain("second.png");
  });
});
