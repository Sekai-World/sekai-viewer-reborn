import { normalizeRegion } from "$lib/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  buildMusicListFilterMeta,
  createMusicListPage,
  fetchMusicCatalog,
  logMusicListDebug,
  parseMusicListQueryState
} from "$lib/server/music-list";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, url }) => {
  const region = normalizeRegion(params.region);
  const queryState = parseMusicListQueryState(url.searchParams);
  const includeSpoilerContent = url.searchParams.get("spoiler") === "true";

  try {
    const catalog = await fetchMusicCatalog(getMasterApiBaseUrl(), region, includeSpoilerContent);

    return {
      region,
      initialPage: createMusicListPage(catalog, queryState, 1),
      initialQuery: queryState,
      filterMeta: buildMusicListFilterMeta(catalog),
      initialLoadFailed: false
    };
  } catch (error) {
    logMusicListDebug("initial exception", { region, queryState, error });

    return {
      region,
      initialPage: createMusicListPage([], queryState, 1),
      initialQuery: queryState,
      filterMeta: buildMusicListFilterMeta([]),
      initialLoadFailed: true
    };
  }
};
