import type { MusicOriginal } from "./music-detail";

export type MusicYoutubeReference = {
  videoId: string;
  watchUrl: string;
  embedUrl: string;
};

export function parseYoutubeReference(value: unknown): MusicYoutubeReference | null {
  // Check the raw authority too: URL normalizes explicit :443 and backslashes.
  if (
    typeof value !== "string" ||
    /[\s\\]/.test(value) ||
    !/^https:\/\/(?:youtube\.com|www\.youtube\.com|m\.youtube\.com|youtu\.be)\//i.test(value)
  )
    return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;

  let videoId: string | null = null;
  if (url.hostname === "youtu.be") {
    videoId = /^\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)?.[1] ?? null;
  } else if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1) {
      videoId = url.searchParams.get("v");
    } else {
      videoId = /^\/(?:embed|shorts)\/([A-Za-z0-9_-]{11})$/.exec(url.pathname)?.[1] ?? null;
    }
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return {
    videoId,
    watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`
  };
}

export function getMusicYoutubeReferences(originals: MusicOriginal[]): MusicYoutubeReference[] {
  const seen = new Set<string>();
  return originals.flatMap((original) => {
    const reference = parseYoutubeReference(original.videoLink);
    if (!reference || seen.has(reference.videoId)) return [];
    seen.add(reference.videoId);
    return [reference];
  });
}
