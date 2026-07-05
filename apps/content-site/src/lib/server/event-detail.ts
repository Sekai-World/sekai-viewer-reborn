import type {
  BannerGameCharacter,
  EventBonuses,
  EventCardBonusLimit,
  EventDeckBonus,
  EventDetail,
  EventFeaturedCard,
  EventRewardHonor,
  EventRewardHonorGroup,
  EventRewardHonorLevel,
  EventMusic,
  EventRankingReward,
  EventRewardResourceBoxDetail,
  EventRankingRewardRange,
  EventRarityBonusRate,
  EventRelatedData,
  EventVirtualLive
} from "$lib/domain/event-detail";
import type { CardDetail } from "$lib/domain/card-detail";
import type { MusicDetail } from "$lib/domain/music-detail";

const getString = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

const getStringLike = (value: unknown): string | null => {
  const stringValue = getString(value);
  if (stringValue) {
    return stringValue;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const getDateValue = (value: unknown): string | number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return getString(value);
};

const getObject = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getNestedObject = (
  source: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> | null => {
  for (const key of keys) {
    const nested = getObject(source[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
};

const pickFirstString = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getString(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstStringLike = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = getStringLike(source[key]);
    if (value) {
      return value;
    }
  }

  return null;
};

const pickFirstDateValue = (
  source: Record<string, unknown>,
  keys: readonly string[]
): string | number | null => {
  for (const key of keys) {
    const value = getDateValue(source[key]);
    if (value !== null) {
      return value;
    }
  }

  return null;
};

const getNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getBoolean = (value: unknown): boolean | null => (typeof value === "boolean" ? value : null);

const getArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const parseBannerGameCharacter = (source: Record<string, unknown>): BannerGameCharacter | null => {
  const node = getObject(source["bannerGameCharacter"]);
  if (!node) {
    return null;
  }

  const id = getNumber(node["gameCharacterId"]);
  if (id === null) {
    return null;
  }

  return {
    id,
    firstName: getString(node["firstName"]),
    givenName: getString(node["givenName"]),
    unit: getString(node["unit"]),
    colorCode: getString(node["colorCode"])
  };
};

const parseVirtualLive = (source: Record<string, unknown>): EventVirtualLive | null => {
  const node = getObject(source["virtualLive"]);
  if (!node) {
    return null;
  }

  return {
    id: pickFirstStringLike(node, ["id", "virtualLiveId"]),
    name: pickFirstString(node, ["name", "virtualLiveName"]),
    virtualLiveType: pickFirstString(node, ["virtualLiveType", "virtual_live_type"]),
    assetBundleName: pickFirstString(node, ["assetbundleName", "assetBundleName"]),
    startAt: pickFirstDateValue(node, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(node, ["endAt", "end_at", "endDate"])
  };
};

const parseEventDeckBonus = (value: unknown): EventDeckBonus | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    gameCharacterUnitId: getNumber(node["gameCharacterUnitId"]),
    cardAttr: getString(node["cardAttr"]),
    bonusRate: getNumber(node["bonusRate"])
  };
};

const parseEventRarityBonusRate = (value: unknown): EventRarityBonusRate | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    cardRarityType: getString(node["cardRarityType"]),
    masterRank: getNumber(node["masterRank"]),
    bonusRate: getNumber(node["bonusRate"])
  };
};

const parseEventCardBonusLimit = (value: unknown): EventCardBonusLimit | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    memberCountLimit: getNumber(node["memberCountLimit"])
  };
};

const parseEventBonuses = (payload: unknown): EventBonuses | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  return {
    deckBonuses: getArray(root["eventDeckBonuses"]).flatMap((item) => {
      const bonus = parseEventDeckBonus(item);
      return bonus ? [bonus] : [];
    }),
    rarityBonusRates: getArray(root["eventRarityBonusRates"]).flatMap((item) => {
      const bonus = parseEventRarityBonusRate(item);
      return bonus ? [bonus] : [];
    }),
    cardBonusLimits: getArray(root["eventCardBonusLimits"]).flatMap((item) => {
      const limit = parseEventCardBonusLimit(item);
      return limit ? [limit] : [];
    }),
    honorBonusCount: getArray(root["eventHonorBonuses"]).length,
    mySekaiFixtureBonusLimitCount: getArray(
      root["eventMysekaiFixtureGameCharacterPerformanceBonusLimits"]
    ).length
  };
};

