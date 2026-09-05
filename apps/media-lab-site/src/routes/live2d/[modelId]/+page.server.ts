import { error } from "@sveltejs/kit";
import { parseModelRouteParams } from "$lib/live2d/model-route";
import type { PageServerLoad } from "./$types";

/**
 * Metadata-only route shell for the standalone Live2D model viewer. Model
 * list/metadata resolution stays out of this loader until the model player
 * adapter work lands; the page renders stubbed route metadata only.
 */
export const load: PageServerLoad = async ({ params }) => {
  const parsed = parseModelRouteParams(params);
  if (parsed.status !== "ok") {
    error(404, "Live2D model route not found");
  }

  return {
    identity: { modelId: parsed.modelId },
    viewerStatus: "unavailable-model-contract" as const
  };
};
