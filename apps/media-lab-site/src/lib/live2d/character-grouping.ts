export type Live2dCharacterType = "game_character" | "sub_game_character" | "mob";

/** Maps only the catalog's explicit character types to visible category tabs. */
export const getLive2dCharacterTypeKey = (
  characterType: string | null
): Live2dCharacterType | null => {
  if (characterType === null || characterType === "game_character") return "game_character";
  if (characterType === "sub_game_character") return "sub_game_character";
  if (characterType === "mob") return "mob";
  return null;
};

export const getLive2dCharacterGroupKey = (
  characterId: string | number | null,
  characterType: string | null
): string => {
  if (characterId === null) return "character-uncategorized";

  const typePrefix =
    characterType && characterType !== "game_character"
      ? `${encodeURIComponent(characterType)}-`
      : "";
  return `character-${typePrefix}${encodeURIComponent(String(characterId))}`;
};

type Live2dCharacterFields = {
  readonly id: string;
  readonly characterId?: number | null;
  readonly characterType?: string | null;
};

/** Resolved character fields for one catalog model, keyed by its route ID. */
export type Live2dCharacterOverride = {
  readonly id: string;
  readonly characterId: number | null;
  readonly characterType: string | null;
};

/**
 * Lists only the models whose resolved character differs from the catalog, so
 * the streamed character data does not repeat the model list.
 */
export const createLive2dCharacterOverrides = (
  catalogModels: readonly Live2dCharacterFields[],
  resolvedModels: readonly Live2dCharacterFields[]
): readonly Live2dCharacterOverride[] => {
  const catalogById = new Map(catalogModels.map((model) => [model.id, model]));

  return resolvedModels.flatMap((model) => {
    const characterId = model.characterId ?? null;
    const characterType = model.characterType ?? null;
    const catalogModel = catalogById.get(model.id);
    if (
      catalogModel &&
      (catalogModel.characterId ?? null) === characterId &&
      (catalogModel.characterType ?? null) === characterType
    ) {
      return [];
    }

    return [{ id: model.id, characterId, characterType }];
  });
};

export const applyLive2dCharacterOverrides = <TModel extends Live2dCharacterFields>(
  models: readonly TModel[],
  overrides: readonly Live2dCharacterOverride[] = []
): readonly TModel[] => {
  if (overrides.length === 0) return models;

  const overridesById = new Map(overrides.map((override) => [override.id, override]));
  return models.map((model) => {
    const override = overridesById.get(model.id);
    return override
      ? { ...model, characterId: override.characterId, characterType: override.characterType }
      : model;
  });
};
