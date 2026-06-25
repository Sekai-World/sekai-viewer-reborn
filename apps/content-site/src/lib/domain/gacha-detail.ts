export type GachaPickup = {
  cardId: string | null;
  weight: number | null;
};

export type GachaDetail = {
  id: string;
  gachaType: string | null;
  name: string | null;
  assetBundleName: string | null;
  summary: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  costResourceType: string | null;
  costResourceId: string | null;
  costCount: number | null;
  gachaPickups: GachaPickup[];
};
