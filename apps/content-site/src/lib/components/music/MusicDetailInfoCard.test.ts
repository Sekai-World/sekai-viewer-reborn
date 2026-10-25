import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import MusicDetailInfoCard from "./MusicDetailInfoCard.svelte";

const originals = [{ id: "1", musicId: "8", videoLink: "https://youtu.be/EgOWe9ByNaE" }];

const props = {
  music: {
    id: "8",
    title: "Song",
    assetBundleName: null,
    categories: [],
    composer: null,
    arranger: null,
    lyricist: null,
    publishedAt: null,
    creatorArtist: null,
    liveStage: null,
    releaseCondition: null,
    difficulties: [],
    vocals: [],
    fillerSec: null,
    tags: [],
    musicVideos: [],
    musicOriginals: originals
  },
  displayLocale: "en-US",
  region: "jp",
  title: "Song Info",
  idLabel: "ID: ",
  internalResourceCodeLabel: "Resource code",
  nameLabel: "Name",
  composerLabel: "Composer",
  arrangerLabel: "Arranger",
  lyricistLabel: "Lyricist",
  categoryLabel: "MV Type",
  tagLabel: "Tags",
  publishedAtLabel: "Release date",
  getCategoryLabel: (value: string) => value,
  getTagLabel: (value: string) => value,
  videoLinks: {
    originals,
    songKey: "jp:8",
    songTitle: "Song",
    heading: "Video links",
    openLabel: "Open video source",
    previewLabel: "Preview video",
    selectionLabel: "Video source",
    closeLabel: "Close"
  }
};

afterEach(cleanup);

describe("MusicDetailInfoCard video links", () => {
  it("keeps one generic video-links row inside Song Info", async () => {
    const { container } = render(MusicDetailInfoCard, props);

    expect(container.querySelectorAll(".card")).toHaveLength(1);
    const label = screen.getByText("Video links");
    expect(label.tagName).toBe("DT");
    const entry = label.parentElement!;
    const row = entry.querySelector("dd")!;
    expect(entry.tagName).toBe("DIV");
    expect(entry.classList.contains("content-card-inset")).toBe(true);
    expect(row.classList.contains("mt-2")).toBe(true);
    expect(entry.closest("dl")).toBeTruthy();
    expect(entry.querySelectorAll("dt")).toHaveLength(1);
    expect(entry.querySelectorAll("dd")).toHaveLength(1);
    expect(entry.querySelector("dd a")).toBeTruthy();
    expect(entry.querySelector("dd button")).toBeTruthy();
    expect(container.querySelectorAll(".content-card-inset")).toHaveLength(3);
    expect(screen.queryByText(/connects to/i)).toBeNull();
    expect(screen.getByRole("link", { name: /Open video source/ }).getAttribute("href")).toBe(
      "https://www.youtube.com/watch?v=EgOWe9ByNaE"
    );

    await fireEvent.click(screen.getByRole("button", { name: /Preview video/ }));
    expect(screen.getByTitle("Song — YouTube").getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/EgOWe9ByNaE"
    );
    expect(entry.querySelector("dd iframe")).toBeTruthy();
  });

  it("retains multiple sources in the same row and unloads preview on change", async () => {
    const onEmbedOpen = vi.fn();
    const videoLinks = {
      ...props.videoLinks,
      onEmbedOpen,
      originals: [
        originals[0]!,
        { id: "2", musicId: "8", videoLink: "https://nicovideo.jp/watch/sm123" }
      ]
    };
    const { rerender } = render(MusicDetailInfoCard, { ...props, videoLinks });
    const entry = screen.getByText("Video links").parentElement!;
    const selector = screen.getByRole("combobox", { name: "Video source" });
    await fireEvent.click(screen.getByRole("button", { name: /Preview video/ }));
    expect(onEmbedOpen).toHaveBeenCalledOnce();
    await fireEvent.change(selector, { target: { value: "https://nicovideo.jp/watch/sm123" } });
    expect(entry.querySelector("iframe")).toBeNull();
    expect(screen.queryByRole("button", { name: /Preview video/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Open video source/ }).getAttribute("href")).toBe(
      "https://nicovideo.jp/watch/sm123"
    );
    await rerender({ ...props, videoLinks: { ...videoLinks, unloadToken: 1 } });
    expect(entry.querySelector("iframe")).toBeNull();
  });

  it("hides the row when no valid HTTPS video source is available", () => {
    render(MusicDetailInfoCard, {
      ...props,
      videoLinks: {
        ...props.videoLinks,
        originals: [{ ...originals[0], videoLink: "http://evil.test/watch/8" }]
      }
    });
    expect(screen.queryByText("Video links")).toBeNull();
  });

  it("keeps video links alongside all song metadata", () => {
    render(MusicDetailInfoCard, {
      ...props,
      music: {
        ...props.music,
        composer: "Composer name",
        arranger: "Arranger name",
        lyricist: "Lyricist name",
        assetBundleName: "0008",
        publishedAt: 1700000000000,
        categories: ["mv_2d"],
        tags: ["light_music_club", "other"]
      }
    });
    for (const label of [
      "Name",
      "Composer",
      "Arranger",
      "Lyricist",
      "MV Type",
      "Tags",
      "Release date",
      "Resource code",
      "Video links"
    ]) {
      expect(screen.getByText(label).tagName).toBe("DT");
    }
    expect(screen.getByRole("link", { name: "light_music_club" }).getAttribute("href")).toMatch(
      /^\/unit\/jp\//
    );
    expect(screen.getByText("0008")).toBeTruthy();
  });

  it("omits the data entry when video-links props are absent", () => {
    const { container } = render(MusicDetailInfoCard, { ...props, videoLinks: undefined });
    expect(screen.queryByText("Video links")).toBeNull();
    expect(container.querySelectorAll(".card")).toHaveLength(1);
  });
});
