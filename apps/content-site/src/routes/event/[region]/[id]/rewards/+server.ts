import { getEventsByRegionByIdRewards } from "@platform/sekai-master-api-sdk";
import { error, type RequestHandler } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";

export const GET: RequestHandler = async ({ params }) => {
  const id = params.id?.trim() ?? "";
  const region = params.region?.trim() ?? "";
  if (!id || !region) throw error(400, "Invalid event rewards request.");
  try {
    const response = await getEventsByRegionByIdRewards({
      baseUrl: getMasterApiBaseUrl(),
      path: { region: normalizeRegion(region), id }
    });
    if (response.error) throw error(404, "Event rewards not found.");
    return new Response(JSON.stringify(response.data), {
      headers: { "content-type": "application/json", "cache-control": "private, max-age=300" }
    });
  } catch (routeError) {
    if (routeError && typeof routeError === "object" && "status" in routeError) throw routeError;
    throw error(502, "Failed to load event rewards.");
  }
};
