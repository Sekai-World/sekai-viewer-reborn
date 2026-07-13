import { error, type RequestHandler } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { loadGachaProbabilityPayload } from "$lib/server/gacha-probability";

export const GET: RequestHandler = async ({ params }) => {
  const region = normalizeRegion(params.region);
  const gachaId = params.id?.trim() ?? "";
  if (!gachaId) {
    throw error(400, "Invalid gacha probability request.");
  }

  try {
    const payload = await loadGachaProbabilityPayload({
      baseUrl: getMasterApiBaseUrl(),
      region,
      gachaId
    });
    if (!payload) {
      throw error(404, "Gacha probabilities not found.");
    }

    return new Response(JSON.stringify(payload), {
      headers: {
        "content-type": "application/json",
        "cache-control": "private, max-age=300"
      }
    });
  } catch (routeError) {
    if (routeError && typeof routeError === "object" && "status" in routeError) {
      throw routeError;
    }
    throw error(502, "Failed to load gacha probabilities.");
  }
};
