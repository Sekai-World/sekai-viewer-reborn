<script lang="ts">
  import { resolve } from "$app/paths";
  import { getGachaLogoAssetURL } from "$lib/assets/index";
  import type { CardGachaBanner } from "$lib/domain/card-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import EventAssetImage from "$lib/components/shared/EventAssetImage.svelte";
  import Icon from "@iconify/svelte";

  let {
    gachas,
    region,
    title,
    emptyLabel,
    showAllLabel
  }: {
    gachas: CardGachaBanner[];
    region: SupportedRegion;
    title: string;
    emptyLabel: string;
    showAllLabel: string;
  } = $props();

  let showAll = $state(false);

  const sorted = $derived(
    [...gachas].sort((a, b) => (b.startAt ?? 0) - (a.startAt ?? 0))
  );

  const latest = $derived(sorted[0] ?? null);
  const first = $derived(sorted.length >= 2 ? sorted[sorted.length - 1] : null);
  const remaining = $derived(sorted.length > 2 ? sorted.slice(1, -1) : []);
  const hiddenCount = $derived(sorted.length - (sorted.length <= 2 ? sorted.length : 2));

  const formatDate = (ts: number | null): string => {
    if (ts === null || ts <= 0) return "";
    return new Date(ts * 1000).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
      <Icon icon="mdi:gift-outline" class="size-4" aria-hidden="true" />
      <span>{title}</span>
    </p>

    {#if gachas.length > 0}
      <div class="grid gap-3">
        {#if showAll}
          {#each sorted as gacha (gacha.id)}
            <a
              href={resolve("/gacha/[region]/[id]", { region, id: gacha.id })}
              class="content-card-inset group grid gap-3 overflow-hidden rounded-xl p-3 transition-[border-color,background-color,transform] duration-180 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {#if gacha.assetbundleName}
                <div class="relative aspect-5/2 overflow-hidden rounded-xl bg-base-200/70 lg:aspect-3/1">
                  <EventAssetImage
                    src={getGachaLogoAssetURL(gacha.assetbundleName, region)}
                    alt={gacha.name ?? `#${gacha.id}`}
                    imageClass="h-full w-full object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
                    buttonClass="block h-full w-full overflow-hidden"
                    loadMode="visible"
                  />
                </div>
              {/if}
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="badge border-none bg-base-100/94 text-xs font-semibold text-base-content shadow-sm">
                    #{gacha.id}
                  </span>
                  {#if gacha.startAt}
                    <span class="text-[0.65rem] opacity-50">{formatDate(gacha.startAt)}</span>
                  {/if}
                </div>
                {#if gacha.name}
                  <h3 class="line-clamp-2 text-sm/snug font-semibold">{gacha.name}</h3>
                {/if}
              </div>
            </a>
          {/each}
        {:else}
          {#if latest}
            <a
              href={resolve("/gacha/[region]/[id]", { region, id: latest.id })}
              class="content-card-inset group grid gap-3 overflow-hidden rounded-xl p-3 transition-[border-color,background-color,transform] duration-180 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {#if latest.assetbundleName}
                <div class="relative aspect-5/2 overflow-hidden rounded-xl bg-base-200/70 lg:aspect-3/1">
                  <EventAssetImage
                    src={getGachaLogoAssetURL(latest.assetbundleName, region)}
                    alt={latest.name ?? `#${latest.id}`}
                    imageClass="h-full w-full object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
                    buttonClass="block h-full w-full overflow-hidden"
                    loadMode="visible"
                  />
                </div>
              {/if}
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="badge border-none bg-base-100/94 text-xs font-semibold text-base-content shadow-sm">
                    #{latest.id}
                  </span>
                  {#if latest.startAt}
                    <span class="text-[0.65rem] opacity-50">{formatDate(latest.startAt)}</span>
                  {/if}
                </div>
                {#if latest.name}
                  <h3 class="line-clamp-2 text-sm/snug font-semibold">{latest.name}</h3>
                {/if}
              </div>
            </a>
          {/if}

          {#if first && first.id !== latest?.id}
            <a
              href={resolve("/gacha/[region]/[id]", { region, id: first.id })}
              class="content-card-inset group grid gap-3 overflow-hidden rounded-xl p-3 transition-[border-color,background-color,transform] duration-180 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {#if first.assetbundleName}
                <div class="relative aspect-5/2 overflow-hidden rounded-xl bg-base-200/70 lg:aspect-3/1">
                  <EventAssetImage
                    src={getGachaLogoAssetURL(first.assetbundleName, region)}
                    alt={first.name ?? `#${first.id}`}
                    imageClass="h-full w-full object-contain transition-[filter] duration-180 ease-out group-hover:brightness-105"
                    buttonClass="block h-full w-full overflow-hidden"
                    loadMode="visible"
                  />
                </div>
              {/if}
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <span class="badge border-none bg-base-100/94 text-xs font-semibold text-base-content shadow-sm">
                    #{first.id}
                  </span>
                  {#if first.startAt}
                    <span class="text-[0.65rem] opacity-50">{formatDate(first.startAt)}</span>
                  {/if}
                </div>
                {#if first.name}
                  <h3 class="line-clamp-2 text-sm/snug font-semibold">{first.name}</h3>
                {/if}
              </div>
            </a>
          {/if}

          {#if hiddenCount > 0}
            <button
              onclick={() => showAll = true}
              class="btn btn-ghost btn-sm mt-1"
            >
              <Icon icon="mdi:chevron-down" class="size-4" aria-hidden="true" />
              {showAllLabel}
            </button>
          {/if}
        {/if}
      </div>
    {:else}
      <div class="alert">{emptyLabel}</div>
    {/if}
  </div>
</article>
