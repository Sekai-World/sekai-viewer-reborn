import { fetchGlobalNotices } from "#lib/server/notifications.js";
import packageJson from "../../package.json";
import type { LayoutServerLoad } from "./$types";

export const load: LayoutServerLoad = async ({ fetch }) => ({
  globalNotices: await fetchGlobalNotices(fetch),
  siteVersion: packageJson.version
});
