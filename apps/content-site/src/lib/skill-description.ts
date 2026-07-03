import type {
  CardDetailCharacter,
  CardDetailSkill,
  CardDetailSkillEffect,
  CardDetailSkillEffectDetail
} from "$lib/domain/card-detail";

type SelectedSkillEffect = {
  effect: CardDetailSkillEffect;
  detail: CardDetailSkillEffectDetail;
};

type FormatSkillDescriptionOptions = {
  skill: CardDetailSkill;
  skillLevel: number;
  character?: CardDetailCharacter | null;
};

const singlePlaceholderPattern = /\{\{(?<effectId>\d+);(?<kind>[dvemc])\}\}/g;
const doublePlaceholderPattern = /\{\{(?<baseEffectId>\d+),(?<bonusEffectId>\d+);(?<kind>[rsvuo])\}\}/g;

export const formatEffectValue = (value: number | null, type: string | null): string => {
  if (value === null) {
    return "--";
  }

  return type === "rate" ? `${value}%` : String(value);
};

const getEffectDetail = (
  effect: CardDetailSkillEffect,
  skillLevel: number
): CardDetailSkillEffectDetail | null =>
  effect.details.find((item) => item.level === skillLevel) ??
  effect.details[effect.details.length - 1] ??
  null;

export const getSelectedSkillEffects = (
  skill: CardDetailSkill | null,
  skillLevel: number
): SelectedSkillEffect[] => {
  const effects = skill?.effects ?? [];

  return effects
    .map((effect) => {
      const detail = getEffectDetail(effect, skillLevel);
      return detail ? { effect, detail } : null;
    })
    .filter((item): item is SelectedSkillEffect => item !== null);
};

const getDetailValue = (
  effects: readonly SelectedSkillEffect[],
  effectId: number
): number | null =>
  effects.find((item) => item.effect.id === effectId)?.detail.activateEffectValue ?? null;

const getBestMatchingEffectValue = ({
  effects,
  baseEffectId,
  bonusEffectId,
  matchEffect
}: {
  effects: readonly SelectedSkillEffect[];
  baseEffectId: number;
  bonusEffectId: number;
  matchEffect: (effect: CardDetailSkillEffect) => boolean;
}): number | null => {
  const baseValue = getDetailValue(effects, baseEffectId) ?? 0;
  const bonusValue =
    effects.find((item) => item.effect.id !== baseEffectId && matchEffect(item.effect))?.detail
      .activateEffectValue ?? getDetailValue(effects, bonusEffectId);

  return bonusValue === null ? null : baseValue + bonusValue;
};

const formatSinglePlaceholder = ({
  match,
  effectId,
  kind,
  effects,
  character
}: {
  match: string;
  effectId: number;
  kind: string;
  effects: readonly SelectedSkillEffect[];
  character?: CardDetailCharacter | null;
}): string => {
  if (kind === "c") {
    return character?.givenName ?? character?.firstName ?? match;
  }

  const selectedEffect = effects.find((item) => item.effect.id === effectId);
  if (!selectedEffect) {
    return match;
  }

  const { effect, detail } = selectedEffect;
  switch (kind) {
    case "d":
      return String(detail.activateEffectDuration ?? match);
    case "v":
      return String(detail.activateEffectValue ?? match);
    case "e":
      return String(effect.skillEnhance?.activateEffectValue ?? match);
    case "m": {
      const enhanceValue = effect.skillEnhance?.activateEffectValue;
      const baseValue = detail.activateEffectValue;
      return enhanceValue === null || enhanceValue === undefined || baseValue === null
        ? match
        : String(enhanceValue * 5 + baseValue);
    }
    default:
      return match;
  }
};

const formatDoublePlaceholder = ({
  match,
  baseEffectId,
  bonusEffectId,
  kind,
  effects
}: {
  match: string;
  baseEffectId: number;
  bonusEffectId: number;
  kind: string;
  effects: readonly SelectedSkillEffect[];
}): string => {
  const baseEffect = effects.find((item) => item.effect.id === baseEffectId)?.effect;
  const bonusEffect = effects.find((item) => item.effect.id === bonusEffectId)?.effect;

  switch (kind) {
    case "r": {
      const maxRank = bonusEffect?.activateCharacterRank;
      const value =
        maxRank === null || maxRank === undefined
          ? getDetailValue(effects, bonusEffectId)
          : effects.find((item) => item.effect.activateCharacterRank === maxRank)?.detail
              .activateEffectValue;
      return value === null || value === undefined ? match : String(value);
    }
    case "s":
    case "v": {
      const maxRank = bonusEffect?.activateCharacterRank;
      const value =
        maxRank === null || maxRank === undefined
          ? null
          : getBestMatchingEffectValue({
              effects,
              baseEffectId,
              bonusEffectId,
              matchEffect: (effect) => effect.activateCharacterRank === maxRank
            });
      return value === null ? match : String(value);
    }
    case "u": {
      const maxUnitCount = bonusEffect?.activateUnitCount;
      const value =
        maxUnitCount === null || maxUnitCount === undefined
          ? null
          : getBestMatchingEffectValue({
              effects,
              baseEffectId,
              bonusEffectId,
              matchEffect: (effect) => effect.activateUnitCount === maxUnitCount
            });
      return value === null ? match : String(value);
    }
    case "o": {
      const baseValue = baseEffect ? getDetailValue(effects, baseEffectId) : null;
      const bonusValue = bonusEffect ? getDetailValue(effects, bonusEffectId) : null;
      return baseValue === null || bonusValue === null ? match : String(baseValue + bonusValue);
    }
    default:
      return match;
  }
};

export const formatSkillDescription = ({
  skill,
  skillLevel,
  character
}: FormatSkillDescriptionOptions): string | null => {
  const description = skill.description ?? skill.shortDescription;
  if (!description) {
    return null;
  }

  const effects = getSelectedSkillEffects(skill, skillLevel);

  return description
    .replaceAll("\\n", "\n")
    .replace(singlePlaceholderPattern, (match: string, effectIdValue: string, kind: string) => {
      const effectId = Number(effectIdValue);
      return Number.isFinite(effectId)
        ? formatSinglePlaceholder({ match, effectId, kind, effects, character })
        : match;
    })
    .replace(
      doublePlaceholderPattern,
      (match: string, baseEffectIdValue: string, bonusEffectIdValue: string, kind: string) => {
        const baseEffectId = Number(baseEffectIdValue);
        const bonusEffectId = Number(bonusEffectIdValue);

        return Number.isFinite(baseEffectId) && Number.isFinite(bonusEffectId)
          ? formatDoublePlaceholder({ match, baseEffectId, bonusEffectId, kind, effects })
          : match;
      }
    );
};
