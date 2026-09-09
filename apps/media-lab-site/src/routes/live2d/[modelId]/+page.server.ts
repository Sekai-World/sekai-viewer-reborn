import { error } from "@sveltejs/kit";
import {
  resolveLive2dCatalogRouteData,
  toLive2dRouteModelDescriptor
} from "$lib/live2d/catalog-route-data";
import { parseModelRouteParams } from "$lib/live2d/model-route";
import type { PageServerLoad } from "./$types";

const LEGACY_MODEL_ID_PATTERN = /^[A-Za-z0-9_.-]+$/;
const MAX_LEGACY_MODEL_ID_LENGTH = 128;

const parseLegacyModelRouteParam = (value: string | undefined): string | undefined => {
  const modelId = value?.trim() ?? "";
  if (
    !modelId ||
    modelId.length > MAX_LEGACY_MODEL_ID_LENGTH ||
    modelId === "." ||
    modelId === ".." ||
    !LEGACY_MODEL_ID_PATTERN.test(modelId)
  ) {
    return undefined;
  }

  return modelId;
};

export const _createLive2dModelPageLoad =
  (
    resolveCatalog: typeof resolveLive2dCatalogRouteData = resolveLive2dCatalogRouteData
  ): PageServerLoad =>
  async ({ fetch, params }) => {
    const parsed = parseModelRouteParams(params);
    const modelId =
      parsed.status === "ok" ? parsed.modelId : parseLegacyModelRouteParam(params.modelId);
    if (!modelId) {
      error(404, "Live2D model route not found");
    }

    const catalog = await resolveCatalog(fetch);
    if (catalog.status === "ready") {
      // Keep generated route IDs authoritative. The modelName lookup is only
      // a compatibility path for legacy URLs and must not select among
      // duplicate source names.
      const canonicalModel = catalog.models.find((entry) => entry.id === modelId);
      const model =
        canonicalModel ??
        (() => {
          const namedModels = catalog.models.filter((entry) => entry.modelName === modelId);
          return namedModels.length === 1 ? namedModels[0] : undefined;
        })();
      if (!model) {
        error(404, "Live2D model not found");
      }

      const descriptor = toLive2dRouteModelDescriptor(model);

      return {
        identity: { modelId },
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
      identity: { modelId },
      viewerStatus: "unavailable-model-contract" as const,
      catalog,
      descriptor: null
    };
  };

export const load: PageServerLoad = _createLive2dModelPageLoad();
