<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import { parseEventRewardRanges } from "$lib/domain/event-rewards";
  import {
    getCardThumbnailAssetURL,
    getCommonMaterialThumbnailURL,
    getMusicJacketAssetURL,
    getRemoteAssetEndpointURL,
    getVirtualLiveBannerAssetURL,
    type AssetServer
  } from "$lib/assets/index";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import type {
    EventDetail,
    EventFeaturedCard,
    EventMusic,
    EventRankingReward,
    EventRewardResourceBoxDetail,
    EventRankingRewardRange,
    EventRelatedData
  } from "$lib/domain/event-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import Icon from "@iconify/svelte";

  type SummaryItem = {
    key: string;
    value: string;
  };

  let {
    event,
    region,
    relatedData,
    displayLocale,
    bonusCharacterLabel,
    anyCharacterLabel,
    rarityBonusLabel,
    rarityLabel,
    featuredCardsTitle,
    featuredCardBonusLabel,
    featuredCardBonusShortLabel,
    leaderBonusLabel,
    leaderBonusShortLabel,
    cardIdLabel,
    imageUnavailableLabel,
    cardImageAltSuffix,
    musicJacketAltSuffix,
    masterRankLabel,
    cardAttrAnyLabel,
    bonusRateLabel,
    eventMusicsLabel,
    rankingRewardsTitle,
    rankingRewardTopLabel,
    rankingRewardBorderLabel,
    rankingRewardResourceBoxLabel,
    rankingRewardsShowMoreLabel,
    rankingRewardsShowLessLabel,
    virtualLiveTitle,
    noDataLabel,
    rankingRewardsLoadingLabel,
    rankingRewardsLoadErrorLabel
  }: {
    event: EventDetail;
    region: SupportedRegion;
    relatedData: EventRelatedData | null;
    displayLocale: string;
    bonusCharacterLabel: string;
    anyCharacterLabel: string;
    rarityBonusLabel: string;
    rarityLabel: string;
    featuredCardsTitle: string;
    featuredCardBonusLabel: string;
    featuredCardBonusShortLabel: string;
    leaderBonusLabel: string;
    leaderBonusShortLabel: string;
    cardIdLabel: string;
    imageUnavailableLabel: string;
    cardImageAltSuffix: string;
    musicJacketAltSuffix: string;
    masterRankLabel: string;
    cardAttrAnyLabel: string;
    bonusRateLabel: string;
    eventMusicsLabel: string;
    rankingRewardsTitle: string;
    rankingRewardTopLabel: string;
    rankingRewardBorderLabel: string;
    rankingRewardResourceBoxLabel: string;
    rankingRewardsShowMoreLabel: string;
    rankingRewardsShowLessLabel: string;
    virtualLiveTitle: string;
    noDataLabel: string;
    rankingRewardsLoadingLabel: string;
    rankingRewardsLoadErrorLabel: string;
  } = $props();

  let areAllRankingRewardsVisible = $state(false);
  let fullRewardRanges = $state<EventRankingRewardRange[] | null>(null);
  let rewardsLoading = $state(false);
  let rewardsLoadError = $state(false);
  let rewardStateKey = $state("");
  const displayRelatedData = $derived(
    relatedData && fullRewardRanges
      ? ({ ...relatedData, rewardRanges: fullRewardRanges } as EventRelatedData)
      : relatedData
  );
  $effect(() => {
    const key = `${region}:${event.id}`;
    if (rewardStateKey !== key) {
      rewardStateKey = key;
      fullRewardRanges = null;
      rewardsLoading = false;
      rewardsLoadError = false;
      areAllRankingRewardsVisible = false;
    }
  });
  const loadAllRewards = async (): Promise<void> => {
    if (fullRewardRanges) {
      areAllRankingRewardsVisible = true;
      return;
    }
    rewardsLoading = true;
    rewardsLoadError = false;
    try {
      const response = await fetch(`/event/${region}/${event.id}/rewards`);
      if (!response.ok) throw new Error("request failed");
      fullRewardRanges = parseEventRewardRanges(await response.json());
      areAllRankingRewardsVisible = true;
    } catch {
      rewardsLoadError = true;
    } finally {
      rewardsLoading = false;
    }
  };

  type BonusDeckEntry = {
    attr: string | null;
    bonusRate: number | null;
  };
  type BonusCharacterItem = {
    gameCharacterId: number | null;
    gameCharacterUnitId: number | null;
    unit: string | null;
    firstName: string | null;
    givenName: string | null;
    colorCode: string | null;
    baseBonusRate: number | null;
    attrBonuses: BonusDeckEntry[];
  };
  type HonorAssetFrame = {
    src: string;
    fallbackSrc: string | null;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  type HonorAssetVariant = "sub" | "main";
  type HonorAssetVariantConfig = {
    assetName: HonorAssetVariant;
    frameSize: "s" | "m";
    canvas: {
      width: number;
      height: number;
    };
    rarityOneFrame: {
      x: number;
      width: number;
    };
    overlay: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  type HonorAssetPreview = {
    config: HonorAssetVariantConfig;
    frame: HonorAssetFrame;
    baseSrc: string | null;
    overlaySrc: string | null;
    isFullBleedOverlay: boolean;
  };
  type HonorAssetPreviews = Record<HonorAssetVariant, HonorAssetPreview>;
  type RarityBonusRate = NonNullable<EventRelatedData["bonuses"]>["rarityBonusRates"][number];
  const honorPreviewCanvasHeight = 80;
  const honorAssetVariantConfigs = {
    sub: {
      assetName: "sub",
      frameSize: "s",
      canvas: { width: 180, height: honorPreviewCanvasHeight },
      rarityOneFrame: { x: 8, width: 164 },
      overlay: { x: 11, y: 40, width: 158, height: 40 }
    },
    main: {
      assetName: "main",
      frameSize: "m",
      canvas: { width: 380, height: honorPreviewCanvasHeight },
      rarityOneFrame: { x: 8, width: 364 },
      overlay: { x: 200, y: 0, width: 180, height: 78 }
    }
  } satisfies Record<HonorAssetVariant, HonorAssetVariantConfig>;
  const honorRarityNumber: Record<string, number> = { low: 1, middle: 2, high: 3, highest: 4 };
  const standardCardAttrs = ["cool", "cute", "happy", "mysterious", "pure"] as const;

  const formatPercent = (value: number | null): string | null =>
    value === null ? null : `${Number.isInteger(value) ? value.toString() : value.toFixed(1)}%`;

  const formatNumber = (value: number | null): string | null =>
    value === null ? null : new Intl.NumberFormat(displayLocale).format(value);

  const formatHashId = (value: string | null): string => (value ? `#${value}` : noDataLabel);
  const hideBrokenImage = (event: Event): void => {
    if (event.currentTarget instanceof HTMLImageElement) {
      event.currentTarget.hidden = true;
    } else if (event.currentTarget instanceof SVGImageElement) {
      const fallbackSrc = event.currentTarget.getAttribute("data-fallback-src");
      if (fallbackSrc && event.currentTarget.getAttribute("href") !== fallbackSrc) {
        event.currentTarget.setAttribute("href", fallbackSrc);
        event.currentTarget.removeAttribute("data-fallback-src");
        return;
      }

      event.currentTarget.style.display = "none";
    }
  };

  const rarityValueByType: Record<string, number> = {
    rarity_1: 1,
    rarity_2: 2,
    rarity_3: 3,
    rarity_4: 4,
    rarity_birthday: 1
  };

  const getRarityValue = (rarityType: string | null): number =>
    rarityType ? (rarityValueByType[rarityType] ?? 0) : 0;
  const isCardTrained = (card: EventFeaturedCard): boolean =>
    card.initialSpecialTrainingStatus === "done" || card.rarityType === "rarity_birthday";
  const getCardThumbnailSrc = (card: EventFeaturedCard): string | null =>
    card.assetBundleName
      ? getCardThumbnailAssetURL(card.assetBundleName, isCardTrained(card), "jp")
      : null;
  const getCardFallbackThumbnailSrc = (card: EventFeaturedCard): string | null =>
    card.assetBundleName && region !== "jp"
      ? getCardThumbnailAssetURL(card.assetBundleName, isCardTrained(card), region)
      : null;
  const getMusicJacketSrc = (music: EventMusic): string | null =>
    music.assetBundleName
      ? getMusicJacketAssetURL(music.assetBundleName, region as AssetServer)
      : null;
  const getVirtualLiveBannerSrc = (assetBundleName: string | null): string | null =>
    assetBundleName ? getVirtualLiveBannerAssetURL(assetBundleName, region as AssetServer) : null;
  const getCardHref = (card: EventFeaturedCard): string | null =>
    card.cardId ? resolve("/card/[region]/[id]", { region, id: card.cardId }) : null;
  const getMusicHref = (music: EventMusic): string | null =>
    music.musicId ? resolve("/music/[region]/[id]", { region, id: music.musicId }) : null;
  const getCardTitle = (card: EventFeaturedCard): string =>
    card.title ?? (card.cardId ? `${cardIdLabel} ${card.cardId}` : noDataLabel);
  const getMusicTitle = (music: EventMusic): string =>
    music.title ?? (music.musicId ? formatHashId(music.musicId) : noDataLabel);
  const getAttrIconUrl = (attr: string | null): string | null =>
    attr ? asset(`/card_attr/icon_attribute_${attr}.png`) : null;
  const getAnyAttrIconUrls = (excludedAttr: string | null): string[] =>
    standardCardAttrs
      .filter((attr) => attr !== excludedAttr)
      .map((attr) => asset(`/card_attr/icon_attribute_${attr}.png`));
  const getAttrLabel = (attr: string | null): string => attr ?? cardAttrAnyLabel;
  const getRarityLabel = (rarityType: string | null): string => {
    if (rarityType === "rarity_birthday") {
      return "Birthday";
    }

    const rarity = getRarityValue(rarityType);
    return rarity > 0 ? `★${rarity}` : (rarityType ?? noDataLabel);
  };
  const getRarityIconUrl = (rarityType: string | null): string | null => {
    if (rarityType === "rarity_birthday") {
      return asset("/card_rarity/rarity_birthday.png");
    }

    return getRarityValue(rarityType) > 0 ? asset("/card_rarity/rarity_star_normal.png") : null;
  };

  const getBonusCharacterIdentityKey = (
    item: Omit<BonusCharacterItem, "baseBonusRate" | "attrBonuses">
  ): string =>
    [
      item.gameCharacterId ?? "__any_character",
      item.gameCharacterUnitId ?? "__any_character_unit",
      item.givenName ?? "__any_given_name",
      item.firstName ?? "__any_first_name",
      item.unit ?? "__any_unit"
    ].join(":");

  const getBonusCharacterKey = (item: BonusCharacterItem): string =>
    getBonusCharacterIdentityKey(item);

  const getBonusCharacterName = (item: BonusCharacterItem): string | null => {
    const nameParts = [item.firstName, item.givenName].filter(
      (value, index, values): value is string => value !== null && values.indexOf(value) === index
    );

    return nameParts.length > 0 ? nameParts.join(" ") : null;
  };

  const getBonusDisplayName = (item: BonusCharacterItem): string =>
    getBonusCharacterName(item) ??
    (hasBonusCharacterData(item) ? bonusCharacterLabel : anyCharacterLabel);

  const hasBonusCharacterData = (item: BonusCharacterItem): boolean =>
    item.gameCharacterId !== null || getBonusCharacterName(item) !== null || item.unit !== null;

  const getBonusCharacterAccentColor = (item: BonusCharacterItem): `#${string}` | null => {
    const colorCode = item.colorCode?.trim();
    if (!colorCode) {
      return null;
    }

    if (/^#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(colorCode)) {
      return colorCode as `#${string}`;
    }

    if (/^[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?$/.test(colorCode)) {
      return `#${colorCode}`;
    }

    return null;
  };

  const getBonusCharacterIconSrc = (item: BonusCharacterItem): string | null =>
    item.gameCharacterId === null ? null : getLocalCharacterThumbnailAssetURL(item.gameCharacterId);

  const getBonusCharacterItems = (data: EventRelatedData | null): BonusCharacterItem[] => {
    return (data?.bonuses?.deckBonuses ?? []).reduce<BonusCharacterItem[]>((items, bonus) => {
      const nextItem = {
        gameCharacterId: bonus.gameCharacterId,
        gameCharacterUnitId: bonus.gameCharacterUnitId,
        unit: bonus.unit,
        firstName: bonus.firstName,
        givenName: bonus.givenName,
        colorCode: bonus.colorCode,
        baseBonusRate: bonus.cardAttr === null ? bonus.bonusRate : null,
        attrBonuses:
          bonus.cardAttr === null ? [] : [{ attr: bonus.cardAttr, bonusRate: bonus.bonusRate }]
      };
      const key = getBonusCharacterIdentityKey(nextItem);
      const currentIndex = items.findIndex((item) => getBonusCharacterIdentityKey(item) === key);
      const current = currentIndex >= 0 ? items[currentIndex] : null;
      if (!current) {
        return [...items, nextItem];
      }

      const nextBaseBonusRate =
        nextItem.baseBonusRate !== null &&
        (current.baseBonusRate === null || nextItem.baseBonusRate > current.baseBonusRate)
          ? nextItem.baseBonusRate
          : current.baseBonusRate;
      const nextAttrBonuses = nextItem.attrBonuses.reduce<BonusDeckEntry[]>((entries, entry) => {
        const entryIndex = entries.findIndex((existing) => existing.attr === entry.attr);
        const existing = entryIndex >= 0 ? entries[entryIndex] : null;
        if (!existing) {
          return [...entries, entry];
        }
        if ((entry.bonusRate ?? -Infinity) <= (existing.bonusRate ?? -Infinity)) {
          return entries;
        }
        return entries.map((existingEntry, index) =>
          index === entryIndex ? entry : existingEntry
        );
      }, current.attrBonuses);

      const updatedItem = {
        ...current,
        baseBonusRate: nextBaseBonusRate,
        attrBonuses: nextAttrBonuses.sort((left, right) =>
          getAttrLabel(left.attr).localeCompare(getAttrLabel(right.attr))
        )
      };

      return items.map((item, index) => (index === currentIndex ? updatedItem : item));
    }, []);
  };

  const getRaritySortValue = (rarityType: string | null): number =>
    rarityType === "rarity_birthday" ? 5 : getRarityValue(rarityType);

  const getRarityRows = (data: EventRelatedData | null): string[] =>
    Array.from(
      new Set<string>(
        (data?.bonuses?.rarityBonusRates ?? []).flatMap((bonus: RarityBonusRate) =>
          bonus.cardRarityType ? [bonus.cardRarityType] : []
        )
      )
    ).sort((left: string, right: string) => getRaritySortValue(left) - getRaritySortValue(right));

  const getMasterRankColumns = (data: EventRelatedData | null): number[] =>
    Array.from(
      new Set<number>(
        (data?.bonuses?.rarityBonusRates ?? []).flatMap((bonus: RarityBonusRate) =>
          bonus.masterRank === null ? [] : [bonus.masterRank]
        )
      )
    ).sort((left: number, right: number) => left - right);

  const getRarityBonusRate = (
    data: EventRelatedData | null,
    rarityType: string,
    masterRank: number
  ): number | null =>
    (data?.bonuses?.rarityBonusRates ?? []).find(
      (bonus: RarityBonusRate) =>
        bonus.cardRarityType === rarityType && bonus.masterRank === masterRank
    )?.bonusRate ?? null;

  const formatRankRange = (range: EventRankingRewardRange): string => {
    const fromRank = formatNumber(range.fromRank);
    const toRank = formatNumber(range.toRank);
    if (!fromRank && !toRank) {
      return noDataLabel;
    }

    if (fromRank && toRank && fromRank !== toRank) {
      return `#${fromRank} - #${toRank}`;
    }

    return `#${fromRank ?? toRank}`;
  };

  const hasResolvedRewardDetails = (reward: EventRankingReward): boolean =>
    reward.resourceBoxDetails.length > 0;
  const hasResolvedRewards = (range: EventRankingRewardRange): boolean =>
    range.rewards.some(hasResolvedRewardDetails);
  const getVisibleRewardRanges = (data: EventRelatedData | null): EventRankingRewardRange[] => {
    const sourceRanges =
      areAllRankingRewardsVisible && fullRewardRanges
        ? fullRewardRanges
        : (relatedData?.rewardRanges ?? data?.rewardRanges ?? []);

    return sourceRanges.filter(hasResolvedRewards);
  };

  const shouldShowRankingRewardToggle = (data: EventRelatedData | null): boolean =>
    data?.rewardRangesHasMore ?? false;

  const getRewardDetailKey = (detail: EventRewardResourceBoxDetail, index: number): string =>
    `${detail.resourceType ?? "resource"}-${detail.resourceId ?? "none"}-${detail.seq ?? index}`;
  const getRewardKey = (reward: EventRankingReward, index: number): string =>
    reward.id ?? reward.resourceBoxId ?? `${reward.seq ?? "reward"}-${index}`;
  const getRewardRangeKey = (range: EventRankingRewardRange, index: number): string =>
    `${range.fromRank ?? "from"}-${range.toRank ?? "to"}-${range.isToRankBorder === true ? "border" : "range"}-${index}`;
  const getFeaturedCardKey = (card: EventFeaturedCard, index: number): string =>
    card.cardId ?? card.assetBundleName ?? card.title ?? `card-${index}`;
  const getMusicKey = (music: EventMusic, index: number): string =>
    music.musicId ??
    music.seq?.toString() ??
    music.assetBundleName ??
    music.title ??
    `music-${index}`;
  const isHonorRewardDetail = (detail: EventRewardResourceBoxDetail): boolean =>
    detail.resourceType === "honor" || detail.resourceType === "bonds_honor";
  const getRewardDetailQuantity = (detail: EventRewardResourceBoxDetail): string | null =>
    formatNumber(detail.resourceQuantity);
  const getRewardDetailLabel = (detail: EventRewardResourceBoxDetail): string => {
    const typeLabel = detail.resourceType?.replaceAll("_", " ") ?? noDataLabel;
    const idLabel = detail.resourceId ? ` #${detail.resourceId}` : "";
    const levelLabel =
      detail.resourceLevel !== null ? ` Lv.${formatNumber(detail.resourceLevel)}` : "";
    return `${typeLabel}${idLabel}${levelLabel}`;
  };
  const getHonorLevelAssetBundleName = (detail: EventRewardResourceBoxDetail): string | null => {
    const honor = detail.honor;
    if (!honor) {
      return null;
    }

    if (honor.assetBundleName) {
      return honor.assetBundleName;
    }

    const matchingLevel = honor.levels.find((level) => level.level === detail.resourceLevel);
    if (matchingLevel?.assetBundleName) {
      return matchingLevel.assetBundleName;
    }

    return honor.levels.find((level) => level.assetBundleName)?.assetBundleName ?? null;
  };
  const getHonorFrameGeometry = (
    rarityNumber: number,
    config: HonorAssetVariantConfig
  ): Omit<HonorAssetFrame, "src" | "fallbackSrc"> =>
    rarityNumber === 1
      ? {
          x: config.rarityOneFrame.x,
          y: 0,
          width: config.rarityOneFrame.width,
          height: config.canvas.height
        }
      : { x: 0, y: 0, width: config.canvas.width, height: config.canvas.height };
  const getHonorAssetPreview = (
    detail: EventRewardResourceBoxDetail,
    config: HonorAssetVariantConfig
  ): HonorAssetPreview | null => {
    const honor = detail.honor;
    if (!isHonorRewardDetail(detail) || !honor) {
      return null;
    }

    const assetRegion = region as AssetServer;
    const honorType = honor.group?.honorType ?? honor.honorType;
    const assetBundleName = getHonorLevelAssetBundleName(detail);
    const backgroundAssetBundleName = honor.group?.backgroundAssetBundleName ?? assetBundleName;
    const rarity =
      honor.honorRarity ??
      honor.levels.find((level) => level.level === detail.resourceLevel)?.honorRarity ??
      honor.levels.find((level) => level.honorRarity)?.honorRarity ??
      "low";
    const rarityNumber = honorRarityNumber[rarity] ?? 1;
    const frameName = honor.group?.frameName;

    const defaultFrameSrc = asset(`/degree/frame_degree_${config.frameSize}_${rarityNumber}.png`);
    let frameSrc = defaultFrameSrc;
    let frameFallbackSrc: string | null = null;
    if (
      frameName &&
      (rarity === "highest" ||
        rarity === "high" ||
        (honorType === "birthday" && rarity === "middle"))
    ) {
      frameSrc = getRemoteAssetEndpointURL(
        `honor_frame/${frameName}/frame_degree_${config.frameSize}_${rarityNumber}.webp`,
        assetRegion
      );
      frameFallbackSrc = defaultFrameSrc;
    }

    let baseSrc: string | null = null;
    if (honorType === "rank_match" && backgroundAssetBundleName) {
      baseSrc = getRemoteAssetEndpointURL(
        `rank_live/honor/${backgroundAssetBundleName}/degree_${config.assetName}.webp`,
        assetRegion
      );
    } else if (backgroundAssetBundleName) {
      baseSrc = getRemoteAssetEndpointURL(
        `honor/${backgroundAssetBundleName}/degree_${config.assetName}.webp`,
        assetRegion
      );
    }

    let overlaySrc: string | null = null;
    if ((honorType === "event" || honorType === "event_point") && assetBundleName) {
      overlaySrc = getRemoteAssetEndpointURL(
        `honor/${assetBundleName}/rank_${config.assetName}.webp`,
        assetRegion
      );
    } else if (honorType === "rank_match" && assetBundleName) {
      overlaySrc = getRemoteAssetEndpointURL(
        `rank_live/honor/${assetBundleName}/${config.assetName}.webp`,
        assetRegion
      );
    } else if (honor.honorMissionType && assetBundleName) {
      overlaySrc = getRemoteAssetEndpointURL(`honor/${assetBundleName}/scroll.webp`, assetRegion);
    }

    const isFullBleedOverlay = assetBundleName ? /_cp\d+$/.test(assetBundleName) : false;

    return {
      config,
      baseSrc,
      frame: {
        src: frameSrc,
        ...getHonorFrameGeometry(rarityNumber, config),
        fallbackSrc: frameFallbackSrc
      },
      overlaySrc,
      isFullBleedOverlay
    };
  };
  const getHonorAssetPreviews = (
    detail: EventRewardResourceBoxDetail
  ): HonorAssetPreviews | null => {
    const sub = getHonorAssetPreview(detail, honorAssetVariantConfigs.sub);
    const main = getHonorAssetPreview(detail, honorAssetVariantConfigs.main);

    return sub && main ? { sub, main } : null;
  };
  const getRewardDetailImageSrc = (detail: EventRewardResourceBoxDetail): string | null => {
    if (!detail.resourceType) {
      return null;
    }

    if (detail.resourceType === "material" && detail.resourceId) {
      return getRemoteAssetEndpointURL(
        `thumbnail/material/material${detail.resourceId}.webp`,
        region as AssetServer
      );
    }

    if (
      ["coin", "ingamevoice", "jewel", "live_point", "slot", "virtual_coin"].includes(
        detail.resourceType
      )
    ) {
      return getCommonMaterialThumbnailURL(detail.resourceType, region as AssetServer);
    }

    if (detail.resourceType === "paid_jewel") {
      return getCommonMaterialThumbnailURL("jewel", region as AssetServer);
    }

    if (detail.resourceType === "skill_practice_ticket" && detail.resourceId) {
      return getRemoteAssetEndpointURL(
        `thumbnail/skill_practice_ticket/ticket${detail.resourceId}.webp`,
        region as AssetServer
      );
    }

    if (detail.resourceType === "gacha_ticket" && detail.resourceId) {
      return getRemoteAssetEndpointURL(
        `thumbnail/gacha_ticket/${detail.resourceId}.webp`,
        region as AssetServer
      );
    }

    if (detail.resourceType === "boost_item" && detail.resourceId) {
      return getRemoteAssetEndpointURL(
        `thumbnail/boost_item/boost_item${detail.resourceId}.webp`,
        region as AssetServer
      );
    }

    return null;
  };
  const getRewardDetailFallbackIcon = (detail: EventRewardResourceBoxDetail): string => {
    if (detail.resourceType === "stamp") {
      return "mdi:text-box-outline";
    }

    if (detail.resourceType === "honor" || detail.resourceType === "bonds_honor") {
      return "mdi:card-account-details-outline";
    }

    if (detail.resourceType === "gacha_ticket") {
      return "mdi:ticket-outline";
    }

    return "mdi:gift-outline";
  };
  const getVirtualLiveItems = (currentEvent: EventDetail): SummaryItem[] => {
    if (!currentEvent.virtualLive) {
      return [];
    }

    return [
      {
        key: "period",
        value: `${formatDisplayDateTime(currentEvent.virtualLive.startAt, displayLocale)} - ${formatDisplayDateTime(currentEvent.virtualLive.endAt, displayLocale)}`
      }
    ];
  };
</script>

{#snippet rewardDetailChip(detail: EventRewardResourceBoxDetail, _index: number)}
  {@const imageSrc = getRewardDetailImageSrc(detail)}
  <span
    class="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-base-content/20 bg-base-100/80 px-2.5 py-1.5 text-xs font-semibold text-base-content"
    title={getRewardDetailLabel(detail)}
    aria-label={getRewardDetailLabel(detail)}
  >
    {#if imageSrc}
      <img
        src={imageSrc}
        alt=""
        class="size-6 shrink-0 object-contain"
        loading="lazy"
        decoding="async"
        onerror={hideBrokenImage}
      />
    {:else}
      <Icon
        icon={getRewardDetailFallbackIcon(detail)}
        class="size-4 shrink-0 opacity-70"
        aria-hidden="true"
      />
    {/if}
    {#if getRewardDetailQuantity(detail)}
      <span class="shrink-0 text-primary">×{getRewardDetailQuantity(detail)}</span>
    {/if}
  </span>
{/snippet}

{#snippet honorRewardDetail(detail: EventRewardResourceBoxDetail)}
  {@const honorPreviews = getHonorAssetPreviews(detail)}
  {#if honorPreviews}
    <span
      class="inline-flex shrink-0"
      title={getRewardDetailLabel(detail)}
      aria-label={getRewardDetailLabel(detail)}
    >
      <span class="block h-10 sm:hidden" aria-hidden="true">
        {@render honorAssetPreview(honorPreviews.sub)}
      </span>
      <span class="hidden h-12 sm:block" aria-hidden="true">
        {@render honorAssetPreview(honorPreviews.main)}
      </span>
    </span>
  {:else}
    <span
      class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-base-content/20 bg-base-100/80 px-2.5 py-1.5 text-xs font-semibold text-base-content"
      title={getRewardDetailLabel(detail)}
      aria-label={getRewardDetailLabel(detail)}
    >
      <Icon
        icon={getRewardDetailFallbackIcon(detail)}
        class="size-4 shrink-0 opacity-70"
        aria-hidden="true"
      />
    </span>
  {/if}
{/snippet}

{#snippet honorAssetPreview(honorPreview: HonorAssetPreview)}
  <svg
    class="block h-full max-w-full w-auto"
    viewBox={`0 0 ${honorPreview.config.canvas.width} ${honorPreview.config.canvas.height}`}
  >
    {#if honorPreview.baseSrc}
      <image
        href={honorPreview.baseSrc}
        x="0"
        y="0"
        width={honorPreview.config.canvas.width}
        height={honorPreview.config.canvas.height}
        preserveAspectRatio="none"
        onerror={hideBrokenImage}
      />
    {/if}
    <image
      href={honorPreview.frame.src}
      x={honorPreview.frame.x}
      y={honorPreview.frame.y}
      width={honorPreview.frame.width}
      height={honorPreview.frame.height}
      preserveAspectRatio="none"
      data-fallback-src={honorPreview.frame.fallbackSrc}
      onerror={hideBrokenImage}
    />
    {#if honorPreview.overlaySrc}
      {#if honorPreview.isFullBleedOverlay}
        <image
          href={honorPreview.overlaySrc}
          x="0"
          y="0"
          width={honorPreview.config.canvas.width}
          height={honorPreview.config.canvas.height}
          preserveAspectRatio="none"
          onerror={hideBrokenImage}
        />
      {:else}
        <image
          href={honorPreview.overlaySrc}
          x={honorPreview.config.overlay.x}
          y={honorPreview.config.overlay.y}
          width={honorPreview.config.overlay.width}
          height={honorPreview.config.overlay.height}
          preserveAspectRatio="none"
          onerror={hideBrokenImage}
        />
      {/if}
    {/if}
  </svg>
{/snippet}

{#snippet bonusCharacterPanel(item: BonusCharacterItem)}
  {@const displayName = getBonusDisplayName(item)}
  {@const characterAccentColor = getBonusCharacterAccentColor(item)}
  {@const characterIconSrc = getBonusCharacterIconSrc(item)}
  {@const isCharacterBonus = hasBonusCharacterData(item)}
  <div
    class="content-card-inset grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-3"
  >
    <div class="flex justify-center">
      {#if isCharacterBonus}
        <CharacterAvatar
          src={characterIconSrc}
          label={displayName}
          accentColor={characterAccentColor}
          characterId={item.gameCharacterId}
          variant="sm"
          onImageError={hideBrokenImage}
        />
      {:else}
        <CharacterAvatar src={null} label="?" variant="sm" />
      {/if}
    </div>
    <div class="min-w-0">
      <p class="truncate text-sm font-semibold text-base-content">{displayName}</p>
      <div class="mt-1 flex min-h-7 items-center gap-1.5">
        {#if item.unit}
          <UnitIconBadge
            unit={item.unit}
            fallbackLabel={item.unit}
            mapNoneToPiapro={true}
            variant="sm"
          />
        {/if}
      </div>
    </div>
    <div class="flex min-w-0 shrink-0 flex-col items-end gap-1.5">
      {#if item.baseBonusRate !== null}
        {@const highlightedAttr = item.attrBonuses[0]?.attr ?? null}
        <span
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-base-content/20 bg-base-100/80 px-2 py-1 text-xs/4 font-semibold text-base-content"
          title={`${cardAttrAnyLabel} ${bonusRateLabel} ${formatPercent(item.baseBonusRate) ?? noDataLabel}`}
        >
          <span class="flex items-center -space-x-1" aria-label={cardAttrAnyLabel}>
            {#each getAnyAttrIconUrls(highlightedAttr) as iconUrl (iconUrl)}
              <img
                src={iconUrl}
                alt=""
                class="size-4 shrink-0 rounded-full bg-base-100 object-contain ring-1 ring-base-100"
                loading="lazy"
                decoding="async"
                aria-hidden="true"
              />
            {/each}
          </span>
          <span>{formatPercent(item.baseBonusRate) ?? noDataLabel}</span>
        </span>
      {/if}
      {#each item.attrBonuses as attrBonus (`${attrBonus.attr ?? "any"}-${attrBonus.bonusRate ?? "none"}`)}
        {@const attrIconUrl = getAttrIconUrl(attrBonus.attr)}
        <span
          class="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-xs/4 font-semibold text-primary"
          title={`${getAttrLabel(attrBonus.attr)} ${bonusRateLabel} ${formatPercent(attrBonus.bonusRate) ?? noDataLabel}`}
        >
          {#if attrIconUrl}
            <img
              src={attrIconUrl}
              alt=""
              class="size-4 shrink-0 object-contain"
              loading="lazy"
              decoding="async"
              aria-hidden="true"
            />
          {/if}
          <span>{formatPercent(attrBonus.bonusRate) ?? noDataLabel}</span>
        </span>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet rarityIconLabel(rarityType: string)}
  {@const rarityIconUrl = getRarityIconUrl(rarityType)}
  <span class="flex min-w-16 items-center gap-0.5" aria-label={getRarityLabel(rarityType)}>
    {#if rarityIconUrl && rarityType === "rarity_birthday"}
      <img
        src={rarityIconUrl}
        alt={getRarityLabel(rarityType)}
        class="size-5 object-contain"
        loading="lazy"
        decoding="async"
      />
    {:else if rarityIconUrl}
      {#each Array.from({ length: getRarityValue(rarityType) }, (_, index) => index) as index (index)}
        <img
          src={rarityIconUrl}
          alt={index === 0 ? getRarityLabel(rarityType) : ""}
          class="size-4 object-contain"
          loading="lazy"
          decoding="async"
        />
      {/each}
    {:else}
      <span class="text-sm font-semibold">{getRarityLabel(rarityType)}</span>
    {/if}
  </span>
{/snippet}

{#snippet cardBonusBadges(card: EventFeaturedCard)}
  <span
    class="inline-flex max-w-full items-center rounded-full border border-base-content/20 bg-base-100/80 px-1.5 py-0.5 text-[11px]/4 font-semibold text-base-content sm:px-2"
    title={`${featuredCardBonusLabel}: +${formatPercent(card.bonusRate) ?? noDataLabel}`}
  >
    {featuredCardBonusShortLabel}: +{formatPercent(card.bonusRate) ?? noDataLabel}
  </span>
  {#if card.leaderBonusRate !== null}
    <span
      class="inline-flex max-w-full items-center rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[11px]/4 font-semibold text-primary sm:px-2"
      title={`${leaderBonusLabel}: +${formatPercent(card.leaderBonusRate) ?? noDataLabel}`}
    >
      {leaderBonusShortLabel}: +{formatPercent(card.leaderBonusRate) ?? noDataLabel}
    </span>
  {/if}
{/snippet}

{#snippet featuredCardPanel(card: EventFeaturedCard)}
  {@const href = getCardHref(card)}
  {@const content = card}
  {#if href}
    <a
      {href}
      class="content-card-inset group grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-3 transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-base-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
    >
      <CardThumbnail
        src={getCardThumbnailSrc(content)}
        fallbackSrc={getCardFallbackThumbnailSrc(content)}
        alt={`${getCardTitle(content)} ${cardImageAltSuffix}`}
        fallbackLabel={imageUnavailableLabel}
        trained={isCardTrained(content)}
        attr={content.attr}
        rarityType={content.rarityType}
        rarityCount={getRarityValue(content.rarityType)}
        loadMode="visible"
        maxSize={72}
        containerClass="relative overflow-hidden rounded-lg bg-base-200 aspect-square"
      />
      <div class="min-w-0 self-center">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {formatHashId(content.cardId)}
        </p>
        <p class="mt-1 line-clamp-2 text-sm font-semibold group-hover:text-primary">
          {getCardTitle(content)}
        </p>
      </div>
      <div class="flex min-w-0 shrink-0 flex-col items-end gap-1">
        {@render cardBonusBadges(content)}
      </div>
    </a>
  {:else}
    <div
      class="content-card-inset grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-3"
    >
      <CardThumbnail
        src={getCardThumbnailSrc(content)}
        fallbackSrc={getCardFallbackThumbnailSrc(content)}
        alt={`${getCardTitle(content)} ${cardImageAltSuffix}`}
        fallbackLabel={imageUnavailableLabel}
        trained={isCardTrained(content)}
        attr={content.attr}
        rarityType={content.rarityType}
        rarityCount={getRarityValue(content.rarityType)}
        loadMode="visible"
        maxSize={48}
        containerClass="relative overflow-hidden rounded-lg bg-base-200 aspect-square"
      />
      <div class="min-w-0 self-center">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {formatHashId(content.cardId)}
        </p>
        <p class="mt-1 line-clamp-2 text-sm font-semibold">{getCardTitle(content)}</p>
      </div>
      <div class="flex min-w-0 shrink-0 flex-col items-end gap-1.5">
        {@render cardBonusBadges(content)}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet musicPanel(music: EventMusic)}
  {@const href = getMusicHref(music)}
  {@const content = music}
  {#if href}
    {@const jacketSrc = getMusicJacketSrc(content)}
    <a
      {href}
      class="content-card-inset group grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-xl p-3 transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-base-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <div class="aspect-square overflow-hidden rounded-lg bg-base-200">
        {#if jacketSrc}
          <EventAssetImage
            src={jacketSrc}
            alt={`${getMusicTitle(content)} ${musicJacketAltSuffix}`}
            imageClass="h-full w-full object-cover"
            fallbackLabel={imageUnavailableLabel}
            loadMode="visible"
          />
        {:else}
          <div class="flex size-full items-center justify-center text-base-content/55">
            <Icon icon="mdi:music-off" class="size-8" aria-hidden="true" />
          </div>
        {/if}
      </div>
      <div class="min-w-0 self-center">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {formatHashId(content.musicId)}
        </p>
        <p class="mt-1 line-clamp-2 text-sm font-semibold group-hover:text-primary">
          {getMusicTitle(content)}
        </p>
      </div>
    </a>
  {:else}
    {@const jacketSrc = getMusicJacketSrc(content)}
    <div class="content-card-inset grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 rounded-xl p-3">
      <div class="aspect-square overflow-hidden rounded-lg bg-base-200">
        {#if jacketSrc}
          <EventAssetImage
            src={jacketSrc}
            alt={`${getMusicTitle(content)} ${musicJacketAltSuffix}`}
            imageClass="h-full w-full object-cover"
            fallbackLabel={imageUnavailableLabel}
            loadMode="visible"
          />
        {:else}
          <div class="flex size-full items-center justify-center text-base-content/55">
            <Icon icon="mdi:music-off" class="size-8" aria-hidden="true" />
          </div>
        {/if}
      </div>
      <div class="min-w-0 self-center">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {formatHashId(content.musicId)}
        </p>
        <p class="mt-1 line-clamp-2 text-sm font-semibold">{getMusicTitle(content)}</p>
      </div>
    </div>
  {/if}
{/snippet}

{#snippet rankingRewardRangePanel(range: EventRankingRewardRange)}
  <div class="content-card-inset rounded-xl p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="text-sm font-semibold">{formatRankRange(range)}</p>
      <div class="flex flex-wrap gap-1.5">
        {#if range.fromRank !== null && range.fromRank <= 1000}
          <span
            class="badge badge-sm border-base-content/20 bg-base-100/80 font-semibold text-base-content"
          >
            {rankingRewardTopLabel}
          </span>
        {/if}
        {#if range.isToRankBorder === true || (range.fromRank !== null && range.fromRank > 1000)}
          <span
            class="badge badge-sm border-base-content/20 bg-base-100/80 font-semibold text-base-content"
          >
            {rankingRewardBorderLabel}
          </span>
        {/if}
      </div>
    </div>
    {#if range.rewards.length > 0}
      <div class="mt-3 grid gap-2">
        {#each range.rewards.filter(hasResolvedRewardDetails) as reward, rewardIndex (getRewardKey(reward, rewardIndex))}
          {@const honorDetails = reward.resourceBoxDetails.filter(isHonorRewardDetail)}
          {@const regularDetails = reward.resourceBoxDetails.filter(
            (detail) => !isHonorRewardDetail(detail)
          )}
          <div class="flex flex-wrap items-center gap-2">
            {#each honorDetails as detail, detailIndex (getRewardDetailKey(detail, detailIndex))}
              {@render honorRewardDetail(detail)}
            {/each}
            {#if regularDetails.length > 0}
              {#each regularDetails as detail, detailIndex (getRewardDetailKey(detail, detailIndex))}
                {@render rewardDetailChip(detail, detailIndex)}
              {/each}
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <p class="mt-3 text-sm opacity-70">{noDataLabel}</p>
    {/if}
  </div>
{/snippet}

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <section class="space-y-2" aria-labelledby="event-bonus-character-title">
      <h2 id="event-bonus-character-title" class="flex items-center gap-2 text-sm font-semibold">
        <Icon icon="mdi:cards-outline" class="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span>{bonusCharacterLabel}</span>
      </h2>
      {#if getBonusCharacterItems(relatedData).length > 0}
        <div class="grid gap-2 sm:grid-cols-2">
          {#each getBonusCharacterItems(relatedData) as item (getBonusCharacterKey(item))}
            {@render bonusCharacterPanel(item)}
          {/each}
        </div>
      {:else}
        <p class="content-card-inset rounded-xl p-3 text-sm opacity-70">{noDataLabel}</p>
      {/if}
    </section>

    <section class="space-y-2" aria-labelledby="event-rarity-bonus-title">
      <h2 id="event-rarity-bonus-title" class="flex items-center gap-2 text-sm font-semibold">
        <Icon icon="mdi:chart-box-outline" class="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span>{rarityBonusLabel}</span>
      </h2>
      {#if (relatedData?.bonuses?.rarityBonusRates.length ?? 0) > 0}
        <div class="content-card-inset overflow-x-auto rounded-xl">
          <table class="table table-sm">
            <thead>
              <tr>
                <th class="w-20">{rarityLabel}</th>
                {#each getMasterRankColumns(relatedData) as masterRank (masterRank)}
                  <th class="text-right">{masterRankLabel} {formatNumber(masterRank)}</th>
                {/each}
              </tr>
            </thead>
            <tbody>
              {#each getRarityRows(relatedData) as rarityType (rarityType)}
                <tr>
                  <th>{@render rarityIconLabel(rarityType)}</th>
                  {#each getMasterRankColumns(relatedData) as masterRank (masterRank)}
                    <td class="text-right font-semibold text-primary">
                      {formatPercent(getRarityBonusRate(relatedData, rarityType, masterRank)) ??
                        "—"}
                    </td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="content-card-inset rounded-xl p-3 text-sm opacity-70">{noDataLabel}</p>
      {/if}
    </section>
  </div>
</article>

<article class="card content-card-shell shadow-sm">
  <section class="card-body gap-4 p-3 sm:p-5" aria-labelledby="event-featured-cards-title">
    <h2 id="event-featured-cards-title" class="flex items-center gap-2 text-sm font-semibold">
      <Icon icon="mdi:cards-outline" class="size-4 shrink-0 opacity-70" aria-hidden="true" />
      <span>{featuredCardsTitle}</span>
    </h2>
    {#if (relatedData?.cards.length ?? 0) > 0}
      <div class="grid gap-2 lg:grid-cols-2 2xl:grid-cols-3">
        {#each relatedData?.cards ?? [] as card, cardIndex (getFeaturedCardKey(card, cardIndex))}
          {@render featuredCardPanel(card)}
        {/each}
      </div>
    {:else}
      <p class="content-card-inset rounded-xl p-3 text-sm opacity-70">{noDataLabel}</p>
    {/if}
  </section>
</article>

<article class="card content-card-shell shadow-sm">
  <section class="card-body gap-4 p-3 sm:p-5" aria-labelledby="event-musics-title">
    <h2 id="event-musics-title" class="flex items-center gap-2 text-sm font-semibold">
      <Icon icon="mdi:music-note-outline" class="size-4 shrink-0 opacity-70" aria-hidden="true" />
      <span>{eventMusicsLabel}</span>
    </h2>
    {#if (relatedData?.musics.length ?? 0) > 0}
      <div class="grid gap-2">
        {#each relatedData?.musics ?? [] as music, musicIndex (getMusicKey(music, musicIndex))}
          {@render musicPanel(music)}
        {/each}
      </div>
    {:else}
      <p class="content-card-inset rounded-xl p-3 text-sm opacity-70">{noDataLabel}</p>
    {/if}
  </section>
</article>

<article class="card content-card-shell shadow-sm">
  <section class="card-body gap-4 p-3 sm:p-5" aria-labelledby="event-ranking-rewards-title">
    <h2 id="event-ranking-rewards-title" class="flex items-center gap-2 text-sm font-semibold">
      <Icon icon="mdi:gift-outline" class="size-4 shrink-0 opacity-70" aria-hidden="true" />
      <span>{rankingRewardsTitle}</span>
    </h2>
    {#if (displayRelatedData?.rewardRanges.length ?? 0) > 0}
      <div class="grid gap-2">
        {#each getVisibleRewardRanges(displayRelatedData) as range, rangeIndex (getRewardRangeKey(range, rangeIndex))}
          {@render rankingRewardRangePanel(range)}
        {/each}
      </div>
      {#if shouldShowRankingRewardToggle(displayRelatedData)}
        <button
          type="button"
          class="btn btn-outline btn-sm border-base-content/20 text-primary"
          disabled={rewardsLoading}
          onclick={() =>
            areAllRankingRewardsVisible
              ? (areAllRankingRewardsVisible = false)
              : void loadAllRewards()}
        >
          {#if rewardsLoading}
            <span class="loading loading-spinner loading-xs"></span>
            {rankingRewardsLoadingLabel}
          {:else}
            {areAllRankingRewardsVisible ? rankingRewardsShowLessLabel : rankingRewardsShowMoreLabel}
          {/if}
        </button>
      {/if}
      {#if rewardsLoadError}
        <p class="text-sm text-error">{rankingRewardsLoadErrorLabel}</p>
      {/if}
    {:else}
      <p class="content-card-inset rounded-xl p-3 text-sm opacity-70">{noDataLabel}</p>
    {/if}
  </section>
</article>

{#if event.virtualLive}
  {@const virtualLive = event.virtualLive}
  {@const virtualLiveBannerSrc = getVirtualLiveBannerSrc(virtualLive.assetBundleName)}
  <article class="card content-card-shell shadow-sm">
    <section class="card-body gap-2 p-3 sm:p-4" aria-labelledby="event-virtual-live-title">
      <h2 id="event-virtual-live-title" class="flex items-center gap-2 text-sm font-semibold">
        <Icon icon="mdi:account-voice" class="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span>{virtualLiveTitle}</span>
      </h2>
      <div class="content-card-inset @container rounded-xl p-2.5 sm:p-3">
        <div
          class={`grid gap-2 ${virtualLiveBannerSrc ? "@md:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)] @md:items-center" : ""}`}
        >
          {#if virtualLiveBannerSrc}
            <div class="aspect-33/10 overflow-hidden rounded-lg bg-base-200 @md:aspect-33/14">
              <EventAssetImage
                src={virtualLiveBannerSrc}
                alt={virtualLive.name ?? virtualLiveTitle}
                imageClass="h-full w-full object-contain"
                fallbackLabel={imageUnavailableLabel}
                buttonClass="block h-full w-full overflow-hidden"
              />
            </div>
          {/if}
          <div class="min-w-0">
            <p class="line-clamp-2 text-sm/5 font-semibold">
              {virtualLive.name ?? virtualLiveTitle}
            </p>
            <div class="mt-1.5 grid gap-1.5">
              {#each getVirtualLiveItems(event) as item (item.key)}
                <p
                  class="min-w-0 wrap-break-word rounded-lg bg-base-100/70 px-2 py-1.5 text-xs/4 font-medium"
                >
                  {item.value}
                </p>
              {/each}
            </div>
          </div>
        </div>
      </div>
    </section>
  </article>
{/if}
