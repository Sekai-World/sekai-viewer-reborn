import { loadMusicRecommenderPageData } from "$lib/server/music-recommender";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = ({ fetch, url }) =>
  loadMusicRecommenderPageData(url.searchParams, fetch);
