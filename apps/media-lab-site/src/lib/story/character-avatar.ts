/**
 * Local character bust thumbnails (`static/chr_ts/chr_ts_{id}_g1.png`),
 * copied from the content-site static bundle. Game characters 1–26 have a
 * g1 (untrained) bust; any other id resolves to `null` and the UI falls
 * back to a generic avatar.
 */

const MIN_LOCAL_AVATAR_CHARACTER_ID = 1;
const MAX_LOCAL_AVATAR_CHARACTER_ID = 26;

export const localCharacterAvatarUrl = (characterId: number): string | null =>
  characterId >= MIN_LOCAL_AVATAR_CHARACTER_ID &&
  characterId <= MAX_LOCAL_AVATAR_CHARACTER_ID
    ? `/chr_ts/chr_ts_${characterId}_g1.png`
    : null;
