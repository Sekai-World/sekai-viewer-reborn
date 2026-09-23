import { json } from "@sveltejs/kit";
import { normalizeRegion } from "$lib/i18n/region";
import { getMasterApiBaseUrl } from "$lib/server/config";
import { getPositiveInteger } from "$lib/server/catalogue-data";
import { fetchCharacterRankReferences } from "$lib/server/mission-list";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const characterId = getPositiveInteger(params.characterId);
  if (characterId === null) return json({ error: true }, { status: 400 });

  try {
    const ranks = await fetchCharacterRankReferences(
      getMasterApiBaseUrl(),
      normalizeRegion(params.region),
      characterId
    );
    return json({ items: ranks });
  } catch {
    return json({ error: true }, { status: 500 });
  }
};
