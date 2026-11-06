import type { SharedComicResponse } from "@platform/sekai-master-api-sdk";

export type ComicItem = SharedComicResponse;

/** The comics whose title contains the search text, ignoring case. */
export const filterComicsByTitle = (
  comics: readonly ComicItem[],
  name: string
): readonly ComicItem[] => {
  const search = name.trim().toLowerCase();
  if (search === "") return comics;
  return comics.filter((comic) => comic.title?.toLowerCase().includes(search));
};
