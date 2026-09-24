<script lang="ts">
  import Icon from "@iconify/svelte";
  import { resolve } from "$app/paths";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import { getContentDisplaySettings } from "$lib/settings/content-display";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { openGameNewsTarget } from "$lib/game-news-navigation";
  import type { GameNewsItem, GameNewsTag } from "$lib/server/game-news";
  import { toTimestampMs } from "$lib/time/date-time";
  import { tick } from "svelte";
  import { getTablistTargetIndex } from "$lib/a11y/tablist";
  import type { PageProps } from "./$types";
  import { getNewsRegionOptions } from "./region-options";

  type LegacyInformationTag = GameNewsTag;
  type LegacyNewsItem = GameNewsItem;
  let { data }: PageProps = $props();
  const messages = $derived(
    resolveStreamingMessages(data.i18nMessages, ["common", "home", "error"])
  );
  const t = $derived(createI18nTranslator(data.uiLocale, messages));
  const news = $derived(data.news);
  const tags: LegacyInformationTag[] = [
    "information",
    "event",
    "gacha",
    "music",
    "campaign",
    "bug",
    "update"
  ];
  let selectedTag = $state<LegacyInformationTag>("information");
  let showSpoilers = $state(getContentDisplaySettings().showSpoilerContent);
  let page = $state(1);
  const pageSize = 10;
  let iframeDialog = $state<HTMLDialogElement | null>(null);
  let iframeUrl = $state<string | null>(null);
  const tagLabel = (tag: LegacyInformationTag) => t(`gameNews.tags.${tag}`);
  const date = (value: string | number | null) => {
    const ms = toTimestampMs(value);
    return ms === null
      ? "—"
      : new Intl.DateTimeFormat(data.uiLocale, { dateStyle: "medium" }).format(ms);
  };
  const isSpoiler = (item: LegacyNewsItem) => {
    const start = toTimestampMs(item.startAt);
    return start !== null && start > Date.now();
  };
  const visibleItems = $derived.by(() => {
    const filtered = (news.status === "ready" ? news.items : [])
      .filter((item) => item.informationTag === selectedTag)
      .filter((item) => showSpoilers || !isSpoiler(item))
      .sort((a, b) => (toTimestampMs(b.startAt) ?? 0) - (toTimestampMs(a.startAt) ?? 0));
    return filtered.slice((page - 1) * pageSize, page * pageSize);
  });
  const totalPages = $derived(
    Math.max(
      1,
      Math.ceil(
        (news.status === "ready"
          ? news.items
              .filter((item) => item.informationTag === selectedTag)
              .filter((item) => showSpoilers || !isSpoiler(item)).length
          : 0) / pageSize
      )
    )
  );
  const tagTabId = (tag: LegacyInformationTag): string => `game-news-tab-${tag}`;
  const handleTagKeydown = (event: KeyboardEvent, index: number): void => {
    const nextIndex = getTablistTargetIndex(event.key, index, tags.length);
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTag = tags[nextIndex]!;
    setTag(nextTag);
    document.getElementById(tagTabId(nextTag))?.focus();
  };
  const setTag = (tag: LegacyInformationTag) => {
    selectedTag = tag;
    page = 1;
  };
  const openInternal = (url: string): void => {
    iframeUrl = url;
    void tick().then(() => {
      if (iframeUrl === url && iframeDialog && !iframeDialog.open) iframeDialog.showModal();
    });
  };
  const openNewsTarget = (target: GameNewsItem["target"]): void => {
    openGameNewsTarget(target, openInternal);
  };
  const regionOptions = $derived(getNewsRegionOptions(supportedRegions, data.region));
</script>

<svelte:head
  ><title>{createPageTitle(`${t("gameNews.title")} ${regionLabels[data.region]}`)}</title
  ></svelte:head
>

