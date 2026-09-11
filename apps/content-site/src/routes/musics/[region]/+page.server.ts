import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  canUsePaginatedMusicList,
  createMusicListPage,
  DEFAULT_MUSIC_LIST_PAGE_SIZE,
  fetchMusicCatalog,
  fetchMusicListPage,
  getDefaultMusicListFilterMeta,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} from "$lib/server/music-list";
import type { MusicListPage } from "$lib/server/music-list";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

type InitialPageResult =
  | { page: MusicListPage; loadFailed: false }
  | { page: MusicListPage; loadFailed: true };

export const load: PageServerLoad = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const queryState = parseMusicListQueryState(url.searchParams);
  const hasFilters = hasMusicListFilters(queryState);

  logMusicListFilterDebug("initial request", {
    region,
    queryState,
    hasFilters,
    includeSpoilerContent: queryState.spoiler
  });

  const baseUrl = getMasterApiBaseUrl();
  const unitProfiles = fetchUnitProfiles(baseUrl, region)
    .then(toUnitProfileMap)
    .catch((error) => {
      logMusicListFilterDebug("unit profile exception", {
        region,
        error
      });
      return {};
    });

  const usePaginatedInitialPage = canUsePaginatedMusicList(queryState);
  const initialPage: Promise<InitialPageResult> = (usePaginatedInitialPage
    ? fetchMusicListPage(baseUrl, region, queryState, 1, DEFAULT_MUSIC_LIST_PAGE_SIZE)
    : fetchMusicCatalog(
        baseUrl,
        region,
        queryState.spoiler,
        queryState.hasAppend,
        queryState.categories,
        queryState.tags,
        queryState.level
      ).then((catalog) => createMusicListPage(catalog, queryState, 1)))
    .then((page) => {
      logMusicListFilterDebug("initial response", {
        region,
        queryState,
        hasFilters,
        initialPageMode: usePaginatedInitialPage ? "paginated" : "catalog",
        itemCount: page.items.length,
        itemIds: page.items.map((item) => item.id),
        pagination: page.pagination
      });

      return { page, loadFailed: false as const };
    })
    .catch((error) => {
      logMusicListFilterDebug("initial exception", {
        region,
        queryState,
        hasFilters,
        error
      });

      return { page: createMusicListPage([], queryState, 1), loadFailed: true as const };
    });

  // Attach noop catch to prevent unhandled rejection before SvelteKit renders
  initialPage.catch(() => {});

  return {
    region,
    initialPage,
    initialQuery: queryState,
    // Filter metadata is loaded only when the dialog opens; keep the initial
    // loader payload cheap and provide an empty, synchronous shape for typing.
    filterMeta: getDefaultMusicListFilterMeta(),
    unitProfiles: unitProfiles as unknown as ReturnType<typeof toUnitProfileMap>
  };
};
