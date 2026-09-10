import { env } from "$env/dynamic/private";
import {
  getCharacter2DsByRegionBatch,
  getGameCharactersByRegionList
} from "@platform/sekai-master-api-sdk";
import { LIVE2D_CATALOG_REGION } from "$lib/live2d/associated-catalog";

export interface Live2dCharacterOption {
  id: number | null;
  characterType?: string | null;
  name: string | null;
  modelCount: number;
}

export type Live2dCharacterModel = {
  readonly characterId?: number | null;
  readonly character2dId?: number | null;
  readonly characterType?: string | null;
};

export type Live2dResolvedCharacterModel<TModel extends Live2dCharacterModel> = Omit<
  TModel,
  "characterId" | "characterType"
> & {
  readonly characterId: number | null;
  readonly characterType?: string | null;
};

export interface Live2dCharacterResolution<TModel extends Live2dCharacterModel> {
  readonly models: readonly Live2dResolvedCharacterModel<TModel>[];
  readonly characters: readonly Live2dCharacterOption[];
}

const PAGE_SIZE = 100;
const CHARACTER2D_BATCH_SIZE = 100;
const MAX_PAGES = 20;

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const getPositiveSafeInteger = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const getNamePart = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getCharacterName = (item: Record<string, unknown>, id: number): string => {
  const name = [getNamePart(item.firstName), getNamePart(item.givenName)]
    .filter((part): part is string => part !== null)
    .join(" ");

  return name || `#${id}`;
};

const getItemsFromEnvelope = (payload: unknown): readonly unknown[] | null => {
  const root = getObject(payload);
  if (Array.isArray(root?.items)) return root.items;

  const data = getObject(root?.data);
  return Array.isArray(data?.items) ? data.items : null;
};

const getPaginationFromEnvelope = (
  payload: unknown
): { hasNext: boolean; page: number | null; totalPages: number | null } => {
  const root = getObject(payload);
  const data = getObject(root?.data);
  const pagination = getObject(root?.pagination) ?? getObject(data?.pagination);

  return {
    hasNext: pagination?.has_next === true,
    page: getPositiveSafeInteger(pagination?.page),
    totalPages: getPositiveSafeInteger(pagination?.total_pages)
  };
};

const resolveMasterApiBaseUrl = (): string | null => {
  const value = env.SEKAI_MASTER_API_BASE_URL?.trim();
  if (!value) return null;

  const normalized = value.replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : null;
};

const getCharacter2dIds = (models: readonly Live2dCharacterModel[]): readonly number[] => [
  ...new Set(
    models
      .map((model) => getPositiveSafeInteger(model.character2dId))
      .filter((id): id is number => id !== null)
  )
];

const chunkCharacter2dIds = (ids: readonly number[]): readonly (readonly number[])[] => {
  const chunks: number[][] = [];
  for (let index = 0; index < ids.length; index += CHARACTER2D_BATCH_SIZE) {
    chunks.push(ids.slice(index, index + CHARACTER2D_BATCH_SIZE));
  }
  return chunks;
};

type Character2dMapping = {
  readonly gameCharacterId: number;
  readonly characterType: string | null;
  readonly displayName: string | null;
  readonly assetName: string | null;
};

const parseCharacter2dBatch = (
  payload: unknown,
  requestedIds: ReadonlySet<number>
): ReadonlyMap<number, Character2dMapping> | null => {
  const root = getObject(payload);
  if (!root || !Array.isArray(root.items) || !Array.isArray(root.missingIds)) return null;

  const mappings = new Map<number, Character2dMapping>();
  const returnedIds = new Set<number>();

  for (const item of root.items) {
    const record = getObject(item);
    const character2dId = getPositiveSafeInteger(record?.id);
    const gameCharacterId = getPositiveSafeInteger(record?.gameCharacterId);
    if (
      !record ||
      character2dId === null ||
      gameCharacterId === null ||
      !requestedIds.has(character2dId) ||
      returnedIds.has(character2dId)
    ) {
      return null;
    }

    returnedIds.add(character2dId);
    mappings.set(character2dId, {
      gameCharacterId,
      characterType: getNamePart(record.characterType),
      displayName: getNamePart(record.displayName),
      assetName: getNamePart(record.assetName)
    });
  }

  const missingIds = new Set<number>();
  for (const value of root.missingIds) {
    const character2dId = getPositiveSafeInteger(value);
    if (
      character2dId === null ||
      !requestedIds.has(character2dId) ||
      returnedIds.has(character2dId) ||
      missingIds.has(character2dId)
    ) {
      return null;
    }

    missingIds.add(character2dId);
  }

  if (returnedIds.size + missingIds.size !== requestedIds.size) return null;

  return mappings;
};

