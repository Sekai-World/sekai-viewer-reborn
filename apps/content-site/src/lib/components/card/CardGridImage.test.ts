import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CardGridImage from "./CardGridImage.svelte";

const flushEffects = async (): Promise<void> => {
  await Promise.resolve();
  await tick();
};

const getImage = (container: HTMLElement): HTMLImageElement => {
  const image = container.querySelector("img");
  if (!(image instanceof HTMLImageElement)) {
    throw new Error("Expected a card image to be rendered");
  }

  return image;
};

describe("CardGridImage retry characterization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses its fallback immediately when a same-origin HEAD probe returns 404", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 404 } as Response);
    const { container } = render(CardGridImage, {
      src: "/missing-card.png",
      fallbackSrc: "/fallback-card.png",
      alt: "Card"
    });

    await fireEvent.error(getImage(container));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/missing-card.png",
      expect.objectContaining({ method: "HEAD", cache: "no-store" })
    );
    expect(getImage(container).getAttribute("src")).toBe("/fallback-card.png");
  });

  it("does not probe a cross-origin card image before its delayed retry", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { container } = render(CardGridImage, {
      src: "https://cdn.example.test/card.png",
      alt: "Card"
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flushEffects();
    expect(getImage(container).getAttribute("src")).toContain("__image_retry=");
  });

  it("keeps the component root as a raw image", () => {
    const { container } = render(CardGridImage, {
      src: "/card.png",
      alt: "Card"
    });

    expect(container.firstElementChild?.tagName).toBe("IMG");
    expect(container.querySelector("div")).toBeNull();
  });

  it("cancels a stale probe when its source changes", async () => {
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { container, rerender } = render(CardGridImage, {
      src: "/old-card.png",
      alt: "Card"
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await rerender({ src: "/new-card.png" });
    await flushEffects();

    expect(probeSignal?.aborted).toBe(true);
    expect(getImage(container).getAttribute("src")).toBe("/new-card.png");
  });

  it("cancels a same-origin probe when unmounted", async () => {
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { container, unmount } = render(CardGridImage, {
      src: "/unmounted-card.png",
      alt: "Card"
    });

    await fireEvent.error(getImage(container));
    unmount();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probeSignal?.aborted).toBe(true);
  });
});
