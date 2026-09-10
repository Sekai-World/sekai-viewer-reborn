import { resolveLive2dCatalogRouteData } from "$lib/live2d/catalog-route-data";
import {
  createLive2dCharacterOptions,
  resolveLive2dCharacterData
} from "$lib/server/live2d-characters";
import type { PageServerLoad } from "./$types";

export const _createLive2dCatalogPageLoad =
  (
    resolveCatalog: typeof resolveLive2dCatalogRouteData = resolveLive2dCatalogRouteData,
    resolveCharacters: typeof resolveLive2dCharacterData = resolveLive2dCharacterData
  ): PageServerLoad =>
  async ({ fetch }) => {
    const catalog = resolveCatalog(fetch);
    const characters = catalog.then(
      (catalog) => {
        if (catalog.status !== "ready") return [];

        return Promise.resolve()
          .then(() => resolveCharacters(catalog.models, fetch))
          .then(({ characters }) => characters)
          .catch(() => createLive2dCharacterOptions(catalog.models));
      },
      () => []
    );

    // Keep the original rejections available to SvelteKit's streaming error
    // handling while preventing Node's unhandled-rejection warning.
    catalog.catch(() => {});
    characters.catch(() => {});

    return { track: "live2d" as const, catalog, characters };
  };

export const load: PageServerLoad = _createLive2dCatalogPageLoad();