<section use:swipeRegion class="content-page-shell gap-5 px-2">
  <PageHeader
    breadcrumbs={[{ label: t("home"), href: resolve("/") }, { label: t("gameNews.title") }]}
  >
    {#snippet actions()}
      <RegionBadgeSwitch options={regionOptions} />
    {/snippet}
  </PageHeader>

  <section
    class="content-card-elevated rounded-2xl border border-(--archive-border-subtle) p-3 sm:p-4"
    aria-label={t("gameNews.filtersLabel")}
  >
    <div class="flex flex-wrap gap-2" role="tablist" aria-label={t("gameNews.tagsLabel")}>
      {#each tags as tag, index (tag)}
        <button
          id={tagTabId(tag)}
          class:btn-primary={selectedTag === tag}
          class:btn-ghost={selectedTag !== tag}
          class="btn min-h-11 rounded-xl"
          role="tab"
          aria-selected={selectedTag === tag}
          aria-controls="game-news-results"
          tabindex={selectedTag === tag ? 0 : -1}
          onclick={() => setTag(tag)}
          onkeydown={(event) => handleTagKeydown(event, index)}>{tagLabel(tag)}</button
        >
      {/each}
    </div>
    <label
      class="mt-4 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-(--archive-text-muted)"
    >
      <input class="toggle toggle-primary" type="checkbox" bind:checked={showSpoilers} />
      {t("gameNews.showSpoilers")}
    </label>
  </section>

  <div id="game-news-results" role="tabpanel" aria-labelledby={tagTabId(selectedTag)}>
    {#if news.status === "unavailable"}
      <div class="content-card-shell rounded-2xl border p-8 text-center" role="status">
        <Icon
          icon="mdi:information-outline"
          class="mx-auto size-8 text-primary"
          aria-hidden="true"
        />
        <h2 class="mt-3 font-semibold">{t("gameNews.unavailableTitle")}</h2>
        <p class="mt-1 text-sm text-(--archive-text-muted)">
          {t("gameNews.unavailableDescription")}
        </p>
      </div>
    {:else if news.status === "error"}
      <div class="alert alert-error">
        <Icon icon="mdi:alert-circle-outline" class="size-5" aria-hidden="true" />{t(
          "gameNews.error"
        )}
      </div>
    {:else if visibleItems.length === 0}
      <div class="content-card-shell rounded-2xl border p-10 text-center" role="status">
        <Icon
          icon="mdi:information-outline"
          class="mx-auto size-8 text-(--archive-text-muted)"
          aria-hidden="true"
        />
        <p class="mt-3 text-(--archive-text-muted)">{t("gameNews.empty")}</p>
      </div>
    {:else}
      <div
        class="content-card-shell divide-y divide-(--archive-border-subtle) overflow-hidden rounded-2xl border"
      >
        {#each visibleItems as item (item.id)}
          <article class="p-4 sm:p-5" class:opacity-60={isSpoiler(item) && !showSpoilers}>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex flex-wrap items-center gap-2 text-xs text-(--archive-text-muted)">
                <span class="badge badge-primary badge-outline"
                  >{tagLabel(item.informationTag)}</span
                ><span>{date(item.startAt)} – {date(item.endAt)}</span>
              </div>
              <div class="flex items-center gap-2">
                {#if item.internalUrl && item.internalUrlKind === "iframe"}<button
                    class="btn btn-square btn-sm btn-primary min-h-11 min-w-11"
                    type="button"
                    aria-label={t("gameNews.openInternal")}
                    title={t("gameNews.openInternal")}
                    onclick={() => openInternal(item.internalUrl!)}
                    ><Icon icon="mdi:eye-outline" class="size-4" aria-hidden="true" /></button
                  >{/if}
                {#if item.target.kind !== "none"}<a
                    class="btn btn-square btn-sm btn-ghost min-h-11 min-w-11"
                    href={item.target.kind === "internal" ? item.internalUrl : item.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("gameNews.openExternal")}
                    title={t("gameNews.openExternal")}
                    ><Icon icon="mdi:open-in-new" class="size-4" aria-hidden="true" /></a
                  >{/if}
              </div>
            </div>
            {#if item.target.kind === "none"}
              <div>
                <h2 class="mt-2 text-lg font-semibold text-(--archive-text-strong)">
                  {item.title}
                </h2>
                {#if isSpoiler(item) && !showSpoilers}<p
                    class="mt-2 text-sm italic text-(--archive-text-muted)"
                  >
                    {t("gameNews.spoilerHidden")}
                  </p>{/if}
              </div>
            {:else}
              <button
                type="button"
                class="mt-2 block w-full cursor-pointer rounded-lg border border-transparent p-2 text-left outline-none transition-[background-color,border-color,color] duration-180 ease-out motion-reduce:transition-none [@media(hover:hover)]:hover:border-primary/35 [@media(hover:hover)]:hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                aria-label={`${t(
                  item.target.kind === "internal"
                    ? "gameNews.openInternal"
                    : "gameNews.openExternal"
                )}: ${item.title}`}
                title={t(
                  item.target.kind === "internal"
                    ? "gameNews.openInternal"
                    : "gameNews.openExternal"
                )}
                onclick={() => openNewsTarget(item.target)}
              >
                <h2 class="text-lg font-semibold text-(--archive-text-strong)">{item.title}</h2>
                {#if isSpoiler(item) && !showSpoilers}<p
                    class="mt-2 text-sm italic text-(--archive-text-muted)"
                  >
                    {t("gameNews.spoilerHidden")}
                  </p>{/if}
              </button>
            {/if}
          </article>
        {/each}
      </div>
      <nav class="flex items-center justify-center gap-3" aria-label={t("gameNews.pagination")}>
        <button class="btn btn-sm min-h-11" disabled={page === 1} onclick={() => (page -= 1)}
          >{t("gameNews.previous")}</button
        ><span class="text-sm text-(--archive-text-muted)">{page} / {totalPages}</span><button
          class="btn btn-sm min-h-11"
          disabled={page >= totalPages}
          onclick={() => (page += 1)}>{t("gameNews.next")}</button
        >
      </nav>
    {/if}
  </div>
</section>

{#if iframeUrl}
  <dialog
    bind:this={iframeDialog}
    class="modal"
    onclose={() => (iframeUrl = null)}
    onclick={(event) => event.target === iframeDialog && iframeDialog?.close()}
  >
    <div class="modal-box max-w-5xl p-2 sm:p-4">
      <iframe
        title={t("gameNews.internalFrameTitle")}
        src={iframeUrl}
        class="h-[75vh] w-full rounded-xl"
        sandbox="allow-scripts allow-forms allow-same-origin"
        referrerpolicy="no-referrer"
      ></iframe>
      <div class="modal-action">
        <button class="btn min-h-11" type="button" onclick={() => iframeDialog?.close()}
          >{t("closeLabel")}</button
        >
      </div>
    </div>
  </dialog>
{/if}
