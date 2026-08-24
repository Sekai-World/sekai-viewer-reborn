import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { describe, expect, it, vi } from "vitest";
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

  it("keeps interactive visible images behind the IntersectionObserver gate", async () => {
    let intersectionCallback: IntersectionObserverCallback | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    const originalIntersectionObserver = globalThis.IntersectionObserver;

    globalThis.IntersectionObserver = class {
      constructor(callback: IntersectionObserverCallback) {
        intersectionCallback = callback;
      }

      observe = observe;
      disconnect = disconnect;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
    } as unknown as typeof IntersectionObserver;

    try {
      const { container } = render(AssetImage, {
        src: "/interactive.png",
        alt: "Interactive image",
        interactive: true,
        loadMode: "visible"
      });

      await tick();
      expect(container.querySelector("button")).toBeNull();
      expect(container.querySelector("img")).toBeNull();
      expect(observe).toHaveBeenCalledOnce();

      intersectionCallback?.(
        [{ isIntersecting: true } as IntersectionObserverEntry],
        {} as IntersectionObserver
      );
      await tick();

      expect(container.querySelector("button")).not.toBeNull();
      expect(container.querySelector("img")?.getAttribute("src")).toBe("/interactive.png");
      expect(disconnect).toHaveBeenCalled();
    } finally {
      globalThis.IntersectionObserver = originalIntersectionObserver;
    }
  });
});
