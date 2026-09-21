export type HonorGroupMetadata = {
  id: number | null;
  name: string | null;
  honorType: string | null;
  backgroundAssetBundleName: string | null;
  frameName: string | null;
};

export type HonorLevel = {
  assetBundleName: string | null;
  bonus: number | null;
  description: string | null;
  honorId: number | null;
  honorRarity: string | null;
  level: number | null;
};

export type Honor = {
  id: number;
  assetBundleName: string | null;
  group: HonorGroupMetadata | null;
  groupId: number | null;
  honorMissionType: string | null;
  honorRarity: string | null;
  honorType: string | null;
  honorTypeId: number | null;
  levels: HonorLevel[];
  name: string | null;
  seq: number | null;
};

export type HonorGroup = HonorGroupMetadata & {
  id: number;
  honors: Honor[];
};
