import { normalizeRegion } from "$lib/i18n/region";
import { loadGameNews } from "$lib/server/game-news";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params }) => {
  const region = normalizeRegion(params.region);
  return { region, news: await loadGameNews(region) };
};
