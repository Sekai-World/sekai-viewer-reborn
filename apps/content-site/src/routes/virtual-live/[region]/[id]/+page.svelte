<script lang="ts">
  import { browser, dev } from "$app/environment";
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import { getVirtualLiveBannerAssetURL } from "$lib/assets/index";
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import EventDebugDialog from "$lib/components/shared/EventDebugDialog.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, { type RegionBadgeOption } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { VirtualLiveDetail, VirtualLiveStatus } from "$lib/domain/virtual-live";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import { formatDisplayDateTime, toTimestampMs } from "$lib/time/date-time";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "virtual-live", "error"]);
  const initialText = (key: string, fallback?: string): string =>
    createI18nTranslator(data.uiLocale, fallbackMessages)(key, fallback);
  let messages = $state<Record<string, string>>(fallbackMessages);
  let translate = $derived(createI18nTranslator(data.uiLocale, messages));
  let translationRequestId = 0;
  let debugDialog = $state<HTMLDialogElement | null>(null);

  $effect(() => {
    const requestId = ++translationRequestId;
    messages = fallbackMessages;
    if (!browser) return;
    void Promise.resolve(data.i18nMessages).then((next) => {
      if (requestId === translationRequestId) messages = next;
    });
  });

  const t = (key: string, fallback?: string): string => translate(key, fallback);
  const listHref = (): string => resolve("/virtual-lives/[region]", { region: data.region });
  const breadcrumbs = (label: string) => [
    { label: t("home"), href: resolve("/") },
    { label: t("virtualLiveListTitle"), href: listHref() },
    { label }
  ];
  const regionOrder: SupportedRegion[] = ["jp", "en", "tw", "kr", "cn"];
  const regionOptions = (available: SupportedRegion[]): RegionBadgeOption[] =>
    regionOrder.filter((region) => available.includes(region) || region === data.region).map((region) =>
      region === data.region
        ? { key: region, label: region.toUpperCase(), active: true }
        : { key: region, label: region.toUpperCase(), href: resolve("/virtual-live/[region]/[id]", { region, id: data.virtualLiveId }), active: false }
    );
  const currentRegionOption = (): RegionBadgeOption[] => [
    { key: data.region, label: data.region.toUpperCase(), active: true }
  ];
  const unavailableMessage = (available: SupportedRegion[]): string =>
    available.some((region) => region !== data.region)
      ? data.virtualLiveUnavailableInCurrentRegionMessage
      : data.failedToLoadVirtualLiveDataMessage;
  const formatDate = (value: string | number | null): string =>
    formatDisplayDateTime(toTimestampMs(value) ?? value, data.uiLocale);
  const displayValue = (value: string | number | null): string =>
    value === null || value === "" ? t("virtualLiveValueUnavailable") : String(value);
  const statusLabel = (status: VirtualLiveStatus): string => t(`virtualLiveStatus.${status}`, status);
  const typeLabel = (type: string | null): string =>
    type ? t(`virtualLiveType.${type}`, type.replaceAll("_", " ")) : t("virtualLiveValueUnavailable");
  const statusClass = (status: VirtualLiveStatus): string =>
    status === "ongoing" ? "badge-primary" : status === "upcoming" ? "badge-secondary" : "badge-ghost";
  const hasObjectData = (value: Record<string, unknown> | null): boolean =>
    value !== null && Object.keys(value).length > 0;
  const summarizeExpansion = (value: Record<string, unknown>): string => {
    const populated = Object.values(value).filter((item) => item !== null && item !== undefined).length;
    return t("virtualLiveExpansionFieldsSummary").replace("{count}", String(populated));
  };
  const expansionCards = (live: VirtualLiveDetail) => [
    { label: t("virtualLiveGroupTitle"), value: live.virtualLiveGroup },
    { label: t("virtualLiveScreenMvTitle"), value: live.screenMvMusicVocal },
    { label: t("virtualLivePamphletTitle"), value: live.pamphlet },
    { label: t("virtualLiveTicketTitle"), value: live.ticket }
  ].filter((item): item is { label: string; value: Record<string, unknown> } => hasObjectData(item.value));
</script>

