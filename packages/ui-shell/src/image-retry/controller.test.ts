import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImageRetryController,
  SIGNED_GET_RETRY_POLICY
} from "./index";

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("ImageRetryController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the static policy for cache busting and renews its nonce per cycle", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 200 } as Response);
    const controller = new ImageRetryController("/asset.png?size=large#preview", undefined);
    const initialSnapshot = controller.requestSnapshot;

    expect(initialSnapshot?.url).toBe("/asset.png?size=large#preview");
    controller.handleImageError(initialSnapshot!);
    await flushPromises();
    await vi.advanceTimersByTimeAsync(300);

    const retrySnapshot = controller.requestSnapshot;
    expect(fetchMock).toHaveBeenCalledWith(
      "/asset.png?size=large#preview",
      expect.objectContaining({
        method: "HEAD",
        credentials: "same-origin",
        cache: "no-store"
      })
    );
    expect(retrySnapshot?.url).toMatch(/^\/asset\.png\?size=large&__image_retry=[^#]+#preview$/);
    expect(retrySnapshot?.nonce).toBe(initialSnapshot?.nonce);

    controller.reset();
    expect(controller.requestSnapshot?.nonce).not.toBe(retrySnapshot?.nonce);
    controller.dispose();
  });

  it("preserves signed GET URLs exactly and does not issue a HEAD probe", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const signedUrl = "/signed/image.png?X-Amz-Signature=a%2Fb&x=1#fragment";
    const controller = new ImageRetryController(signedUrl, undefined, SIGNED_GET_RETRY_POLICY);
    const initialSnapshot = controller.requestSnapshot;

    controller.handleImageError(initialSnapshot!);
    expect(fetchMock).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(controller.requestUrl).toBe(signedUrl);
    expect(controller.requestSnapshot?.url).toBe(signedUrl);
    controller.dispose();
  });

  it("transitions to a distinct fallback after primary exhaustion and then reaches terminal failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 404 } as Response);
    const controller = new ImageRetryController("/missing.png", "/fallback.png");
    const primarySnapshot = controller.requestSnapshot;

    controller.handleImageError(primarySnapshot!);
    await flushPromises();

    expect(controller.currentSrc).toBe("/fallback.png");
    expect(controller.imageFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const fallbackSnapshot = controller.requestSnapshot;
    controller.handleImageError(fallbackSnapshot!);
    await flushPromises();

    expect(controller.imageFailed).toBe(true);
    expect(controller.imageLoaded).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it("allows exactly two retries in both the primary and fallback phases", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({ status: 503 } as Response);
    const controller = new ImageRetryController("/primary.png", "/fallback.png");

    const failCurrentRequest = async (): Promise<void> => {
      const snapshot = controller.requestSnapshot;
      controller.handleImageError(snapshot!);
      await flushPromises();
      if (controller.requestSnapshot === snapshot) {
        await vi.advanceTimersByTimeAsync(snapshot!.attempt === 0 ? 300 : 900);
      }
    };

    await failCurrentRequest();
    await failCurrentRequest();
    await failCurrentRequest();
    expect(controller.currentSrc).toBe("/fallback.png");
    expect(controller.attempt).toBe(0);

    await failCurrentRequest();
    await failCurrentRequest();
    await failCurrentRequest();
    expect(controller.imageFailed).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    controller.dispose();
  });

  it("rejects a stale probe after a source reset", async () => {
    let resolveProbe: ((response: Response) => void) | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveProbe = resolve;
        })
    );
    const controller = new ImageRetryController("/old.png", "/old-fallback.png");
    const oldSnapshot = controller.requestSnapshot;

    controller.handleImageError(oldSnapshot!);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    controller.setSources("/new.png", "/new-fallback.png");
    resolveProbe?.({ status: 404 } as Response);
    await flushPromises();

    expect(controller.currentSrc).toBe("/new.png");
    expect(controller.imageFailed).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it("cancels pending work and rejects events after dispose", async () => {
    let probeSignal: AbortSignal | undefined;
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation((_input, init) => {
      probeSignal = init?.signal ?? undefined;
      return new Promise<Response>(() => undefined);
    });
    const controller = new ImageRetryController("/asset.png", undefined);
    const snapshot = controller.requestSnapshot;

    controller.handleImageError(snapshot!);
    controller.dispose();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(probeSignal?.aborted).toBe(true);
    controller.handleImageLoad(snapshot!);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(controller.requestUrl).toBe("/asset.png");
  });
});