const readCharacter2dMappings = async (
  fetcher: typeof fetch,
  character2dIds: readonly number[]
): Promise<ReadonlyMap<number, Character2dMapping>> => {
  const baseUrl = resolveMasterApiBaseUrl();
  if (!baseUrl || character2dIds.length === 0) return new Map();

  const chunks = chunkCharacter2dIds(character2dIds);

  try {
    const responses = await Promise.all(
      chunks.map((ids) =>
        getCharacter2DsByRegionBatch({
          baseUrl,
          fetch: fetcher,
          path: { region: LIVE2D_CATALOG_REGION },
          query: { ids: ids.join(",") }
        })
      )
    );
    const mappings = new Map<number, Character2dMapping>();

    for (const [index, response] of responses.entries()) {
      if (response.error || !response.data) return new Map();

      const chunkMapping = parseCharacter2dBatch(response.data, new Set(chunks[index]));
      if (!chunkMapping) return new Map();

      for (const [character2dId, mapping] of chunkMapping) {
        mappings.set(character2dId, mapping);
      }
    }

    return mappings;
  } catch {
    return new Map();
  }
};

const resolveModelCharacterId = (
  model: Live2dCharacterModel,
  character2dMappings: ReadonlyMap<number, Character2dMapping>
): number | null => {
  const character2dId = getPositiveSafeInteger(model.character2dId);
  return (
    (character2dId === null
      ? undefined
      : character2dMappings.get(character2dId)?.gameCharacterId) ??
    getPositiveSafeInteger(model.characterId)
  );
};

const resolveModelCharacterType = (
  model: Live2dCharacterModel,
  character2dMappings: ReadonlyMap<number, Character2dMapping>
): string | null => {
  const character2dId = getPositiveSafeInteger(model.character2dId);
  return (
    (character2dId === null
      ? undefined
      : character2dMappings.get(character2dId)?.characterType) ?? getNamePart(model.characterType)
  );
};

const resolveModelCharacterIds = <TModel extends Live2dCharacterModel>(
  models: readonly TModel[],
  character2dMappings: ReadonlyMap<number, Character2dMapping>
): readonly Live2dResolvedCharacterModel<TModel>[] =>
  models.map((model) => {
    const characterType = resolveModelCharacterType(model, character2dMappings);
    const resolvedModel = {
      ...model,
      characterId: resolveModelCharacterId(model, character2dMappings)
    };

    return characterType === null ? resolvedModel : { ...resolvedModel, characterType };
  });

const isNonGameCharacterType = (characterType: string | null): boolean =>
  characterType === "mob" || characterType === "sub_game_character";

const getCharacterIdentityKey = (
  characterId: number | null,
  characterType: string | null
): string =>
  JSON.stringify([
    characterId,
    characterId === null
      ? "uncategorized"
      : characterType === null || characterType === "game_character"
        ? "game_character"
        : characterType
  ]);

const getCharacterNameResolution = (
  models: readonly Live2dCharacterModel[],
  character2dMappings: ReadonlyMap<number, Character2dMapping>
): {
  readonly characterIds: ReadonlySet<number>;
  readonly stableNames: ReadonlyMap<string, string>;
} => {
  const characterIds = new Set<number>();
  const stableNames = new Map<string, string>();

  for (const model of models) {
    const character2dId = getPositiveSafeInteger(model.character2dId);
    const mapping = character2dId === null ? undefined : character2dMappings.get(character2dId);
    const characterId = resolveModelCharacterId(model, character2dMappings);
    const characterType = getNamePart(model.characterType);
    if (characterId === null) continue;

    if (isNonGameCharacterType(characterType)) {
      const identityKey = getCharacterIdentityKey(characterId, characterType);
      const stableName = mapping?.displayName ?? mapping?.assetName;
      if (stableName && !stableNames.has(identityKey)) {
        stableNames.set(identityKey, stableName);
      }
      continue;
    }

    characterIds.add(characterId);
  }

  return { characterIds, stableNames };
};

