export type GachaPickup = {
  cardId: string | null;
  weight: number | null;
};

export type GachaCardRarityRate = {
  cardRarityType: string | null;
  rate: number | null;
  lotteryType: string | null;
};

export type GachaBehavior = {
  id: string | null;
  gachaBehaviorType: string | null;
  gachaSpinnableType: string | null;
  costResourceType: string | null;
  costResourceQuantity: number | null;
  costResourceId: string | null;
  resourceCategory: string | null;
  spinCount: number | null;
  executeLimit: number | null;
  priority: number | null;
};

export type GachaDetailSub = {
  cardId: string | null;
  weight: number | null;
  isWish: boolean | null;
};

export type GachaInformation = {
  summary: string | null;
  description: string | null;
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
  gachaCardRarityRates: GachaCardRarityRate[];
  gachaBehaviors: GachaBehavior[];
  gachaDetails: GachaDetailSub[];
  gachaInformation: GachaInformation | null;
  gachaCeilItemId: string | null;
  wishFixedSelectCount: number | null;
  wishLimitedSelectCount: number | null;
  wishSelectCount: number | null;
  isShowPeriod: boolean | null;
};