const parseFeaturedCard = (value: unknown): EventFeaturedCard | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    cardId: pickFirstStringLike(node, ["cardId"]),
    title: pickFirstString(node, ["title", "name", "prefix"]),
    assetBundleName: pickFirstString(node, ["assetbundleName", "assetBundleName"]),
    attr: pickFirstString(node, ["attr", "attribute"]),
    rarityType: pickFirstString(node, ["cardRarityType", "rarityType"]),
    initialSpecialTrainingStatus: pickFirstString(node, [
      "initialSpecialTrainingStatus",
      "specialTrainingStatus"
    ]),
    bonusRate: getNumber(node["bonusRate"]),
    leaderBonusRate: getNumber(node["leaderBonusRate"])
  };
};

const mergeFeaturedCardDetail = (
  eventCard: EventFeaturedCard,
  cardDetail: CardDetail | null
): EventFeaturedCard => ({
  ...eventCard,
  title: cardDetail?.title ?? eventCard.title,
  assetBundleName: cardDetail?.assetBundleName ?? eventCard.assetBundleName,
  attr: cardDetail?.attr ?? eventCard.attr,
  rarityType: cardDetail?.rarityType ?? eventCard.rarityType,
  initialSpecialTrainingStatus:
    cardDetail?.initialSpecialTrainingStatus ?? eventCard.initialSpecialTrainingStatus
});

const parseEventMusic = (value: unknown): EventMusic | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    musicId: pickFirstStringLike(node, ["musicId"]),
    title: pickFirstString(node, ["title", "name"]),
    assetBundleName: pickFirstString(node, ["assetbundleName", "assetBundleName"]),
    seq: getNumber(node["seq"])
  };
};

const mergeEventMusicDetail = (eventMusic: EventMusic, musicDetail: MusicDetail | null): EventMusic => ({
  ...eventMusic,
  title: musicDetail?.title ?? eventMusic.title,
  assetBundleName: musicDetail?.assetBundleName ?? eventMusic.assetBundleName
});

const parseRewardHonorLevel = (value: unknown): EventRewardHonorLevel | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    honorId: pickFirstStringLike(node, ["honorId"]),
    level: getNumber(node["level"]),
    honorRarity: getString(node["honorRarity"]),
    assetBundleName: pickFirstString(node, ["assetbundleName", "assetBundleName"])
  };
};

const parseRewardHonorGroup = (value: unknown): EventRewardHonorGroup | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: pickFirstStringLike(node, ["id"]),
    honorType: getString(node["honorType"]),
    backgroundAssetBundleName: pickFirstString(node, [
      "backgroundAssetbundleName",
      "backgroundAssetBundleName"
    ]),
    frameName: getString(node["frameName"])
  };
};

const parseRewardHonor = (value: unknown): EventRewardHonor | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    id: pickFirstStringLike(node, ["id"]),
    groupId: pickFirstStringLike(node, ["groupId"]),
    honorRarity: getString(node["honorRarity"]),
    honorMissionType: getString(node["honorMissionType"]),
    honorType: getString(node["honorType"]),
    assetBundleName: pickFirstString(node, ["assetbundleName", "assetBundleName"]),
    levels: getArray(node["levels"]).flatMap((item) => {
      const level = parseRewardHonorLevel(item);
      return level ? [level] : [];
    }),
    group: parseRewardHonorGroup(node["group"])
  };
};

const parseRewardResourceBoxDetail = (value: unknown): EventRewardResourceBoxDetail | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    resourceType: getString(node["resourceType"]),
    resourceId: pickFirstStringLike(node, ["resourceId"]),
    resourceLevel: getNumber(node["resourceLevel"]),
    resourceQuantity: getNumber(node["resourceQuantity"]),
    seq: getNumber(node["seq"]),
    honor: parseRewardHonor(node["honor"])
  };
};

