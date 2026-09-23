/**
 * Local character bust thumbnails (`static/chr_ts/chr_ts_{id}_g1.png`),
 * copied from the content-site static bundle. Game characters 1–26 have a
 * g1 (untrained) bust; any other id resolves to `null` and the UI falls
 * back to a generic avatar.
 */

export const LOCAL_AVATAR_CHARACTER_ID_MIN = 1;
export const LOCAL_AVATAR_CHARACTER_ID_MAX = 26;

export const localCharacterAvatarUrl = (characterId: number): string | null =>
  characterId >= LOCAL_AVATAR_CHARACTER_ID_MIN && characterId <= LOCAL_AVATAR_CHARACTER_ID_MAX
    ? `/chr_ts/chr_ts_${characterId}_g1.png`
    : null;
