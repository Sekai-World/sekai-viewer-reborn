type BannerGameCharacter = {
  id: number;
  firstName: string | null;
  givenName: string | null;
  unit: string | null;
  colorCode: string | null;
};

type EventDetail = {
  id: string;
  title: string;
  unit: string | null;
  unitName: string | null;
  eventType: string | null;
  eventPointIcon: string | null;
  bgmAssetbundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
  assetBundleName: string | null;
  bannerGameCharacter: BannerGameCharacter | null;
};

export type { BannerGameCharacter, EventDetail };