const parseRankingReward = (value: unknown): EventRankingReward | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  const resourceBox = getObject(node["resourceBox"]);

  return {
    id: pickFirstStringLike(node, ["id"]),
    resourceBoxId: pickFirstStringLike(node, ["resourceBoxId"]),
    conditionValue: getNumber(node["conditionValue"]),
    rewardConditionType: getString(node["rewardConditionType"]),
    seq: getNumber(node["seq"]),
    resourceBoxPurpose: resourceBox ? getString(resourceBox["resourceBoxPurpose"]) : null,
    resourceBoxDetails: getArray(resourceBox?.["details"]).flatMap((item) => {
      const detail = parseRewardResourceBoxDetail(item);
      return detail ? [detail] : [];
    })
  };
};

const parseRewardRange = (value: unknown): EventRankingRewardRange | null => {
  const node = getObject(value);
  if (!node) {
    return null;
  }

  return {
    fromRank: getNumber(node["fromRank"]),
    toRank: getNumber(node["toRank"]),
    isToRankBorder: getBoolean(node["isToRankBorder"]),
    rewardCount: getArray(node["eventRankingRewards"]).length,
    rewards: getArray(node["eventRankingRewards"]).flatMap((item) => {
      const reward = parseRankingReward(item);
      return reward ? [reward] : [];
    })
  };
};

const parseItems = <T>(payload: unknown, parseItem: (value: unknown) => T | null): T[] => {
  const root = getObject(payload);
  const items = root ? getArray(root["items"]) : [];

  return items.flatMap((item) => {
    const parsed = parseItem(item);
    return parsed ? [parsed] : [];
  });
};

const parseEventRelatedData = ({
  bonusesPayload,
  cardsPayload,
  musicsPayload,
  rewardsPayload
}: {
  bonusesPayload: unknown;
  cardsPayload: unknown;
  musicsPayload: unknown;
  rewardsPayload: unknown;
}): EventRelatedData => ({
  bonuses: parseEventBonuses(bonusesPayload),
  cards: parseItems(cardsPayload, parseFeaturedCard),
  musics: parseItems(musicsPayload, parseEventMusic),
  rewardRanges: parseItems(rewardsPayload, parseRewardRange)
});

const parseEventDetail = (payload: unknown): EventDetail | null => {
  const root = getObject(payload);
  if (!root) {
    return null;
  }

  const eventNode = getNestedObject(root, ["event", "currentEvent", "data"]) ?? root;
  const unitNode = getNestedObject(eventNode, ["unit"]);
  const id = pickFirstStringLike(eventNode, ["id", "eventId"]);
  const title = pickFirstString(eventNode, ["name", "title", "eventName"]);

  if (!id || !title) {
    return null;
  }

  return {
    id,
    title,
    unit: pickFirstString(unitNode ?? eventNode, ["unit"]),
    unitName: pickFirstString(unitNode ?? eventNode, ["unitName", "unit"]) ?? null,
    eventType: pickFirstString(eventNode, ["eventType", "event_type"]),
    eventPointIcon: pickFirstString(eventNode, ["eventPointIcon", "event_point_icon"]),
    bgmAssetbundleName: pickFirstString(eventNode, [
      "bgmAssetbundleName",
      "bgm_assetbundle_name",
      "bgmAssetBundleName"
    ]),
    startAt: pickFirstDateValue(eventNode, ["startAt", "start_at", "startDate"]),
    endAt: pickFirstDateValue(eventNode, [
      "aggregateAt",
      "aggregate_at",
      "endAt",
      "end_at",
      "endDate"
    ]),
    assetBundleName: pickFirstString(eventNode, ["assetbundleName", "assetBundleName"]),
    bannerGameCharacter: parseBannerGameCharacter(eventNode),
    virtualLive: parseVirtualLive(eventNode)
  };
};

export type { EventDetail };
export {
  mergeEventMusicDetail,
  mergeFeaturedCardDetail,
  parseEventDetail,
  parseEventRelatedData
};
