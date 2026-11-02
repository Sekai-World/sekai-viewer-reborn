import {
  resolveLive2dCatalogRouteData,
  toLive2dCatalogSummary
} from "#lib/live2d/catalog-route-data.js";
import {
  createLive2dCharacterOverrides,
  type Live2dCharacterOverride
} from "#lib/live2d/character-grouping.js";
import {
  createLive2dCharacterOptions,
  resolveLive2dCharacterData
} from "#lib/server/live2d-characters.js";
import type { Live2dCharacterOption } from "#lib/server/live2d-characters.js";
import { normalizePrimaryRegion, type SupportedRegion } from "#lib/region-selection.svelte.js";
import type { PageServerLoad } from "./$types";

type Live2dCharacterPayload = {
  readonly characters: readonly Live2dCharacterOption[];
  readonly overrides: readonly Live2dCharacterOverride[];
};

const EMPTY_CHARACTER_PAYLOAD: Live2dCharacterPayload = { characters: [], overrides: [] };

export const _createLive2dCatalogPageLoad =
  (
    resolveCatalog: typeof resolveLive2dCatalogRouteData = resolveLive2dCatalogRouteData,
    resolveCharacters: typeof resolveLive2dCharacterData = resolveLive2dCharacterData
  ): PageServerLoad =>
  async ({ fetch, url }) => {
    const region: SupportedRegion = normalizePrimaryRegion(url?.searchParams.get("region"));
    const routeData = resolveCatalog(fetch);
    // The page renders a few fields per model, so serialize the model list once
    // as a summary and stream only the character changes after resolution.
    const catalog = routeData.then(toLive2dCatalogSummary);
    const characters: Promise<Live2dCharacterPayload> = routeData.then(
      (routeData) => {
        if (routeData.status !== "ready") return EMPTY_CHARACTER_PAYLOAD;

        return Promise.resolve()
          .then(() => resolveCharacters(routeData.models, fetch, region))
          .then((resolution) => ({
            characters: resolution.characters,
            overrides: createLive2dCharacterOverrides(routeData.models, resolution.models)
          }))
          .catch(() => ({
            characters: createLive2dCharacterOptions(routeData.models),
            overrides: []
          }));
      },
      () => EMPTY_CHARACTER_PAYLOAD
    );

    // Keep the original rejections available to SvelteKit's streaming error
    // handling while preventing Node's unhandled-rejection warning.
    catalog.catch(() => {});
    characters.catch(() => {});

    return { track: "live2d" as const, catalog, characters };
  };

export const load: PageServerLoad = _createLive2dCatalogPageLoad();
