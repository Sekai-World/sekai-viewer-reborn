<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import {
    getCardThumbnailAssetURL,
    getCommonMaterialThumbnailURL,
    getMusicJacketAssetURL,
    getRemoteAssetEndpointURL,
    getVirtualLiveBannerAssetURL,
    type AssetServer
  } from "$lib/assets/index";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
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
    label: string;
    value: string;
  };

  let {
    event,
    region,
    relatedData,
    displayLocale,
    attrBonusLabel,
    rarityBonusLabel,
    rarityLabel,
    featuredCardsTitle,
    featuredCardBonusLabel,
    leaderBonusLabel,
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
    virtualLiveTypeLabel,
    virtualLiveStartLabel,
    virtualLiveEndLabel,
    noDataLabel
  }: {
    event: EventDetail;
    region: SupportedRegion;
    relatedData: EventRelatedData | null;
    displayLocale: string;
    attrBonusLabel: string;
    rarityBonusLabel: string;
    rarityLabel: string;
    featuredCardsTitle: string;
    featuredCardBonusLabel: string;
    leaderBonusLabel: string;
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
    virtualLiveTypeLabel: string;
    virtualLiveStartLabel: string;
    virtualLiveEndLabel: string;
    noDataLabel: string;
  } = $props();

  let areAllRankingRewardsVisible = $state(false);

  type AttributeBonusItem = {
    attr: string | null;
    bonusRate: number | null;
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
  const rankingRewardPreviewLimit = 5;
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
    music.assetBundleName ? getMusicJacketAssetURL(music.assetBundleName, region as AssetServer) : null;
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

  const getAttributeBonusKey = (attr: string | null): string => attr ?? "__any";
  const getAttributeBonusItems = (data: EventRelatedData | null): AttributeBonusItem[] => {
    return (data?.bonuses?.deckBonuses ?? []).reduce<AttributeBonusItem[]>((items, bonus) => {
      const key = getAttributeBonusKey(bonus.cardAttr);
      const currentIndex = items.findIndex((item) => getAttributeBonusKey(item.attr) === key);
      const current = currentIndex >= 0 ? items[currentIndex] : null;
      if (!current || (bonus.bonusRate ?? -Infinity) > (current.bonusRate ?? -Infinity)) {
        const nextItem = { attr: bonus.cardAttr, bonusRate: bonus.bonusRate };
        return currentIndex >= 0
          ? items.map((item, index) => (index === currentIndex ? nextItem : item))
          : [...items, nextItem];
      }

      return items;
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
      (bonus: RarityBonusRate) => bonus.cardRarityType === rarityType && bonus.masterRank === masterRank
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

  const isPreviewRewardRange = (range: EventRankingRewardRange): boolean =>
    range.isToRankBorder === true || (range.fromRank !== null && range.fromRank <= 1000);

  const getPreviewRewardRanges = (ranges: EventRankingRewardRange[]): EventRankingRewardRange[] => {
    const importantRanges = ranges.filter(isPreviewRewardRange);
    const previewSource = importantRanges.length > 0 ? importantRanges : ranges;
    return previewSource.slice(0, rankingRewardPreviewLimit);
  };

  const getVisibleRewardRanges = (data: EventRelatedData | null): EventRankingRewardRange[] => {
    const ranges = data?.rewardRanges ?? [];
    return areAllRankingRewardsVisible ? ranges : getPreviewRewardRanges(ranges);
  };

  const shouldShowRankingRewardToggle = (data: EventRelatedData | null): boolean =>
    (data?.rewardRanges.length ?? 0) > getPreviewRewardRanges(data?.rewardRanges ?? []).length;

  const getRewardDetailKey = (detail: EventRewardResourceBoxDetail, index: number): string =>
    `${detail.resourceType ?? "resource"}-${detail.resourceId ?? "none"}-${detail.seq ?? index}`;
  const getRewardKey = (reward: EventRankingReward, index: number): string =>
    reward.id ?? reward.resourceBoxId ?? `${reward.seq ?? "reward"}-${index}`;
  const getRewardRangeKey = (range: EventRankingRewardRange, index: number): string =>
    `${range.fromRank ?? "from"}-${range.toRank ?? "to"}-${range.isToRankBorder === true ? "border" : "range"}-${index}`;
  const getFeaturedCardKey = (card: EventFeaturedCard, index: number): string =>
    card.cardId ?? card.assetBundleName ?? card.title ?? `card-${index}`;
  const getMusicKey = (music: EventMusic, index: number): string =>
    music.musicId ?? music.seq?.toString() ?? music.assetBundleName ?? music.title ?? `music-${index}`;
  const isHonorRewardDetail = (detail: EventRewardResourceBoxDetail): boolean =>
    detail.resourceType === "honor" || detail.resourceType === "bonds_honor";
  const getRewardDetailQuantity = (detail: EventRewardResourceBoxDetail): string | null =>
    formatNumber(detail.resourceQuantity);
  const getRewardDetailLabel = (detail: EventRewardResourceBoxDetail): string => {
    const typeLabel = detail.resourceType?.replaceAll("_", " ") ?? noDataLabel;
    const idLabel = detail.resourceId ? ` #${detail.resourceId}` : "";
    const levelLabel = detail.resourceLevel !== null ? ` Lv.${formatNumber(detail.resourceLevel)}` : "";
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
    const rarity = honor.honorRarity ?? honor.levels.find((level) => level.level === detail.resourceLevel)?.honorRarity ?? honor.levels.find((level) => level.honorRarity)?.honorRarity ?? "low";
    const rarityNumber = honorRarityNumber[rarity] ?? 1;
    const frameName = honor.group?.frameName;

    const defaultFrameSrc = asset(`/degree/frame_degree_${config.frameSize}_${rarityNumber}.png`);
    let frameSrc = defaultFrameSrc;
    let frameFallbackSrc: string | null = null;
    if (
      frameName &&
      (rarity === "highest" || rarity === "high" || (honorType === "birthday" && rarity === "middle"))
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
      overlaySrc = getRemoteAssetEndpointURL(`honor/${assetBundleName}/rank_${config.assetName}.webp`, assetRegion);
    } else if (honorType === "rank_match" && assetBundleName) {
      overlaySrc = getRemoteAssetEndpointURL(`rank_live/honor/${assetBundleName}/${config.assetName}.webp`, assetRegion);
    } else if (honor.honorMissionType && assetBundleName) {
      overlaySrc = getRemoteAssetEndpointURL(`honor/${assetBundleName}/scroll.webp`, assetRegion);
    }

    const isFullBleedOverlay = assetBundleName ? /_cp\d+$/.test(assetBundleName) : false;

    return {
      config,
      baseSrc,
      frame: { src: frameSrc, ...getHonorFrameGeometry(rarityNumber, config), fallbackSrc: frameFallbackSrc },
      overlaySrc,
      isFullBleedOverlay
    };
  };
  const getHonorAssetPreviews = (detail: EventRewardResourceBoxDetail): HonorAssetPreviews | null => {
    const sub = getHonorAssetPreview(detail, honorAssetVariantConfigs.sub);
    const main = getHonorAssetPreview(detail, honorAssetVariantConfigs.main);

    return sub && main ? { sub, main } : null;
  };
  const getRewardDetailImageSrc = (detail: EventRewardResourceBoxDetail): string | null => {
    if (!detail.resourceType) {
      return null;
    }

    if (detail.resourceType === "material" && detail.resourceId) {
      return getRemoteAssetEndpointURL(`thumbnail/material/material${detail.resourceId}.webp`, region as AssetServer);
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
      return getRemoteAssetEndpointURL(`thumbnail/gacha_ticket/${detail.resourceId}.webp`, region as AssetServer);
    }

    if (detail.resourceType === "boost_item" && detail.resourceId) {
      return getRemoteAssetEndpointURL(`thumbnail/boost_item/boost_item${detail.resourceId}.webp`, region as AssetServer);
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
  const formatRewardResource = (reward: EventRankingReward): string =>
    reward.resourceBoxId ? `${rankingRewardResourceBoxLabel} #${reward.resourceBoxId}` : noDataLabel;

  const getVirtualLiveItems = (currentEvent: EventDetail): SummaryItem[] => {
    if (!currentEvent.virtualLive) {
      return [];
    }

    return [
      {
        key: "type",
        label: virtualLiveTypeLabel,
        value: currentEvent.virtualLive.virtualLiveType ?? noDataLabel
      },
      {
        key: "start",
        label: virtualLiveStartLabel,
        value: formatDisplayDateTime(currentEvent.virtualLive.startAt, displayLocale)
      },
      {
        key: "end",
        label: virtualLiveEndLabel,
        value: formatDisplayDateTime(currentEvent.virtualLive.endAt, displayLocale)
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
      <Icon icon={getRewardDetailFallbackIcon(detail)} class="size-4 shrink-0 opacity-70" aria-hidden="true" />
    {/if}
    {#if getRewardDetailQuantity(detail)}
      <span class="shrink-0 text-primary">×{getRewardDetailQuantity(detail)}</span>
    {/if}
  </span>
{/snippet}

{#snippet honorRewardDetail(detail: EventRewardResourceBoxDetail)}
  {@const honorPreviews = getHonorAssetPreviews(detail)}
  {#if honorPreviews}
    <span class="inline-flex shrink-0" title={getRewardDetailLabel(detail)} aria-label={getRewardDetailLabel(detail)}>
      <span class="block w-[180px] sm:hidden" aria-hidden="true">
        {@render honorAssetPreview(honorPreviews.sub)}
      </span>
      <span class="hidden w-[380px] sm:block" aria-hidden="true">
        {@render honorAssetPreview(honorPreviews.main)}
      </span>
    </span>
  {:else}
    <span class="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border border-base-content/20 bg-base-100/80 px-2.5 py-1.5 text-xs font-semibold text-base-content" title={getRewardDetailLabel(detail)} aria-label={getRewardDetailLabel(detail)}>
      <Icon icon={getRewardDetailFallbackIcon(detail)} class="size-4 shrink-0 opacity-70" aria-hidden="true" />
    </span>
  {/if}
{/snippet}

{#snippet honorAssetPreview(honorPreview: HonorAssetPreview)}
  <svg
    class="block h-auto w-full"
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

{#snippet rewardFallbackChip(reward: EventRankingReward)}
  <span class="badge min-h-8 border-base-content/20 bg-base-100/80 font-semibold text-base-content">
    <Icon icon="mdi:gift-outline" class="size-4 opacity-70" aria-hidden="true" />
    <span class="sr-only">{formatRewardResource(reward)}</span>
  </span>
{/snippet}

{#snippet attributeBonusPanel(item: AttributeBonusItem)}
  {@const attrIconUrl = getAttrIconUrl(item.attr)}
  <div class="content-card-inset flex items-center gap-3 rounded-xl p-3">
    <div
      class="btn btn-sm size-12! min-h-12! shrink-0 border-base-content/20 bg-base-100/80 p-0 text-primary"
      title={getAttrLabel(item.attr)}
    >
      {#if attrIconUrl}
        <img
          src={attrIconUrl}
          alt={getAttrLabel(item.attr)}
          class="size-7 object-contain"
          loading="lazy"
          decoding="async"
        />
      {:else}
        <Icon icon="mdi:cards-outline" class="size-7 opacity-70" aria-hidden="true" />
      {/if}
    </div>
    <div class="min-w-0">
      <p class="text-sm font-semibold">{getAttrLabel(item.attr)}</p>
      <p class="text-xs font-medium uppercase tracking-[0.14em] opacity-60">
        {bonusRateLabel} {formatPercent(item.bonusRate) ?? noDataLabel}
      </p>
    </div>
  </div>
{/snippet}

{#snippet rarityIconLabel(rarityType: string)}
  {@const rarityIconUrl = getRarityIconUrl(rarityType)}
  <span class="flex min-w-16 items-center gap-0.5" aria-label={getRarityLabel(rarityType)}>
    {#if rarityIconUrl && rarityType === "rarity_birthday"}
      <img src={rarityIconUrl} alt={getRarityLabel(rarityType)} class="size-5 object-contain" loading="lazy" decoding="async" />
    {:else if rarityIconUrl}
      {#each Array.from({ length: getRarityValue(rarityType) }, (_, index) => index) as index (index)}
        <img src={rarityIconUrl} alt={index === 0 ? getRarityLabel(rarityType) : ""} class="size-4 object-contain" loading="lazy" decoding="async" />
      {/each}
    {:else}
      <span class="text-sm font-semibold">{getRarityLabel(rarityType)}</span>
    {/if}
  </span>
{/snippet}

{#snippet cardBonusBadges(card: EventFeaturedCard)}
  <span class="badge badge-sm border-base-content/20 bg-base-100/80 font-semibold text-base-content">
    {featuredCardBonusLabel}: {formatPercent(card.bonusRate) ?? noDataLabel}
  </span>
  {#if card.leaderBonusRate !== null}
    <span class="badge badge-sm border-base-content/20 bg-base-100/80 font-semibold text-base-content">
      {leaderBonusLabel}: {formatPercent(card.leaderBonusRate) ?? noDataLabel}
    </span>
  {/if}
{/snippet}

{#snippet featuredCardPanel(card: EventFeaturedCard)}
  {@const href = getCardHref(card)}
  {@const content = card}
  {#if href}
    <a
      href={href}
      class="content-card-inset group grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl p-3 transition-[transform,background-color] duration-150 hover:-translate-y-0.5 hover:bg-base-200/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
        maxSize={80}
        containerClass="relative overflow-hidden rounded-lg bg-base-200 aspect-square"
      />
      <div class="min-w-0 self-center">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {formatHashId(content.cardId)}
        </p>
        <p class="mt-1 line-clamp-2 text-sm font-semibold group-hover:text-primary">
          {getCardTitle(content)}
        </p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          {@render cardBonusBadges(content)}
        </div>
      </div>
    </a>
  {:else}
    <div class="content-card-inset grid grid-cols-[5rem_minmax(0,1fr)] gap-3 rounded-xl p-3">
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
        maxSize={80}
        containerClass="relative overflow-hidden rounded-lg bg-base-200 aspect-square"
      />
      <div class="min-w-0 self-center">
        <p class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {formatHashId(content.cardId)}
        </p>
        <p class="mt-1 line-clamp-2 text-sm font-semibold">{getCardTitle(content)}</p>
        <div class="mt-2 flex flex-wrap gap-1.5">
          {@render cardBonusBadges(content)}
        </div>
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
      href={href}
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
          <span class="badge badge-sm border-base-content/20 bg-base-100/80 font-semibold text-base-content">
            {rankingRewardTopLabel}
          </span>
        {/if}
        {#if range.isToRankBorder === true}
          <span class="badge badge-sm border-base-content/20 bg-base-100/80 font-semibold text-base-content">
            {rankingRewardBorderLabel}
          </span>
        {/if}
      </div>
    </div>
    {#if range.rewards.length > 0}
      <div class="mt-3 grid gap-2">
        {#each range.rewards as reward, rewardIndex (getRewardKey(reward, rewardIndex))}
          {#if reward.resourceBoxDetails.length > 0}
            {@const honorDetails = reward.resourceBoxDetails.filter(isHonorRewardDetail)}
            {@const regularDetails = reward.resourceBoxDetails.filter((detail) => !isHonorRewardDetail(detail))}
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
          {:else}
            {@render rewardFallbackChip(reward)}
          {/if}
        {/each}
      </div>
    {:else}
      <p class="mt-3 text-sm opacity-70">{noDataLabel}</p>
    {/if}
  </div>
{/snippet}

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <section class="space-y-2" aria-labelledby="event-attr-bonus-title">
      <h2 id="event-attr-bonus-title" class="flex items-center gap-2 text-sm font-semibold">
        <Icon icon="mdi:cards-outline" class="size-4 shrink-0 opacity-70" aria-hidden="true" />
        <span>{attrBonusLabel}</span>
      </h2>
      {#if getAttributeBonusItems(relatedData).length > 0}
        <div class="grid gap-2 sm:grid-cols-2">
          {#each getAttributeBonusItems(relatedData) as item (getAttributeBonusKey(item.attr))}
            {@render attributeBonusPanel(item)}
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
                      {formatPercent(getRarityBonusRate(relatedData, rarityType, masterRank)) ?? "—"}
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
    {#if (relatedData?.rewardRanges.length ?? 0) > 0}
      <div class="grid gap-2">
        {#each getVisibleRewardRanges(relatedData) as range, rangeIndex (getRewardRangeKey(range, rangeIndex))}
          {@render rankingRewardRangePanel(range)}
        {/each}
      </div>
      {#if shouldShowRankingRewardToggle(relatedData)}
        <button
          type="button"
          class="btn btn-outline btn-sm border-base-content/20 text-primary"
          onclick={() => {
            areAllRankingRewardsVisible = !areAllRankingRewardsVisible;
          }}
        >
          {areAllRankingRewardsVisible ? rankingRewardsShowLessLabel : rankingRewardsShowMoreLabel}
        </button>
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
        <div class={`grid gap-2 ${virtualLiveBannerSrc ? "@md:grid-cols-[minmax(8rem,12rem)_minmax(0,1fr)] @md:items-center" : ""}`}>
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
            <p class="line-clamp-2 text-sm/5 font-semibold">{virtualLive.name ?? virtualLiveTitle}</p>
            <dl class={`mt-1.5 grid gap-1.5 ${virtualLiveBannerSrc ? "@xl:grid-cols-3" : "@md:grid-cols-3"}`}>
              {#each getVirtualLiveItems(event) as item (item.key)}
                <div class="min-w-0 rounded-lg bg-base-100/70 px-2 py-1.5">
                  <dt class="text-[0.65rem]/tight font-semibold uppercase tracking-widest opacity-60">
                    {item.label}
                  </dt>
                  <dd class="mt-0.5 wrap-break-word text-xs/4 font-medium">{item.value}</dd>
                </div>
              {/each}
            </dl>
          </div>
        </div>
      </div>
    </section>
  </article>
{/if}
