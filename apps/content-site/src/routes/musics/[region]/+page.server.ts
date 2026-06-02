import { normalizeRegion } from "$lib/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  buildMusicListFilterMeta,
  createMusicListPage,
  fetchMusicCatalog,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} from "$lib/server/music-list";
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

  try {
    const startedAt = performance.now();
    const catalog = await fetchMusicCatalog(getMasterApiBaseUrl(), region, queryState.spoiler);
    const initialPage = createMusicListPage(catalog, queryState, 1);
    const filterMeta = buildMusicListFilterMeta(catalog);

    logMusicListFilterDebug("initial response", {
      region,
      queryState,
      hasFilters,
      durationMs: Math.round(performance.now() - startedAt),
      catalogItemCount: catalog.length,
      itemCount: initialPage.items.length,
      itemIds: initialPage.items.map((item) => item.id),
      pagination: initialPage.pagination
    });

    return {
      region,
      initialPage,
      initialQuery: queryState,
      filterMeta,
      initialLoadFailed: false
    };
  } catch (error) {
    logMusicListFilterDebug("initial exception", {
      region,
      queryState,
      hasFilters,
      error
    });

    return {
      region,
      initialPage: createMusicListPage([], queryState, 1),
      initialQuery: queryState,
      filterMeta: buildMusicListFilterMeta([]),
      initialLoadFailed: true
    };
  }
};
