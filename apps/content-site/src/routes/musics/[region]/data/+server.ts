import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  canUsePaginatedMusicList,
  createMusicListPage,
  fetchMusicCatalog,
  fetchMusicListPage,
  hasMusicListFilters,
  logMusicListFilterDebug,
  parseMusicListQueryState
} from "$lib/server/music-list";
import type { RequestHandler } from "./$types";

const parsePageNumber = (value: string | null): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

export const GET: RequestHandler = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const page = parsePageNumber(url.searchParams.get("page"));
  const queryState = parseMusicListQueryState(url.searchParams);
  const hasFilters = hasMusicListFilters(queryState);

  logMusicListFilterDebug("data request", {
    region,
    page,
    queryState,
    hasFilters,
    includeSpoilerContent: queryState.spoiler
  });

  try {
    const startedAt = performance.now();
    const baseUrl = getMasterApiBaseUrl();
    const usePaginatedList = canUsePaginatedMusicList(queryState);
    let musicListPage: ReturnType<typeof createMusicListPage>;
    let catalogItemCount: number | null = null;

    if (usePaginatedList) {
      musicListPage = await fetchMusicListPage(baseUrl, region, queryState, page);
    } else {
      const catalog = await fetchMusicCatalog(
        baseUrl,
        region,
        queryState.spoiler,
        queryState.hasAppend,
        queryState.categories,
        queryState.tags,
        queryState.level
      );
      catalogItemCount = catalog.length;
      musicListPage = createMusicListPage(catalog, queryState, page);
    }

    logMusicListFilterDebug("data response", {
      region,
      page,
      queryState,
      hasFilters,
      durationMs: Math.round(performance.now() - startedAt),
      initialPageMode: usePaginatedList ? "paginated" : "catalog",
      catalogItemCount,
      itemCount: musicListPage.items.length,
      itemIds: musicListPage.items.map((item) => item.id),
      pagination: musicListPage.pagination
    });

    return json(musicListPage);
  } catch (error) {
    logMusicListFilterDebug("data exception", {
      region,
      page,
      queryState,
      hasFilters,
      error
    });
    return json({ error: true }, { status: 500 });
  }
};
