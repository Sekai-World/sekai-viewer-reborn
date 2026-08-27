import { fetchGlobalNotices } from "$lib/server/notifications";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ fetch }) => ({
  globalNotices: await fetchGlobalNotices(fetch)
});