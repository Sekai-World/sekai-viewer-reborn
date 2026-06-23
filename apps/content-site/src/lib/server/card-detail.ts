import type { CardDetail, CardDetailEpisode, CardDetailParams } from "$lib/card-detail";

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getNestedObject = (
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null => {
  for (const key of keys) {
    const nested = getObject(source[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const getNestedArray = (
  source: Record<string, unknown>,
  keys: readonly string[]
): unknown[] | null => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  return null;
};

const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstNumber = (
  source: Record<string, unknown>,
  keys: readonly string[]
): number | null => {
  for (const key of keys) {
    const value = getNumber(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const pickFirstDateValue = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const normalizeUnitCode = (unit: string | null): string | null => {
  if (!unit) {
    return null;
  }

  const normalizedUnit = unit.trim().toLowerCase();
  return normalizedUnit === "-" ? "none" : normalizedUnit;
};

const parseCharacterNamePart = (
  characterNode: Record<string, unknown>,
  keys: readonly string[]
): string | null => pickFirstString(characterNode, keys);

const parseSkillEffects = (skillNode: Record<string, unknown> | null) =>
  (getNestedArray(skillNode ?? {}, ["skillEffects", "skill_effects"]) ?? [])
    .map((value) => {
      const effectNode = getObject(value);
      if (!effectNode) {
        return null;
      }

      return {
        id: pickFirstNumber(effectNode, ["id"]),
        type: pickFirstString(effectNode, ["skillEffectType", "skill_effect_type"]),
        notesJudgmentType: pickFirstString(effectNode, [
          "activateNotesJudgmentType",
          "activate_notes_judgment_type"
        ]),
        details: (getNestedArray(effectNode, ["skillEffectDetails", "skill_effect_details"]) ?? [])
          .map((detailValue) => {
            const detailNode = getObject(detailValue);
            const level = detailNode ? pickFirstNumber(detailNode, ["level"]) : null;
            if (!detailNode || level === null) {
              return null;
            }

            return {
              level,
              activateEffectDuration: pickFirstNumber(detailNode, [
                "activateEffectDuration",
                "activate_effect_duration"
              ]),
              activateEffectValue: pickFirstNumber(detailNode, [
                "activateEffectValue",
                "activate_effect_value"
              ]),
              activateEffectValue2: pickFirstNumber(detailNode, [
                "activateEffectValue2",
                "activate_effect_value_2"
              ]),
              activateEffectValueType: pickFirstString(detailNode, [
                "activateEffectValueType",
                "activate_effect_value_type"
              ])
            };
          })
          .filter((detail): detail is NonNullable<typeof detail> => detail !== null)
      };
    })
    .filter((effect): effect is NonNullable<typeof effect> => effect !== null);

export const parseCardDetail = (payload: unknown): CardDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const cardNode = getNestedObject(root, ["card", "data"]) ?? root;
  const rarityNode = getNestedObject(cardNode, ["cardRarity", "rarity"]);
  const characterNode = getNestedObject(cardNode, ["character", "gameCharacter"]);
  const skillNode = getNestedObject(cardNode, ["skill"]);
  const cardSupplyNode = getNestedObject(cardNode, ["cardSupply", "card_supply", "supply"]);
  const id = pickFirstStringLike(cardNode, ["id", "cardId"]);

  if (!id) {
    return null;
  }

  const maxSkillLevel = pickFirstNumber(rarityNode ?? {}, ["maxSkillLevel"]) ?? 4;

  return {
    id,
    title: pickFirstString(cardNode, ["prefix", "name", "title"]) ?? `#${id}`,
    assetBundleName: pickFirstString(cardNode, ["assetbundleName", "assetBundleName"]),
    attr: pickFirstString(cardNode, ["attr", "attribute"]),
    rarityType: pickFirstString(rarityNode ?? cardNode, [
      "cardRarityType",
      "card_rarity_type",
      "rarityType"
    ]),
    maxLevel: pickFirstNumber(rarityNode ?? {}, ["maxLevel"]),
    trainingMaxLevel: pickFirstNumber(rarityNode ?? {}, ["trainingMaxLevel"]),
    maxSkillLevel,
    character: characterNode
      ? {
          id:
            pickFirstNumber(characterNode, ["gameCharacterId", "characterId", "id"]) ??
            pickFirstNumber(cardNode, ["characterId", "gameCharacterId"]),
          firstName: parseCharacterNamePart(characterNode, ["firstName", "firstNameEnglish"]),
          givenName: parseCharacterNamePart(characterNode, ["givenName", "givenNameEnglish"]),
          unit: normalizeUnitCode(pickFirstString(characterNode, ["unit"]))
        }
      : null,
    supportUnit: normalizeUnitCode(pickFirstString(cardNode, ["supportUnit", "support_unit"])),
    cardSupplyType:
      pickFirstString(cardSupplyNode ?? {}, ["cardSupplyType", "card_supply_type", "type"]) ??
      pickFirstString(cardNode, ["cardSupplyType", "card_supply_type"]),
    cardSupplyAssetBundleName:
      pickFirstString(cardSupplyNode ?? {}, ["assetbundleName", "assetBundleName"]) ?? null,
    initialSpecialTrainingStatus: pickFirstString(cardNode, [
      "initialSpecialTrainingStatus",
      "initial_special_training_status"
    ]),
    releaseAt: pickFirstDateValue(cardNode, ["releaseAt", "release_at"]),
    archivePublishedAt: pickFirstDateValue(cardNode, [
      "archivePublishedAt",
      "archive_published_at"
    ]),
    seq: pickFirstDateValue(cardNode, ["seq"]),
    flavorText: pickFirstString(cardNode, ["flavorText", "flavor_text"]),
    gachaPhrase: pickFirstString(cardNode, ["gachaPhrase", "gacha_phrase"]),
    skill: skillNode
      ? {
          name: pickFirstString(cardNode, ["cardSkillName", "card_skill_name"]),
          description: pickFirstString(skillNode, ["description"]),
          shortDescription: pickFirstString(skillNode, ["shortDescription", "short_description"]),
          descriptionSpriteName: pickFirstString(skillNode, [
            "descriptionSpriteName",
            "description_sprite_name"
          ]),
          maxSkillLevel,
          effects: parseSkillEffects(skillNode)
        }
      : null
  };
};

const parameterTypeAliases: Record<"performance" | "technique" | "stamina", readonly string[]> = {
  performance: ["performance", "param1", "power1", "power_1"],
  technique: ["technique", "param2", "power2", "power_2"],
  stamina: ["stamina", "param3", "power3", "power_3"]
};

const normalizeParameterType = (value: string | null): keyof typeof parameterTypeAliases | null => {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  for (const [type, aliases] of Object.entries(parameterTypeAliases)) {
    if (aliases.includes(normalized)) {
      return type as keyof typeof parameterTypeAliases;
    }
  }

  return null;
};

export const parseCardDetailParams = (payload: unknown): CardDetailParams => {
  const root = getObject(payload);
  const paramsNode = root ? (getNestedObject(root, ["card", "data"]) ?? root) : {};
  const source = getNestedArray(paramsNode, ["cardParameters", "card_parameters"]) ?? [];
  const byLevel = new Map<
    number,
    { level: number; performance: number | null; technique: number | null; stamina: number | null }
  >();

  for (const value of source) {
    const node = getObject(value);
    if (!node) {
      continue;
    }

    const level = pickFirstNumber(node, ["cardLevel", "card_level", "level"]);
    const type = normalizeParameterType(
      pickFirstString(node, ["cardParameterType", "card_parameter_type", "type"])
    );
    const power = pickFirstNumber(node, ["power", "value"]);

    if (level === null || type === null || power === null) {
      continue;
    }

    const current = byLevel.get(level) ?? {
      level,
      performance: null,
      technique: null,
      stamina: null
    };
    current[type] = power;
    byLevel.set(level, current);
  }

  const parameters = [...byLevel.values()]
    .sort((left, right) => left.level - right.level)
    .map((set) => {
      const values = [set.performance, set.technique, set.stamina];
      const total = values.every((value): value is number => value !== null)
        ? values.reduce((sum, value) => sum + value, 0)
        : null;
      return { ...set, total };
    });

  const performance = pickFirstNumber(paramsNode, [
    "specialTrainingPower1BonusFixed",
    "special_training_power_1_bonus_fixed"
  ]);
  const technique = pickFirstNumber(paramsNode, [
    "specialTrainingPower2BonusFixed",
    "special_training_power_2_bonus_fixed"
  ]);
  const stamina = pickFirstNumber(paramsNode, [
    "specialTrainingPower3BonusFixed",
    "special_training_power_3_bonus_fixed"
  ]);

  return {
    parameters,
    specialTrainingBonus: {
      performance: performance ?? 0,
      technique: technique ?? 0,
      stamina: stamina ?? 0,
      total: (performance ?? 0) + (technique ?? 0) + (stamina ?? 0)
    }
  };
};

const parseLooseItemList = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) {
    return payload;
  }

  const root = getObject(payload);
  if (!root) {
    return [];
  }

  return (
    getNestedArray(root, ["items", "episodes", "cardEpisodes"]) ??
    getNestedArray(getNestedObject(root, ["data"]) ?? {}, ["items", "episodes", "cardEpisodes"]) ??
    []
  );
};

const stringifyValue = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const parseLooseTextList = (source: Record<string, unknown>, keys: readonly string[]): string[] => {
  for (const key of keys) {
    const value = source[key];
    if (Array.isArray(value)) {
      return value.map(stringifyValue).filter((item): item is string => item !== null);
    }
  }

  return [];
};

export const parseCardDetailEpisodes = (payload: unknown): CardDetailEpisode[] =>
  parseLooseItemList(payload)
    .map((value, index) => {
      const node = getObject(value);
      if (!node) {
        return null;
      }

      const releaseCondition = getNestedObject(node, ["releaseCondition", "release_condition"]);
      const id = pickFirstStringLike(node, ["id", "episodeId", "cardEpisodeId"]) ?? String(index);
      const episodeNo = pickFirstNumber(node, ["episodeNo", "episode_no", "seq"]);
      const title =
        pickFirstString(node, ["title", "scenarioName", "name", "episodeTitle"]) ??
        (episodeNo !== null ? `Episode ${episodeNo}` : `Episode ${index + 1}`);

      return {
        id,
        title,
        episodeNo,
        releaseConditionType: pickFirstString(releaseCondition ?? node, [
          "releaseConditionType",
          "release_condition_type"
        ]),
        releaseConditionSentence: pickFirstString(releaseCondition ?? node, ["sentence"]),
        costs: parseLooseTextList(node, ["costs", "costItems", "cost_items"]),
        rewards: parseLooseTextList(node, ["rewards", "rewardItems", "reward_items"])
      };
    })
    .filter((episode): episode is CardDetailEpisode => episode !== null);
