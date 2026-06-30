export type MusicDifficulty = {
  difficulty: string;
  level: number;
  playLevel: number;
  noteCount: number;
};

export type MusicVocal = {
  id: string;
  musicId: string;
  vocalType: string | null;
  overrideChara: { characterId: number; unit: string }[] | null;
  characters: { characterId: number; unit: string }[] | null;
  assetBundleName: string | null;
};

export type MusicDetail = {
  id: string;
  title: string;
  assetBundleName: string | null;
  categories: string[];
  composer: string | null;
  arranger: string | null;
  lyricist: string | null;
  publishedAt: string | number | null;
  creatorArtist: { name: string | null } | null;
  liveStage: { name: string | null } | null;
  releaseCondition: string | null;
  difficulties: MusicDifficulty[];
  vocals: MusicVocal[];
  fillerSec: number | null;
  tags: string[];
};
