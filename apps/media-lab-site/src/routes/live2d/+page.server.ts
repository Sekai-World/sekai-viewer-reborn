import {
  resolveLive2dCatalogRouteData,
  type Live2dCatalogRouteData
} from "$lib/live2d/catalog-route-data";
import {
  createLive2dCharacterOptions,
  resolveLive2dCharacterData
} from "$lib/server/live2d-characters";
import type { Live2dCharacterOption } from "$lib/server/live2d-characters";
import type { PageServerLoad } from "./$types";

type Live2dCatalogModel = Extract<Live2dCatalogRouteData, { status: "ready" }>["models"][number];
type Live2dCharacterPayload = {
  readonly models: readonly Live2dCatalogModel[];
  readonly characters: readonly Live2dCharacterOption[];
};

export const _createLive2dCatalogPageLoad =
  (
    resolveCatalog: typeof resolveLive2dCatalogRouteData = resolveLive2dCatalogRouteData,
    resolveCharacters: typeof resolveLive2dCharacterData = resolveLive2dCharacterData
  ): PageServerLoad =>
  async ({ fetch }) => {
    const catalog = resolveCatalog(fetch);
    const characters: Promise<Live2dCharacterPayload> = catalog.then(
      (catalog) => {
        if (catalog.status !== "ready") {
          return { models: catalog.models, characters: [] };
        }

        return Promise.resolve()
          .then(() => resolveCharacters(catalog.models, fetch))
          .catch(() => ({
            models: catalog.models,
            characters: createLive2dCharacterOptions(catalog.models)
          }));
      },
      () => ({ models: [], characters: [] })
    );

    // Keep the original rejections available to SvelteKit's streaming error
    // handling while preventing Node's unhandled-rejection warning.
    catalog.catch(() => {});
    characters.catch(() => {});

    return { track: "live2d" as const, catalog, characters };
  };

export const load: PageServerLoad = _createLive2dCatalogPageLoad();
