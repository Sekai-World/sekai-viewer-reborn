import { normalizeRegion } from "#lib/i18n/region.js";
import { getMasterApiBaseUrl } from "#lib/server/config.js";
import {
  buildMusicListFilterMeta,
  fetchMusicCatalog,
  getDefaultMusicListFilterMeta,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} from "#lib/server/music-list.js";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const queryState = parseMusicListQueryState(url.searchParams);
  const hasFilters = hasMusicListFilters(queryState);

  logMusicListFilterDebug("metadata request", {
    region,
    queryState,
    hasFilters,
    includeSpoilerContent: queryState.spoiler
  });

  try {
    const startedAt = performance.now();
    const catalog = await fetchMusicCatalog(
      getMasterApiBaseUrl(),
      region,
      queryState.spoiler,
      queryState.hasAppend,
      queryState.categories,
      queryState.tags,
      queryState.level
    );
    const filterMeta = buildMusicListFilterMeta(catalog);

    logMusicListFilterDebug("metadata response", {
      region,
      queryState,
      hasFilters,
      durationMs: Math.round(performance.now() - startedAt),
      catalogItemCount: catalog.length
    });

    return Response.json({ filterMeta, loadFailed: false as const });
  } catch (error) {
    logMusicListFilterDebug("metadata exception", {
      region,
      queryState,
      hasFilters,
      error
    });

    return Response.json(
      { filterMeta: getDefaultMusicListFilterMeta(), loadFailed: true as const },
      { status: 500 }
    );
  }
};
