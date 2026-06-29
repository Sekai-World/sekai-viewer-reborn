import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  buildMusicListFilterMeta,
  createMusicListPage,
  fetchMusicCatalog,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} from "$lib/server/music-list";
import { fetchUnitProfiles, toUnitProfileMap } from "$lib/server/unit-profiles";
import type { PageServerLoad } from "./$types";

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

  // filterMeta and unitProfiles are needed for filter rendering even before data loads,
  // but we can stream them too for faster first-paint if desired.
  // For now, keep them synchronous since they're needed for the filter dialog structure.
  const baseUrl = getMasterApiBaseUrl();
  const [unitProfiles, filterMeta] = await Promise.all([
    fetchUnitProfiles(baseUrl, region).then(toUnitProfileMap),
    fetchMusicCatalog(
      baseUrl,
      region,
      queryState.spoiler,
      queryState.hasAppend,
      queryState.tags,
      queryState.level
    ).then((catalog) => buildMusicListFilterMeta(catalog))
  ]);

  const initialPage: Promise<
    | { page: ReturnType<typeof createMusicListPage>; loadFailed: false }
    | { page: ReturnType<typeof createMusicListPage>; loadFailed: true }
  > = fetchMusicCatalog(
    baseUrl,
    region,
    queryState.spoiler,
    queryState.hasAppend,
    queryState.tags,
    queryState.level
  )
    .then((catalog) => {
      const page = createMusicListPage(catalog, queryState, 1);

      logMusicListFilterDebug("initial response", {
        region,
        queryState,
        hasFilters,
        catalogItemCount: catalog.length,
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
    filterMeta,
    unitProfiles
  };
};
