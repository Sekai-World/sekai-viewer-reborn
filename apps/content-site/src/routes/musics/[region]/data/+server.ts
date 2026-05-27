import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import {
  createMusicListPage,
  fetchMusicCatalog,
  logMusicListDebug,
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
  const includeSpoilerContent = url.searchParams.get("spoiler") === "true";

  try {
    const catalog = await fetchMusicCatalog(getMasterApiBaseUrl(), region, includeSpoilerContent);
    return json(createMusicListPage(catalog, queryState, page));
  } catch (error) {
    logMusicListDebug("data exception", { region, page, queryState, error });
    return json({ error: true }, { status: 500 });
  }
};
