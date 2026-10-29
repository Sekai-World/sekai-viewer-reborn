import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMusicDetail } from "#lib/server/music-detail.js";
import MusicYoutubeCard from "./MusicYoutubeCard.svelte";
import "#lib/icons/mdi.js";

const youtubeOriginal = { id: "1", musicId: "8", videoLink: "https://youtu.be/EgOWe9ByNaE" };
const secondYoutubeOriginal = {
  id: "2",
  musicId: "8",
  videoLink: "https://youtu.be/XogSflwXgpw"
};
const props = {
  originals: [youtubeOriginal, secondYoutubeOriginal],
  songKey: "jp:8",
  songTitle: "Song",
  openLabel: "Open video source",
  previewLabel: "Preview video",
  selectionLabel: "Video source",
  closeLabel: "Close"
};
const iframe = (): HTMLIFrameElement | null => document.querySelector("iframe");
const externalAction = () => screen.getByRole("link", { name: /Open video source/ });
const previewAction = () => screen.getByRole("button", { name: /Preview video/ });

afterEach(cleanup);

describe("MusicYoutubeCard", () => {
  it("renders one compact source row without explanatory text", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(MusicYoutubeCard, props);

    expect(iframe()).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(container.querySelector("article, section, p")).toBeNull();
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(externalAction().getAttribute("href")).toBe(
      "https://www.youtube.com/watch?v=EgOWe9ByNaE"
    );
    expect(externalAction().getAttribute("target")).toBe("_blank");
    expect(externalAction().getAttribute("rel")).toBe("noopener noreferrer");
    expect(externalAction().textContent).toBe("");
    expect(previewAction().textContent).toBe("");
    for (const action of [externalAction(), previewAction()]) {
      expect(action.querySelector("svg[aria-hidden='true']")).toBeTruthy();
      expect(action.classList.contains("min-h-11")).toBe(true);
      expect(action.classList.contains("min-w-11")).toBe(true);
    }
    fetchSpy.mockRestore();
  });

  it("opens a native YouTube preview dialog only on click and removes the iframe on close", async () => {
    const onEmbedOpen = vi.fn();
    render(MusicYoutubeCard, { ...props, onEmbedOpen });
    await fireEvent.click(previewAction());
    expect(onEmbedOpen).toHaveBeenCalledOnce();
    const dialog = screen.getByRole("dialog");
    expect(iframe()?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/EgOWe9ByNaE"
    );
    expect(iframe()?.getAttribute("title")).toBe("Song — YouTube");
    expect(iframe()?.hasAttribute("allowfullscreen")).toBe(true);
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(iframe()).toBeNull();
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("closes on backdrop or native Escape cancellation", async () => {
    render(MusicYoutubeCard, props);
    await fireEvent.click(previewAction());
    const dialog = screen.getByRole("dialog");
    await fireEvent.click(dialog.querySelector(".modal-box")!);
    expect(iframe()).not.toBeNull();
    await fireEvent.click(dialog);
    expect(iframe()).toBeNull();

    await fireEvent.click(previewAction());
    await fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(iframe()).toBeNull();
  });

  it("removes the iframe on native close and component unmount", async () => {
    const { unmount } = render(MusicYoutubeCard, props);
    await fireEvent.click(previewAction());
    const dialog = screen.getByRole("dialog");
    dialog.removeAttribute("open");
    await fireEvent(dialog, new Event("close"));
    expect(iframe()).toBeNull();
    await fireEvent.click(previewAction());
    unmount();
    expect(iframe()).toBeNull();
    expect(document.querySelector("dialog")).toBeNull();
  });

  it("uses native showModal and close when available", async () => {
    const { container } = render(MusicYoutubeCard, props);
    const dialog = container.querySelector("dialog")!;
    const showModal = vi.fn(() => dialog.setAttribute("open", ""));
    const close = vi.fn(() => {
      dialog.removeAttribute("open");
      dialog.dispatchEvent(new Event("close"));
    });
    dialog.showModal = showModal;
    dialog.close = close;
    await fireEvent.click(previewAction());
    expect(showModal).toHaveBeenCalledOnce();
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(close).toHaveBeenCalledOnce();
    expect(iframe()).toBeNull();
  });

  it("switches multiple sources in one row and unloads the preview", async () => {
    const { rerender } = render(MusicYoutubeCard, props);
    await fireEvent.click(previewAction());
    const selector = screen.getByRole("combobox", { name: "Video source" });
    await fireEvent.change(selector, { target: { value: "XogSflwXgpw" } });
    expect(iframe()).toBeNull();
    expect(externalAction().getAttribute("href")).toBe(
      "https://www.youtube.com/watch?v=XogSflwXgpw"
    );
    await fireEvent.click(previewAction());
    expect(iframe()?.getAttribute("src")).toContain("XogSflwXgpw");
    await rerender({ ...props, unloadToken: 1 });
    expect(iframe()).toBeNull();
  });

  it("retains NicoNico and other HTTPS sources without a misleading preview action", async () => {
    render(MusicYoutubeCard, {
      ...props,
      originals: [
        { ...youtubeOriginal, videoLink: "https://nicovideo.jp/watch/sm123" },
        { ...secondYoutubeOriginal, videoLink: "https://video.example.test/watch/8" }
      ]
    });
    expect(screen.getByRole("combobox", { name: "Video source" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Preview video/ })).toBeNull();
    expect(externalAction().getAttribute("href")).toBe("https://nicovideo.jp/watch/sm123");
    expect(screen.queryByRole("dialog")).toBeNull();
    await fireEvent.change(screen.getByRole("combobox", { name: "Video source" }), {
      target: { value: "https://video.example.test/watch/8" }
    });
    expect(externalAction().getAttribute("href")).toBe("https://video.example.test/watch/8");
    expect(screen.queryByRole("button", { name: /Preview video/ })).toBeNull();
  });

  it("hides absent or invalid HTTPS references", () => {
    const { container } = render(MusicYoutubeCard, {
      ...props,
      originals: [{ ...youtubeOriginal, videoLink: "http://evil.test/watch/8" }]
    });
    expect(container.firstElementChild).toBeNull();
  });

  it("renders parsed song data with a generic source label", () => {
    const detail = parseMusicDetail({
      music: { id: "8", title: "Song" },
      musicOriginals: [youtubeOriginal]
    })!;
    expect(detail.musicVideos).toEqual([]);
    render(MusicYoutubeCard, { ...props, originals: detail.musicOriginals ?? [] });
    expect(screen.getByText("YouTube")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
