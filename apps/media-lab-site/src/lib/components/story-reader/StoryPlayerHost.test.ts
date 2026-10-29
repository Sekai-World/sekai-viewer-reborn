// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StoryDocumentReference } from "#lib/live2d/story-document.js";
import StoryPlayerHost from "./StoryPlayerHost.svelte";

const { createStoryPlayerSession, loadStoryDocument } = vi.hoisted(() => ({
  createStoryPlayerSession: vi.fn(),
  loadStoryDocument: vi.fn()
}));

vi.mock("#lib/story/story-document-loader.js", () => ({ loadStoryDocument }));
vi.mock("#lib/story/story-player-session.js", () => ({ createStoryPlayerSession }));

const labels = {
  tapToLoad: "Click to load",
  tapToPlay: "Click to start",
  tapToContinue: "Click to continue",
  rotateToPlay: "Rotate",
  previous: "Previous",
  next: "Next",
  autoplay: "Autoplay",
  fullscreen: "Fullscreen",
  textAnimation: "Text animation",
  voiceVolume: "Voice",
  bgmVolume: "BGM",
  seVolume: "SE",
  loading: "Loading",
  loadFailed: "Failed",
  retry: "Retry",
  reload: "Reload story",
  statusPlaying: "Playing",
  statusFinished: "Story finished",
  cancel: "Cancel",
  warnings: "Warnings",
  phaseAssets: "Assets",
  phaseModels: "Models",
  phaseModelFiles: "Model files",
  phaseMotions: "Motions",
  phaseStage: "Stage"
};

type Listener = (snapshot: { state: string }) => void;

const createFakeSession = () => {
  let listener: Listener | null = null;
  const session = {
    state: "loading",
    error: null,
    canGoBack: false,
    subscribe: vi.fn((next: Listener) => {
      listener = next;
      return () => {
        listener = null;
      };
    }),
    load: vi.fn(async () => {
      session.state = "ready";
      listener?.({ state: "ready" });
    }),
    retry: vi.fn(async () => {}),
    nextStep: vi.fn(async () => {}),
    prevStep: vi.fn(async () => {}),
    abort: vi.fn(),
    setAutoplay: vi.fn(),
    setVolume: vi.fn(),
    setTextAnimation: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
    emit: (state: string) => {
      session.state = state;
      listener?.({ state });
    }
  };
  return session;
};

let sessions: ReturnType<typeof createFakeSession>[] = [];

const renderHost = (props: { autoStart?: boolean; onReload?: () => void } = {}) =>
  render(StoryPlayerHost, {
    documentReference: {} as StoryDocumentReference,
    labels,
    ...props
  });

const phaseOf = (container: HTMLElement): string | null =>
  container.querySelector("[data-player-phase]")?.getAttribute("data-player-phase") ?? null;

beforeEach(() => {
  sessions = [];
  loadStoryDocument.mockResolvedValue({});
  createStoryPlayerSession.mockImplementation(() => {
    const session = createFakeSession();
    sessions.push(session);
    return session;
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  window.matchMedia = vi.fn().mockReturnValue({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {}
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StoryPlayerHost", () => {
  it("builds no player until the user asks to load", () => {
    const { container } = renderHost();

    expect(phaseOf(container)).toBe("idle");
    expect(createStoryPlayerSession).not.toHaveBeenCalled();
  });

  it("loads on the first click and reports the ready phase", async () => {
    const { container } = renderHost();

    await fireEvent.click(screen.getByRole("button", { name: labels.tapToLoad }));

    await waitFor(() => expect(phaseOf(container)).toBe("ready"));
    expect(createStoryPlayerSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("status").textContent).toBe(labels.tapToPlay);
  });

  it("starts loading on mount when autoStart is set", async () => {
    const { container } = renderHost({ autoStart: true });

    await waitFor(() => expect(phaseOf(container)).toBe("ready"));
    expect(createStoryPlayerSession).toHaveBeenCalledTimes(1);
  });

  it("separates playing, waiting at a checkpoint, and finished", async () => {
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("ready"));

    sessions[0].emit("playing");
    await waitFor(() => expect(phaseOf(container)).toBe("playing"));
    expect(screen.getByRole("status").textContent).toBe(labels.statusPlaying);

    sessions[0].emit("ready");
    await waitFor(() => expect(phaseOf(container)).toBe("waiting"));
    expect(screen.getByRole("status").textContent).toBe(labels.tapToContinue);

    sessions[0].emit("finished");
    await waitFor(() => expect(phaseOf(container)).toBe("finished"));
    expect(screen.getByRole("status").textContent).toBe(labels.statusFinished);
  });

  it("destroys the session when the host unmounts", async () => {
    const { container, unmount } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("ready"));

    unmount();

    expect(sessions[0].destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the session when loading is cancelled", async () => {
    loadStoryDocument.mockResolvedValue({});
    createStoryPlayerSession.mockImplementation(() => {
      const session = createFakeSession();
      session.load.mockImplementation(() => new Promise<void>(() => {}));
      sessions.push(session);
      return session;
    });
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(sessions).toHaveLength(1));
    expect(phaseOf(container)).toBe("loading");

    await fireEvent.click(screen.getByRole("button", { name: labels.cancel }));

    expect(sessions[0].destroy).toHaveBeenCalledTimes(1);
    expect(phaseOf(container)).toBe("idle");
  });

  it("creates no session when loading is cancelled while the document loads", async () => {
    let resolveDocument: (value: object) => void = () => {};
    loadStoryDocument.mockReturnValue(
      new Promise((resolve) => {
        resolveDocument = resolve;
      })
    );
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("loading"));

    await fireEvent.click(screen.getByRole("button", { name: labels.cancel }));
    resolveDocument({});
    await Promise.resolve();

    expect(createStoryPlayerSession).not.toHaveBeenCalled();
    expect(phaseOf(container)).toBe("idle");
  });

  it("offers a reload action only when the page provides one", async () => {
    const onReload = vi.fn();
    const { container, unmount } = renderHost({ autoStart: true, onReload });
    await waitFor(() => expect(phaseOf(container)).toBe("ready"));

    await fireEvent.click(screen.getByRole("button", { name: labels.reload }));
    expect(onReload).toHaveBeenCalledTimes(1);

    unmount();
    const withoutReload = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(withoutReload.container)).toBe("ready"));
    expect(screen.queryByRole("button", { name: labels.reload })).toBeNull();
  });
});
