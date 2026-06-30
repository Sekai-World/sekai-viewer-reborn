import type {
  MusicDetail,
  MusicDifficulty,
  MusicVocal
} from "$lib/domain/music-detail";

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return getString(value);
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
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;

const pickString = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickStringLike = (source: Record<string, unknown>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const parseMusicDifficulty = (payload: unknown): MusicDifficulty | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const difficulty = pickStringLike(root, ["difficulty", "musicDifficulty"]);
  const level = getNumber(root.level) ?? getNumber(root.playLevel);
  const playLevel = getNumber(root.playLevel);

  if (!difficulty || level === null) {
    return null;
  }

  return {
    difficulty: difficulty.toLowerCase(),
    level,
    playLevel: playLevel ?? level,
    noteCount: getNumber(root.noteCount) ?? getNumber(root.totalNoteCount) ?? 0
  };
};

const parseCharacterEntry = (
  payload: unknown
): { characterId: number; unit: string } | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const characterId = getNumber(root.characterId ?? root.gameCharacterId);
  const unit = pickString(root, ["unit"]);
  if (characterId === null) {
    return null;
  }

  return { characterId, unit: unit ?? "" };
};

const parseMusicVocal = (payload: unknown): MusicVocal | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const id = pickStringLike(root, ["id"]);
  const musicId = pickStringLike(root, ["musicId"]);
  if (!id || !musicId) {
    return null;
  }

  const overrideCharaRaw = root.overrideCharas ?? root.characters;
  const charactersRaw = root.characters;

  const parseCharacterList = (value: unknown): { characterId: number; unit: string }[] | null => {
    if (!Array.isArray(value)) {
      return null;
    }

    const entries = value.map(parseCharacterEntry).filter((entry): entry is NonNullable<typeof entry> => entry !== null);
    return entries.length > 0 ? entries : null;
  };

  return {
    id,
    musicId,
    vocalType: pickString(root, ["caption", "musicVocalType", "vocalType", "vocal_type"]),
    overrideChara: parseCharacterList(overrideCharaRaw),
    characters: parseCharacterList(charactersRaw),
    assetBundleName: pickString(root, ["assetbundleName", "assetBundleName"])
  };
};

const parseMusicDetail = (payload: unknown): MusicDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const musicNode = getObject(root.music);
  if (!musicNode) {
    return null;
  }

  const id = pickStringLike(musicNode, ["id"]);
  const title = pickString(musicNode, ["title", "name"]);
  if (!id || !title) {
    return null;
  }

  const categories = Array.isArray(musicNode.categories)
    ? (musicNode.categories as unknown[])
        .map((v) => getString(v))
        .filter((v): v is string => v !== null)
    : [];

  const difficultiesRaw = Array.isArray(root.difficulties)
    ? root.difficulties
    : [];
  const difficulties = difficultiesRaw
    .map(parseMusicDifficulty)
    .filter((d): d is MusicDifficulty => d !== null);

  const vocalsRaw = Array.isArray(root.vocals) ? root.vocals : [];
  const vocals = vocalsRaw
    .map(parseMusicVocal)
    .filter((v): v is MusicVocal => v !== null);

  const tagsRaw = Array.isArray(root.tags) ? root.tags : [];
  const tags = tagsRaw
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);

  const creatorArtistNode = getObject(musicNode.creatorArtist);
  const liveStageNode = getObject(musicNode.liveStage);

  return {
    id,
    title,
    assetBundleName: pickString(musicNode, ["assetbundleName", "assetBundleName"]),
    categories: [...new Set(categories)],
    composer: pickString(musicNode, ["composer"]),
    arranger: pickString(musicNode, ["arranger"]),
    lyricist: pickString(musicNode, ["lyricist"]),
    publishedAt: getDateValue(musicNode.publishedAt ?? musicNode.published_at),
    creatorArtist: creatorArtistNode
      ? { name: pickString(creatorArtistNode, ["name"]) }
      : null,
    liveStage: liveStageNode
      ? { name: pickString(liveStageNode, ["name"]) }
      : null,
    releaseCondition: pickString(musicNode, ["releaseCondition"]),
    fillerSec: getNumber(musicNode.fillerSec ?? musicNode.filler_sec),
    difficulties,
    vocals,
    tags
  };
};

export type { MusicDetail };
export { parseMusicDetail };
