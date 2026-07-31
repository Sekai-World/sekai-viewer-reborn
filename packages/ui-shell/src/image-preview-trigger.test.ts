import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImagePreviewDialog from "./image-preview-dialog.svelte";
import ImagePreviewTrigger from "./image-preview-trigger.svelte";

const flushEffects = async (): Promise<void> => {
  await Promise.resolve();
  await tick();
};

const getImage = (container: HTMLElement): HTMLImageElement => {
  const image = container.querySelector("img");
  if (!(image instanceof HTMLImageElement)) {
    throw new Error("Expected a preview image to be rendered");
  }

  return image;
};

const getImageSource = (container: HTMLElement): string | null =>
  getImage(container).getAttribute("src");

describe("ImagePreviewTrigger retry characterization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries after the current 300ms then 900ms delay cycle", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { container } = render(ImagePreviewTrigger, {
      src: "https://cdn.example.test/preview.png",
      alt: "Preview"
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(299);
    await flushEffects();
    expect(getImageSource(container)).toBe("https://cdn.example.test/preview.png");

    await vi.advanceTimersByTimeAsync(1);
    await flushEffects();
    expect(getImageSource(container)).toContain("__image_retry=");
    expect(getImageSource(container)).toContain("-primary-1");

    await fireEvent.error(getImage(container));
    await vi.advanceTimersByTimeAsync(899);
    await flushEffects();
    expect(getImageSource(container)).toContain("-primary-1");

    await vi.advanceTimersByTimeAsync(1);
    await flushEffects();
    expect(getImageSource(container)).toContain("-primary-2");
  });

  it("skips the HEAD probe for cross-origin resources", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const { container } = render(ImagePreviewTrigger, {
      src: "https://cdn.example.test/preview.png",
      alt: "Preview"
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flushEffects();
    expect(getImageSource(container)).toContain("__image_retry=");
    expect(getImageSource(container)).toContain("-primary-1");
  });

  it("uses a same-origin HEAD 404 as immediate exhaustion and falls back", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 404 } as Response);
    const { container } = render(ImagePreviewTrigger, {
      src: "/missing-preview.png",
      fallbackSrc: "/fallback-preview.png",
      alt: "Preview",
      fallbackLabel: "Preview unavailable"
    });

    await fireEvent.error(getImage(container));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/missing-preview.png",
      expect.objectContaining({ method: "HEAD", cache: "no-store" })
    );
    expect(getImageSource(container)).toBe("/fallback-preview.png");
    expect(container.querySelector("button")?.disabled).toBe(false);
  });

  it("ignores a stale probe after the source changes", async () => {
    let resolveProbe: ((response: Response) => void) | undefined;
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => {
        resolveProbe = resolve;
      });
    });
    const { container, rerender } = render(ImagePreviewTrigger, {
      src: "/old-preview.png",
      alt: "Preview"
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await rerender({ src: "/new-preview.png" });
    await flushEffects();
    expect(probeSignal?.aborted).toBe(true);

    resolveProbe?.({ status: 200 } as Response);
    await flushEffects();
    await vi.advanceTimersByTimeAsync(1000);
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getImageSource(container)).toBe("/new-preview.png");
  });

  it("cancels an in-flight probe when unmounted", async () => {
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { container, unmount } = render(ImagePreviewTrigger, {
      src: "/unmounted-preview.png",
      alt: "Preview"
    });

    await fireEvent.error(getImage(container));
    unmount();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probeSignal?.aborted).toBe(true);
  });
});

describe("ImagePreviewDialog retry characterization", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("applies the same-origin 404 fallback behavior in the dialog", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 404 } as Response);
    const { container } = render(ImagePreviewDialog, {
      open: false,
      src: "/missing-dialog-preview.png",
      fallbackSrc: "/fallback-dialog-preview.png",
      alt: "Preview",
      fallbackLabel: "Preview unavailable"
    });

    await fireEvent.error(getImage(container));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/missing-dialog-preview.png",
      expect.objectContaining({ method: "HEAD", cache: "no-store" })
    );
    expect(getImageSource(container)).toBe("/fallback-dialog-preview.png");
  });
});
