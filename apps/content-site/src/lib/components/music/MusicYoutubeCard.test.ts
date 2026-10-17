import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseMusicDetail } from "$lib/server/music-detail";
import MusicYoutubeCard from "./MusicYoutubeCard.svelte";

const originals = [
  { id: "1", musicId: "8", videoLink: "https://youtu.be/EgOWe9ByNaE" },
  { id: "2", musicId: "8", videoLink: "https://youtu.be/XogSflwXgpw" }
];
const props = {
  originals,
  songKey: "jp:8",
  songTitle: "Song",
  heading: "YouTube",
  openLabel: "Open on YouTube",
  loadLabel: "Load video here",
  privacyLabel: "Loading connects to YouTube. Open externally if unavailable.",
  selectionLabel: "Video reference",
  referenceLabel: "Video",
  closeLabel: "Close"
};
const iframe = (): HTMLIFrameElement | null => document.querySelector("iframe");
const load = () => fireEvent.click(screen.getByRole("button", { name: props.loadLabel }));

afterEach(cleanup);

describe("MusicYoutubeCard", () => {
  it("makes no embed, thumbnail, or fetch before explicit consent and keeps a safe external link", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { container } = render(MusicYoutubeCard, props);
    expect(iframe()).toBeNull();
    expect(container.querySelector("img, link, video, audio")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    const link = screen.getByRole("link", { name: props.openLabel });
    expect(link.getAttribute("href")).toBe("https://www.youtube.com/watch?v=EgOWe9ByNaE");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    fetchSpy.mockRestore();
  });

  it("loads only the exact nocookie URL, with no autoplay promise, and closes to stop", async () => {
    const onEmbedOpen = vi.fn();
    render(MusicYoutubeCard, { ...props, onEmbedOpen });
    await load();
    expect(onEmbedOpen).toHaveBeenCalledOnce();
    expect(iframe()?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/EgOWe9ByNaE"
    );
    expect(iframe()?.getAttribute("title")).toBe("Song — YouTube");
    expect(iframe()?.hasAttribute("allowfullscreen")).toBe(true);
    expect(iframe()?.getAttribute("allow")).not.toContain("autoplay");
    expect(iframe()?.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(screen.getByRole("link", { name: props.openLabel })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(iframe()).toBeNull();
    await load();
    expect(iframe()).not.toBeNull();
  });

  it("uses one panel and unloads on selection change until clicked again", async () => {
    const { container } = render(MusicYoutubeCard, props);
    expect(container.querySelectorAll("article")).toHaveLength(1);
    await load();
    await fireEvent.change(screen.getByRole("combobox", { name: props.selectionLabel }), {
      target: { value: "XogSflwXgpw" }
    });
    expect(iframe()).toBeNull();
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "https://www.youtube.com/watch?v=XogSflwXgpw"
    );
    await load();
    expect(iframe()?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/XogSflwXgpw"
    );
  });

  it("unloads when a native player starts, the song changes, or references change", async () => {
    const { rerender } = render(MusicYoutubeCard, props);
    await load();
    await rerender({ ...props, unloadToken: 1 });
    expect(iframe()).toBeNull();
    await load();
    await rerender({ ...props, unloadToken: 1, songKey: "jp:18" });
    expect(iframe()).toBeNull();
    await load();
    await rerender({ ...props, unloadToken: 1, songKey: "jp:18", originals: [originals[1]] });
    expect(iframe()).toBeNull();
  });

  it.each([
    { records: [] },
    { records: [{ ...originals[0], videoLink: "https://evil.test/embed/EgOWe9ByNaE" }] },
    { records: [{ ...originals[0], videoLink: "https://nicovideo.jp/watch/sm123" }] }
  ])("hides absent or non-YouTube references", ({ records }) => {
    const { container } = render(MusicYoutubeCard, { ...props, originals: records });
    expect(container.querySelector("article")).toBeNull();
  });

  it("shows the panel for parsed song data with no native MV", () => {
    const detail = parseMusicDetail({
      music: { id: "8", title: "Song" },
      musicOriginals: [originals[0]]
    })!;
    expect(detail.musicVideos).toEqual([]);
    render(MusicYoutubeCard, { ...props, originals: detail.musicOriginals ?? [] });
    expect(screen.getByRole("heading", { name: "YouTube" })).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
  });
});
