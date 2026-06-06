import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createMusicListPage,
  fetchMusicCatalog,
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
    const catalog = await fetchMusicCatalog(
      getMasterApiBaseUrl(),
      region,
      queryState.spoiler,
      queryState.hasAppend
    );
    const musicListPage = createMusicListPage(catalog, queryState, page);

    logMusicListFilterDebug("data response", {
      region,
      page,
      queryState,
      hasFilters,
      durationMs: Math.round(performance.now() - startedAt),
      catalogItemCount: catalog.length,
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
