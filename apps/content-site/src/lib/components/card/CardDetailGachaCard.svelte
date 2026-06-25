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
    emptyLabel
  }: {
    gachas: CardGachaBanner[];
    region: SupportedRegion;
    title: string;
    emptyLabel: string;
  } = $props();
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-5">
    <p class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60">
      <Icon icon="mdi:gift-outline" class="size-4" aria-hidden="true" />
      <span>{title}</span>
    </p>

    {#if gachas.length > 0}
      <div class="grid gap-3">
        {#each gachas as gacha (gacha.id)}
          <a
            href={resolve("/gacha/[region]/[id]", { region, id: gacha.id })}
            class="block content-card-inset group grid gap-3 overflow-hidden rounded-xl p-3"
          >
            {#if gacha.assetbundleName}
              <div class="relative aspect-5/2 overflow-hidden rounded-xl bg-base-200/70 lg:aspect-3/1">
                <EventAssetImage
                  src={getGachaLogoAssetURL(gacha.assetbundleName, region)}
                  alt={gacha.name ?? `#${gacha.id}`}
                  imageClass="h-full w-full object-contain"
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
              </div>
              {#if gacha.name}
                <h3 class="line-clamp-2 text-sm/snug font-semibold">{gacha.name}</h3>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <div class="alert">{emptyLabel}</div>
    {/if}
  </div>
</article>
