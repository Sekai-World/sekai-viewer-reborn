import { getComicsByRegionList } from "@platform/sekai-master-api-sdk";
import type { ComicItem } from "#lib/domain/comic.js";
import { getMasterApiV1BaseUrl } from "./catalogue-data";

// Each region has at most a few dozen comics; one page holds them all.
const COMIC_PAGE_SIZE = 100;
const MAX_COMIC_PAGES = 5;

/** Every comic the region's master data lists, in the API's ID order. */
export const fetchComics = async (baseUrl: string, region: string): Promise<ComicItem[]> => {
  const comics: ComicItem[] = [];
  for (let page = 1; page <= MAX_COMIC_PAGES; page += 1) {
    const response = await getComicsByRegionList({
      baseUrl: getMasterApiV1BaseUrl(baseUrl),
      path: { region },
      query: { page, page_size: COMIC_PAGE_SIZE }
    });
    if (response.error || !response.data) {
      throw new Error("Failed to load comics.");
    }
    comics.push(...(response.data.items ?? []));
    if (!response.data.pagination?.has_next) break;
  }
  return comics;
};
