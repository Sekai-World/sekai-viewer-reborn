import { error } from "@sveltejs/kit";
import {
  resolveLive2dCatalogRouteData,
  toLive2dRouteModelDescriptor
} from "$lib/live2d/catalog-route-data";
import { parseModelRouteParams } from "$lib/live2d/model-route";
import type { PageServerLoad } from "./$types";

export const _createLive2dModelPageLoad = (
  resolveCatalog: typeof resolveLive2dCatalogRouteData = resolveLive2dCatalogRouteData
): PageServerLoad =>
  async ({ fetch, params }) => {
    const parsed = parseModelRouteParams(params);
    if (parsed.status !== "ok") {
      error(404, "Live2D model route not found");
    }

    const catalog = await resolveCatalog(fetch);
    if (catalog.status === "ready") {
      const model = catalog.models.find((entry) => entry.id === parsed.modelId);
      if (!model) {
        error(404, "Live2D model not found");
      }

      const descriptor = toLive2dRouteModelDescriptor(model);

      return {
        identity: { modelId: parsed.modelId },
        viewerStatus: "catalog-model-available" as const,
        catalog: {
          status: "ready" as const,
          source: catalog.source,
          ...(catalog.reason ? { reason: catalog.reason } : {}),
          model,
          descriptor
        }
      };
    }

    return {
      identity: { modelId: parsed.modelId },
      viewerStatus: "unavailable-model-contract" as const,
      catalog,
      descriptor: null
    };
  };

export const load: PageServerLoad = _createLive2dModelPageLoad();