const readCharacterNames = async (
  fetcher: typeof fetch,
  characterIds: ReadonlySet<number>
): Promise<ReadonlyMap<number, string>> => {
  const baseUrl = resolveMasterApiBaseUrl();
  if (!baseUrl || characterIds.size === 0) return new Map();

  try {
    const names = new Map<number, string>();
    const seenCharacterIds = new Set<number>();

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const response = await getGameCharactersByRegionList({
        baseUrl,
        fetch: fetcher,
        path: { region: LIVE2D_CATALOG_REGION },
        query: {
          page,
          page_size: PAGE_SIZE,
          sort_by: "seq",
          sort_order: "asc"
        }
      });
      if (response.error || !response.data) return new Map();

      const items = getItemsFromEnvelope(response.data);
      if (!items || items.length === 0) break;

      for (const item of items) {
        const character = getObject(item);
        const id = getPositiveSafeInteger(character?.id);
        if (!character || id === null || seenCharacterIds.has(id)) continue;

        seenCharacterIds.add(id);
        if (characterIds.has(id)) names.set(id, getCharacterName(character, id));
      }

      const pagination = getPaginationFromEnvelope(response.data);
      if (!pagination.hasNext) break;
      if (pagination.totalPages !== null && page >= pagination.totalPages) break;
      if (pagination.page !== null && pagination.page !== page) break;
    }

    return names;
  } catch {
    return new Map();
  }
};

const countModelsByCharacter = (
  models: readonly Live2dCharacterModel[]
): ReadonlyMap<
  string,
  { id: number | null; characterType: string | null; modelCount: number }
> => {
  const counts = new Map<
    string,
    { id: number | null; characterType: string | null; modelCount: number }
  >();

  for (const model of models) {
    const characterId = getPositiveSafeInteger(model.characterId);
    const characterType = characterId === null ? null : getNamePart(model.characterType);
    const identityKey = getCharacterIdentityKey(characterId, characterType);
    const current = counts.get(identityKey);
    if (current) {
      current.modelCount += 1;
    } else {
      counts.set(identityKey, { id: characterId, characterType, modelCount: 1 });
    }
  }

  return counts;
};

const getCharacterOptionName = (
  characterId: number,
  characterType: string | null,
  names: ReadonlyMap<number, string>,
  stableNames: ReadonlyMap<string, string>
): string => {
  if (isNonGameCharacterType(characterType)) {
    return stableNames.get(getCharacterIdentityKey(characterId, characterType)) ?? `#${characterId}`;
  }

  return names.get(characterId) || `#${characterId}`;
};

/** Builds stable character options in the first-seen order of the catalog. */
export const createLive2dCharacterOptions = (
  models: readonly Live2dCharacterModel[],
  names: ReadonlyMap<number, string> = new Map(),
  stableNames: ReadonlyMap<string, string> = new Map()
): readonly Live2dCharacterOption[] =>
  Array.from(countModelsByCharacter(models).values(), ({ id, characterType, modelCount }) => ({
    id,
    ...(characterType === null ? {} : { characterType }),
    name: id === null ? null : getCharacterOptionName(id, characterType, names, stableNames),
    modelCount
  }));

/**
 * Resolves catalog Character2D references and display names for the character
 * groups in a ready catalog.
 *
 * The SDK call and request fetcher remain local to this invocation. In
 * particular, no module-level SDK client retains a request-scoped SvelteKit
 * fetch function. Master API failures deliberately degrade to ID fallbacks.
 */
export const resolveLive2dCharacterData = async <TModel extends Live2dCharacterModel>(
  models: readonly TModel[],
  fetcher: typeof fetch = fetch
): Promise<Live2dCharacterResolution<TModel>> => {
  const character2dMappings = await readCharacter2dMappings(fetcher, getCharacter2dIds(models));
  const resolvedModels = resolveModelCharacterIds(models, character2dMappings);
  const nameResolution = getCharacterNameResolution(resolvedModels, character2dMappings);
  const names = new Map(await readCharacterNames(fetcher, nameResolution.characterIds));
  return {
    models: resolvedModels,
    characters: createLive2dCharacterOptions(resolvedModels, names, nameResolution.stableNames)
  };
};

export const resolveLive2dCharacterOptions = async (
  models: readonly Live2dCharacterModel[],
  fetcher: typeof fetch = fetch
): Promise<readonly Live2dCharacterOption[]> =>
  (await resolveLive2dCharacterData(models, fetcher)).characters;
