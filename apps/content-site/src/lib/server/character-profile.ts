import type { CharacterProfile } from "$lib/domain/character";

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value.trim() : null;

export const parseCharacterProfile = (payload: unknown): CharacterProfile | null => {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const profile = payload as Record<string, unknown>;
  const parsed: CharacterProfile = {
    birthday: getString(profile.birthday),
    characterVoice: getString(profile.characterVoice),
    favoriteFood: getString(profile.favoriteFood),
    hatedFood: getString(profile.hatedFood),
    hobby: getString(profile.hobby),
    introduction: getString(profile.introduction),
    school: getString(profile.school),
    schoolYear: getString(profile.schoolYear),
    specialSkill: getString(profile.specialSkill),
    weak: getString(profile.weak)
  };

  return Object.values(parsed).some((value) => value !== null) ? parsed : null;
};
