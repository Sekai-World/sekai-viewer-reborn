import { fireEvent, render } from "@testing-library/svelte";
import { tick } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SIGNED_GET_RETRY_POLICY,
  STATIC_ASSET_RETRY_POLICY
} from "@platform/ui-shell/image-retry";
import AssetImage from "./AssetImage.svelte";

const flushEffects = async (): Promise<void> => {
  await Promise.resolve();
  await tick();
};

const getImage = (container: HTMLElement): HTMLImageElement => {
  const image = container.querySelector("img");
  if (!(image instanceof HTMLImageElement)) {
    throw new Error("Expected an asset image to be rendered");
  }

  return image;
};

describe("AssetImage retry behavior", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a same-origin HEAD probe before static cache-busting retries", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 200 } as Response);
    const { container } = render(AssetImage, {
      src: "/missing-asset.png",
      alt: "Asset"
    });

    await fireEvent.error(getImage(container));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledWith(
      "/missing-asset.png",
      expect.objectContaining({
        method: "HEAD",
        cache: "no-store",
        credentials: "same-origin"
      })
    );

    await vi.advanceTimersByTimeAsync(300);
    await flushEffects();
    expect(getImage(container).getAttribute("src")).toMatch(
      /^\/missing-asset\.png\?__image_retry=[^&]+-primary-1$/
    );
  });

  it("moves to the fallback immediately when static probing returns 404", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 404 } as Response);
    const { container } = render(AssetImage, {
      src: "/missing-asset.png",
      fallbackSrc: "/fallback-asset.png",
      alt: "Asset",
      fallbackLabel: "Asset unavailable"
    });

    await fireEvent.error(getImage(container));
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getImage(container).getAttribute("src")).toBe("/fallback-asset.png");
  });

  it("preserves a signed URL exactly and skips HEAD probes for direct loading", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const signedUrl =
      "/signed/asset.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc123#asset";
    const { container } = render(AssetImage, {
      src: signedUrl,
      alt: "Signed asset",
      retryPolicy: SIGNED_GET_RETRY_POLICY
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flushEffects();
    expect(getImage(container).getAttribute("src")).toBe(signedUrl);
  });

  it("forwards an explicit signed policy to interactive preview loading", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const signedUrl =
      "/signed/preview.png?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=def456#preview";
    const { container } = render(AssetImage, {
      src: signedUrl,
      alt: "Signed preview",
      interactive: true,
      retryPolicy: SIGNED_GET_RETRY_POLICY
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(300);
    await flushEffects();
    expect(getImage(container).getAttribute("src")).toBe(signedUrl);
  });

  it("ignores an in-flight probe after the source changes", async () => {
    let resolveProbe: ((response: Response) => void) | undefined;
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => {
        resolveProbe = resolve;
      });
    });
    const { container, rerender } = render(AssetImage, {
      src: "/old-asset.png",
      alt: "Asset"
    });

    await fireEvent.error(getImage(container));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await rerender({ src: "/new-asset.png" });
    await flushEffects();
    expect(probeSignal?.aborted).toBe(true);

    resolveProbe?.({ status: 200 } as Response);
    await flushEffects();
    await vi.advanceTimersByTimeAsync(1000);
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getImage(container).getAttribute("src")).toBe("/new-asset.png");
  });

  it("cancels an in-flight probe when unmounted", async () => {
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const { container, unmount } = render(AssetImage, {
      src: "/unmounted-asset.png",
      alt: "Asset"
    });

    await fireEvent.error(getImage(container));
    unmount();
    await flushEffects();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probeSignal?.aborted).toBe(true);
  });
});

describe("AssetImage static policy contract", () => {
  it("uses the shared static policy by default", () => {
    expect(STATIC_ASSET_RETRY_POLICY.probe).toBe("same-origin-head");
  });
});
