import { resolveLive2dCatalogRouteData } from "$lib/live2d/catalog-route-data";
import type { PageServerLoad } from "./$types";

export const createLive2dCatalogPageLoad = (
  resolveCatalog: typeof resolveLive2dCatalogRouteData = resolveLive2dCatalogRouteData
): PageServerLoad =>
  async ({ fetch }) => ({
    track: "live2d" as const,
    catalog: await resolveCatalog(fetch)
  });

export const load: PageServerLoad = createLive2dCatalogPageLoad();