<svelte:head>
  {#await data.virtualLivePayload}
    <title>{initialText("pageTitle.virtualLivePrefix")} {data.virtualLiveId} - Sekai Viewer</title>
  {:then payload}
    <title>{payload.virtualLive?.name ?? `${initialText("pageTitle.virtualLivePrefix")} ${data.virtualLiveId}`} - Sekai Viewer</title>
  {/await}
</svelte:head>

<section use:swipeRegion class="mx-auto flex w-full max-w-400 flex-col gap-4 px-2">
  {#await data.virtualLivePayload}
    <PageHeader breadcrumbs={breadcrumbs(`${t("pageTitle.virtualLivePrefix")} ${data.virtualLiveId}`)} breadcrumbClass="md:max-w-[68%]">
      {#snippet actions()}<RegionBadgeSwitch options={currentRegionOption()} />{/snippet}
    </PageHeader>
    <div class="grid gap-4 md:grid-cols-[minmax(300px,420px)_minmax(0,1fr)]">
      <div class="content-card-shell rounded-2xl p-4"><div class="skeleton aspect-2/1 w-full rounded-xl"></div></div>
      <div class="content-card-shell space-y-4 rounded-2xl p-5"><div class="skeleton h-8 w-2/3"></div><div class="grid gap-3 sm:grid-cols-2">{#each Array(4) as _, index (index)}<div class="skeleton h-20 rounded-xl"></div>{/each}</div></div>
    </div>
  {:then payload}
    <PageHeader breadcrumbs={breadcrumbs(payload.virtualLive?.name ?? `${t("pageTitle.virtualLivePrefix")} ${data.virtualLiveId}`)} breadcrumbClass="md:max-w-[68%]">
      {#snippet actions()}
        {#if dev && payload.debugVirtualLiveJson}<button type="button" class="btn btn-outline btn-sm" onclick={() => debugDialog?.showModal()}>{t("virtualLiveDebugJsonButton")}</button>{/if}
        {#await data.availableRegions then available}<RegionBadgeSwitch options={regionOptions(available)} />{/await}
      {/snippet}
    </PageHeader>

    {#if payload.error}<div class="alert alert-error">{payload.error}</div>{/if}

    {#if payload.virtualLive}
      {@const live = payload.virtualLive}
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(300px,380px)_minmax(0,1fr)] md:items-start lg:grid-cols-[minmax(320px,420px)_minmax(0,1fr)]"
      >
        <div class="flex flex-col gap-4">
          <article class="card content-card-shell overflow-hidden shadow-sm">
            <div class="card-body items-center gap-3 p-3 text-center sm:p-5">
              <div class="content-card-inset w-full overflow-hidden rounded-[1.75rem] aspect-16/7">
                {#if live.assetBundleName}
                  <AssetImage
                    src={getVirtualLiveBannerAssetURL(live.assetBundleName, data.region)}
                    alt={`${live.name ?? live.id} ${t("virtualLiveBannerAltSuffix")}`}
                    imageClass="h-full w-full object-contain p-4 md:p-6"
                    buttonClass="block h-full w-full overflow-hidden"
                  />
                {:else}
                  <div class="flex h-full items-center justify-center px-6 text-center text-sm opacity-70">
                    {t("imageUnavailable")}
                  </div>
                {/if}
              </div>
            </div>
          </article>

          <article class="card content-card-shell shadow-sm">
            <div class="card-body gap-4 p-5">
              <h2 class="text-lg font-bold">{t("virtualLiveDetailTitle")}</h2>
              <dl class="divide-y divide-base-300">
                {#each [[t("virtualLiveStartAtLabel"), formatDate(live.startAt)], [t("virtualLiveEndAtLabel"), formatDate(live.endAt)], [t("virtualLiveRankingAnnounceAtLabel"), formatDate(live.rankingAnnounceAt)], [t("internalResourceCodeLabel"), displayValue(live.assetBundleName)]] as row (row[0])}
                  <div class="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 py-3">
                    <dt class="text-sm opacity-60">{row[0]}</dt>
                    <dd class="wrap-break-word text-right text-sm font-semibold">{row[1]}</dd>
                  </div>
                {/each}
              </dl>
            </div>
          </article>

          {#if live.waitingRoom}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-5">
                <h2 class="text-lg font-bold">{t("virtualLiveWaitingRoomTitle")}</h2>
                <dl class="grid gap-3 text-sm">
                  <div class="content-card-inset rounded-2xl p-4">
                    <dt class="opacity-55">{t("virtualLiveWaitingRoomStartAtLabel")}</dt>
                    <dd class="mt-1 font-semibold">{formatDate(live.waitingRoom.startAt)}</dd>
                  </div>
                  <div class="content-card-inset rounded-2xl p-4">
                    <dt class="opacity-55">{t("virtualLiveWaitingRoomEndAtLabel")}</dt>
                    <dd class="mt-1 font-semibold">{formatDate(live.waitingRoom.endAt)}</dd>
                  </div>
                  {#if live.waitingRoom.assetBundleName}
                    <div class="content-card-inset rounded-2xl p-4">
                      <dt class="opacity-55">{t("internalResourceCodeLabel")}</dt>
                      <dd class="mt-1 break-all font-semibold">{live.waitingRoom.assetBundleName}</dd>
                    </div>
                  {/if}
                </dl>
              </div>
            </article>
          {/if}

          {#if expansionCards(live).length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-5">
                <h2 class="text-lg font-bold">{t("virtualLiveAdditionalDataTitle")}</h2>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {#each expansionCards(live) as item (item.label)}
                    <div class="content-card-inset rounded-xl p-3">
                      <h3 class="text-sm font-semibold">{item.label}</h3>
                      <p class="mt-1 text-xs opacity-60">{summarizeExpansion(item.value)}</p>
                    </div>
                  {/each}
                </div>
              </div>
            </article>
          {/if}
        </div>

        <div class="flex flex-col gap-4">
          <article class="card content-card-shell shadow-sm">
            <div class="card-body gap-5 p-5 sm:p-6">
              <div class="flex flex-wrap gap-2">
                <span class={`badge ${statusClass(live.status)} font-semibold`}>
                  {statusLabel(live.status)}
                </span>
                <span class="badge badge-outline font-semibold">{typeLabel(live.virtualLiveType)}</span>
              </div>

              <div>
                <h1 class="text-2xl/tight font-bold sm:text-4xl">{live.name ?? live.id}</h1>
                <p class="mt-3 text-sm opacity-65">
                  {formatDate(live.startAt)} — {formatDate(live.endAt)}
                </p>
              </div>

              <dl class="grid gap-3 sm:grid-cols-3">
                <div class="content-card-inset min-w-0 rounded-2xl p-4">
                  <dt class="text-xs font-semibold uppercase tracking-wider opacity-55">
                    {t("virtualLiveIdLabel")}
                  </dt>
                  <dd class="mt-1 font-semibold">#{live.id}</dd>
                </div>
                <div class="content-card-inset min-w-0 rounded-2xl p-4">
                  <dt class="text-xs font-semibold uppercase tracking-wider opacity-55">
                    {t("virtualLivePlatformLabel")}
                  </dt>
                  <dd class="mt-1 wrap-break-word font-semibold">
                    {displayValue(live.virtualLivePlatform)}
                  </dd>
                </div>
                <div class="content-card-inset min-w-0 rounded-2xl p-4">
                  <dt class="text-xs font-semibold uppercase tracking-wider opacity-55">
                    {t("virtualLiveSeqLabel")}
                  </dt>
                  <dd class="mt-1 font-semibold">{displayValue(live.seq)}</dd>
                </div>
              </dl>
            </div>
          </article>

          {#if live.information && (live.information.summary || live.information.description)}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-3 p-5">
                <h2 class="text-lg font-bold">{t("virtualLiveInformationTitle")}</h2>
                {#if live.information.summary}
                  <p class="font-semibold leading-relaxed">{live.information.summary}</p>
                {/if}
                {#if live.information.description}
                  <p class="whitespace-pre-line text-sm/7 opacity-75">{live.information.description}</p>
                {/if}
              </div>
            </article>
          {/if}

          {#if live.schedules.length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-5">
                <h2 class="text-lg font-bold">{t("virtualLiveSchedulesTitle")}</h2>
                <div class="grid gap-3 sm:grid-cols-2">
                  {#each live.schedules as schedule, index (schedule.id ?? index)}
                    <div class="content-card-inset rounded-xl p-4">
                      <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span class="badge badge-primary badge-sm">
                          {t("virtualLiveScheduleSeqLabel")} {displayValue(schedule.seq)}
                        </span>
                        {#if schedule.isAfterEvent}
                          <span class="badge badge-outline badge-sm">
                            {t("virtualLiveScheduleIsAfterEventLabel")}
                          </span>
                        {/if}
                      </div>
                      <p class="text-sm font-semibold">{formatDate(schedule.startAt)}</p>
                      <p class="mt-1 text-xs opacity-60">{formatDate(schedule.endAt)}</p>
                    </div>
                  {/each}
                </div>
              </div>
            </article>
          {/if}

          {#if live.setlists.length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-5">
                <h2 class="text-lg font-bold">{t("virtualLiveSetlistsTitle")}</h2>
                <div class="space-y-2">
                  {#each live.setlists as setlist, index (setlist.id ?? index)}
                    <div
                      class="content-card-inset flex flex-wrap items-center justify-between gap-3 rounded-xl p-4"
                    >
                      <div class="min-w-0">
                        <p class="text-xs font-semibold uppercase tracking-wider opacity-55">
                          {t("virtualLiveSetlistSeqLabel")} {displayValue(setlist.seq)}
                        </p>
                        <p class="mt-1 wrap-break-word font-semibold">
                          {typeLabel(setlist.virtualLiveSetlistType)}
                        </p>
                      </div>
                      <div class="flex min-w-0 flex-wrap gap-2">
                        {#if setlist.musicId !== null}
                          <a
                            class="btn btn-primary btn-sm"
                            href={resolve("/music/[region]/[id]", {
                              region: data.region,
                              id: String(setlist.musicId)
                            })}
                          >
                            {t("virtualLiveSetlistMusicLabel")} #{setlist.musicId}
                          </a>
                        {/if}
                        {#if setlist.musicVocalId !== null}
                          <span class="badge badge-outline">
                            {t("virtualLiveSetlistMusicVocalLabel")} #{setlist.musicVocalId}
                          </span>
                        {/if}
                        {#if setlist.virtualLiveStageId !== null}
                          <span class="badge badge-outline">
                            {t("virtualLiveSetlistStageLabel")} #{setlist.virtualLiveStageId}
                          </span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </div>
            </article>
          {/if}

          {#if live.characters.length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-5">
                <h2 class="text-lg font-bold">{t("virtualLiveCharactersTitle")}</h2>
                <div class="grid gap-2 sm:grid-cols-2">
                  {#each live.characters as character, index (character.id ?? index)}
                    <div class="content-card-inset rounded-xl p-4">
                      <div class="flex items-center justify-between gap-3">
                        <span class="badge badge-outline">
                          {t("virtualLiveCharacterSeqLabel")} {displayValue(character.seq)}
                        </span>
                        <span class="text-xs opacity-55">#{displayValue(character.gameCharacterUnitId)}</span>
                      </div>
                      {#if character.virtualLivePerformanceType}
                        <p class="mt-3 text-sm">
                          <span class="opacity-55">{t("virtualLiveCharacterPerformanceTypeLabel")}:</span>
                          <strong>{character.virtualLivePerformanceType}</strong>
                        </p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            </article>
          {/if}

          {#if live.rewards.length > 0}
            <article class="card content-card-shell shadow-sm">
              <div class="card-body gap-4 p-5">
                <h2 class="text-lg font-bold">{t("virtualLiveRewardsTitle")}</h2>
                <div class="flex flex-wrap gap-2">
                  {#each live.rewards as reward, index (reward.id ?? index)}
                    <div class="content-card-inset min-w-36 rounded-xl px-4 py-3">
                      <p class="text-xs opacity-55">{t("virtualLiveRewardResourceBoxIdLabel")}</p>
                      <p class="font-bold">#{displayValue(reward.resourceBoxId)}</p>
                      {#if reward.virtualLiveType}
                        <p class="mt-1 text-xs opacity-60">{typeLabel(reward.virtualLiveType)}</p>
                      {/if}
                    </div>
                  {/each}
                </div>
              </div>
            </article>
          {/if}
        </div>
      </div>
    {:else if !payload.error}
      {#await data.availableRegions}<div class="alert"><span class="loading loading-spinner loading-sm"></span>{t("virtualLiveDetailLoading")}</div>{:then available}<div class="alert alert-error">{unavailableMessage(available)}</div>{/await}
    {/if}

    {#if dev && payload.debugVirtualLiveJson}<EventDebugDialog bind:dialog={debugDialog} title={t("virtualLiveDebugJsonTitle")} closeLabel={t("closeLabel")} json={payload.debugVirtualLiveJson} />{/if}
  {/await}
</section>
