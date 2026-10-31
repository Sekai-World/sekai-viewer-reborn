// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Live2DMediaLoadError } from "@platform/live2d-story-player";
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
  restart: "Restart",
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
  loadFailedMediaMissing: "Missing in region",
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
    restart: vi.fn(async () => {}),
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

  it("restarts from the first line through the Restart button", async () => {
    renderHost({ autoStart: true });
    await waitFor(() => expect(sessions).toHaveLength(1));
    // The host re-reads canGoBack when the session state changes.
    sessions[0].canGoBack = true;
    sessions[0].emit("playing");
    sessions[0].emit("ready");

    const restart = await screen.findByRole("button", { name: labels.restart });
    await waitFor(() => expect((restart as HTMLButtonElement).disabled).toBe(false));
    await fireEvent.click(restart);

    expect(sessions[0].restart).toHaveBeenCalledOnce();
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

  it("shows a retryable failure for an unexplained load error", async () => {
    loadStoryDocument.mockRejectedValue(new Error("scenario broke"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("error"));

    expect(screen.getByRole("alert").textContent).toContain(labels.loadFailed);
    expect(screen.getByRole("button", { name: labels.retry })).toBeTruthy();
  });

  it("names a media file the region lacks and withdraws the pointless retry", async () => {
    const mediaError = new Live2DMediaLoadError("sound", "https://assets.example/voice.mp3");
    loadStoryDocument.mockRejectedValue(mediaError);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response(null, { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("error"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(labels.loadFailedMediaMissing)
    );
    expect(screen.queryByRole("button", { name: labels.retry })).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith("https://assets.example/voice.mp3", { method: "HEAD" });
  });

  it("keeps the retry for a media failure the asset host does not confirm as missing", async () => {
    loadStoryDocument.mockRejectedValue(
      new Live2DMediaLoadError("image", "https://assets.example/bg.webp")
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("error"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await fetchMock.mock.results[0].value;
    await Promise.resolve();

    expect(screen.getByRole("alert").textContent).toContain(labels.loadFailed);
    expect(screen.getByRole("button", { name: labels.retry })).toBeTruthy();
  });

  it("ignores a probe result that arrives after the user retried", async () => {
    let resolveProbe!: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveProbe = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
    loadStoryDocument.mockRejectedValueOnce(
      new Live2DMediaLoadError("sound", "https://assets.example/voice.mp3")
    );
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("error"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    loadStoryDocument.mockRejectedValueOnce(new Error("scenario broke"));
    await fireEvent.click(screen.getByRole("button", { name: labels.retry }));
    await waitFor(() => expect(loadStoryDocument).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(phaseOf(container)).toBe("error"));

    resolveProbe(new Response(null, { status: 404 }));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByRole("alert").textContent).toContain(labels.loadFailed);
    expect(screen.getByRole("alert").textContent).not.toContain(labels.loadFailedMediaMissing);
    expect(screen.getByRole("button", { name: labels.retry })).toBeTruthy();
  });

  it("forwards the three volume sliders to the session", async () => {
    const { container } = renderHost({ autoStart: true });
    await waitFor(() => expect(phaseOf(container)).toBe("ready"));

    const slider = (label: string) =>
      screen.getByText(label).closest("label")!.querySelector("input") as HTMLInputElement;
    await fireEvent.input(slider(labels.voiceVolume), { target: { value: "0.3" } });
    await fireEvent.input(slider(labels.bgmVolume), { target: { value: "0.6" } });
    await fireEvent.input(slider(labels.seVolume), { target: { value: "0" } });

    expect(sessions[0].setVolume).toHaveBeenLastCalledWith({
      voiceVolume: 0.3,
      bgmVolume: 0.6,
      seVolume: 0
    });
  });
});
