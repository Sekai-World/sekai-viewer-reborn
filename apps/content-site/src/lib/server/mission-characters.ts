import type { MissionCharacterOption } from "$lib/domain/mission";
import { parseCharacterList, parseCharacterUnits } from "$lib/server/character-list";
import {
  aggregateGameCharactersByRegion,
  aggregateGameCharacterUnitsByRegion
} from "$lib/server/character-pages";
import { fetchUnitProfiles } from "$lib/server/unit-profiles";

/** Characters in `seq` order for the Character Missions picker, with their unit names. */
export const fetchMissionCharacterOptions = async (
  baseUrl: string,
  region: string
): Promise<MissionCharacterOption[]> => {
  const [charactersResult, unitsResult, profiles] = await Promise.all([
    aggregateGameCharactersByRegion(baseUrl, region, "seq", "asc"),
    aggregateGameCharacterUnitsByRegion(baseUrl, region, "id", "asc"),
    fetchUnitProfiles(baseUrl, region).catch(() => [])
  ]);
  if (charactersResult.loadFailed || unitsResult.loadFailed) {
    throw new Error("Failed to load mission characters.");
  }
  const unitNames = new Map(profiles.map((profile) => [profile.unit, profile.unitName]));
  return parseCharacterList(charactersResult.data, parseCharacterUnits(unitsResult.data)).flatMap(
    (character) => {
      const id = Number(character.id);
      if (!Number.isSafeInteger(id) || id <= 0) return [];
      return [
        {
          id,
          name: character.name,
          unit: character.unit,
          unitName: character.unit ? (unitNames.get(character.unit) ?? null) : null
        }
      ];
    }
  );
};
