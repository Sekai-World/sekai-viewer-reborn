// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveChibiModelDescriptor, type ChibiModelDescriptor } from "#lib/chibi/chibi-model.js";
import {
  ChibiAssetLoadError,
  type ChibiModelResource,
  type ChibiPlayer
} from "#lib/chibi/chibi-player.js";
import { getLocalI18nMessages, mediaLabI18nNamespaces } from "#lib/i18n/runtime.js";

type Load = ChibiPlayer["load"];
const player = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock("#lib/chibi/chibi-spine-runtime.js", () => ({ createChibiRuntimeFacade: () => ({}) }));
vi.mock("#lib/chibi/chibi-player.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("#lib/chibi/chibi-player.js")>()),
  createChibiPlayer: () => player
}));

import Page from "./+page.svelte";

const describeModel = (modelName: string): ChibiModelDescriptor => {
  const resolved = resolveChibiModelDescriptor(modelName);
  if (resolved.status !== "ok") throw new Error(resolved.reason);
  return resolved.descriptor;
};

const createResource = (descriptor: ChibiModelDescriptor, animations: readonly string[]) =>
  ({
    descriptor,
    animations,
    setAnimation: vi.fn(() => true),
    resize: vi.fn(),
    destroy: vi.fn()
  }) satisfies ChibiModelResource;

const deferredLoad = () => {
  const calls: {
    descriptor: ChibiModelDescriptor;
    signal: AbortSignal;
    resolve: (resource: ChibiModelResource) => void;
    reject: (cause: unknown) => void;
  }[] = [];
  player.load.mockImplementation(
    ((descriptor, _host, signal) =>
      new Promise<ChibiModelResource>((resolve, reject) => {
        calls.push({ descriptor, signal, resolve, reject });
      })) satisfies Load
  );
  return calls;
};

const pageData = (modelName: string) => ({
  descriptor: describeModel(modelName),
  uiLocale: "en",
  i18nMessages: getLocalI18nMessages(mediaLabI18nNamespaces)
});
const renderPage = (modelName = "sd_01ichika_normal") =>
  render(Page, { props: { data: pageData(modelName) as never } });
const status = () => screen.getByTestId("chibi-viewer-status").dataset.status;

describe("Chibi viewer page", () => {
  beforeEach(() => {
    player.load.mockReset();
  });
  afterEach(cleanup);

  it("plays the default pose once the model is ready", async () => {
    const calls = deferredLoad();
    renderPage();
    expect(status()).toBe("loading");

    const resource = createResource(calls[0].descriptor, ["m_walk", "m_pose_default"]);
    calls[0].resolve(resource);

    await waitFor(() => expect(status()).toBe("ready"));
    expect(resource.setAnimation).toHaveBeenCalledExactlyOnceWith("m_pose_default");
    expect(
      screen.getByRole("button", { name: "m_pose_default" }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  it("switches the animation from the picker", async () => {
    const calls = deferredLoad();
    renderPage();
    const resource = createResource(calls[0].descriptor, ["m_pose_default", "m_walk"]);
    calls[0].resolve(resource);
    await waitFor(() => expect(status()).toBe("ready"));

    await fireEvent.click(screen.getByRole("button", { name: "m_walk" }));

    expect(resource.setAnimation).toHaveBeenLastCalledWith("m_walk");
    expect(screen.getByRole("button", { name: "m_walk" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
  });

  it("reports a model without an atlas as not available", async () => {
    const calls = deferredLoad();
    renderPage();

    calls[0].reject(new ChibiAssetLoadError("atlas", 404));

    await waitFor(() => expect(status()).toBe("unavailable"));
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it.each([
    ["a missing family skeleton", new ChibiAssetLoadError("skeleton", 404)],
    ["an atlas the host refuses", new ChibiAssetLoadError("atlas", 403)],
    ["any other failure", new Error("boom")]
  ])("treats %s as a retryable error", async (_label, cause) => {
    const calls = deferredLoad();
    renderPage();

    calls[0].reject(cause);
    await waitFor(() => expect(status()).toBe("error"));
    await fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(status()).toBe("loading");
  });

  it("reports an error when the loaded model cannot start its animation", async () => {
    const calls = deferredLoad();
    renderPage();
    const resource = createResource(calls[0].descriptor, ["m_pose_default"]);
    resource.setAnimation.mockImplementation(() => {
      throw new Error("bad animation");
    });

    calls[0].resolve(resource);

    await waitFor(() => expect(status()).toBe("error"));
  });

  it("aborts the old load and destroys its late result when the model changes", async () => {
    const calls = deferredLoad();
    const view = renderPage("sd_01ichika_normal");

    await view.rerender({ data: pageData("sd_mob001") as never });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].signal.aborted).toBe(true);
    expect(calls[1].descriptor.modelName).toBe("sd_mob001");

    const stale = createResource(calls[0].descriptor, ["m_pose_default"]);
    calls[0].resolve(stale);
    await waitFor(() => expect(stale.destroy).toHaveBeenCalledOnce());
    expect(status()).toBe("loading");
  });

  it("destroys the model when the page goes away", async () => {
    const calls = deferredLoad();
    const view = renderPage();
    const resource = createResource(calls[0].descriptor, ["m_pose_default"]);
    calls[0].resolve(resource);
    await waitFor(() => expect(status()).toBe("ready"));

    view.unmount();

    expect(calls[0].signal.aborted).toBe(true);
    expect(resource.destroy).toHaveBeenCalledOnce();
  });
});
