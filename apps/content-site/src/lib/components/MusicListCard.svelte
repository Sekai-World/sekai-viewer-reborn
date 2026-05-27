<script lang="ts">
  import { getMusicJacketAssetURL } from "$lib/assets";
  import type { SupportedRegion } from "$lib/regions";

  type MusicListItem = {
    id: string;
    title: string;
    assetBundleName: string | null;
    categories: string[];
    composer: string | null;
  };

  let {
    region,
    item,
    viewMode,
    idLabel,
    jacketAltSuffix,
    creatorLabel,
    getCategoryLabel
  }: {
    region: SupportedRegion;
    item: MusicListItem;
    viewMode: "grid" | "agenda";
    idLabel: string;
    jacketAltSuffix: string;
    creatorLabel: string;
    getCategoryLabel: (value: string) => string;
  } = $props();
</script>

<article class="card content-card-shell overflow-hidden shadow-sm">
  {#if viewMode === "agenda"}
    <div class="grid grid-cols-[5.5rem_1fr] gap-3 p-3 sm:grid-cols-[6.5rem_1fr]">
      {#if item.assetBundleName}
        <img
          src={getMusicJacketAssetURL(item.assetBundleName, region)}
          alt={`${item.title} ${jacketAltSuffix}`}
          class="aspect-square w-full rounded-xl object-cover"
          loading="lazy"
          decoding="async"
        />
      {:else}
        <div class="aspect-square rounded-xl bg-base-200"></div>
      {/if}
      <div class="flex min-w-0 flex-col justify-center gap-2">
        <span class="badge badge-sm border-none bg-base-200 font-semibold text-base-content">
          {idLabel}{item.id}
        </span>
        <h2 class="line-clamp-2 font-semibold leading-snug">{item.title}</h2>
        {#if item.composer}
          <p class="truncate text-sm opacity-70">{creatorLabel}: {item.composer}</p>
        {/if}
        <div class="flex flex-wrap gap-1">
          {#each item.categories as category (category)}
            <span class="badge badge-sm badge-outline border-base-content/15">
              {getCategoryLabel(category)}
            </span>
          {/each}
        </div>
      </div>
    </div>
  {:else}
    {#if item.assetBundleName}
      <img
        src={getMusicJacketAssetURL(item.assetBundleName, region)}
        alt={`${item.title} ${jacketAltSuffix}`}
        class="aspect-square w-full object-cover"
        loading="lazy"
        decoding="async"
      />
    {:else}
      <div class="aspect-square bg-base-200"></div>
    {/if}
    <div class="card-body gap-2 p-4">
      <span class="badge badge-sm border-none bg-base-200 font-semibold text-base-content">
        {idLabel}{item.id}
      </span>
      <h2 class="line-clamp-2 text-sm font-semibold leading-snug">{item.title}</h2>
      {#if item.composer}
        <p class="truncate text-xs opacity-70">{item.composer}</p>
      {/if}
      <div class="flex flex-wrap gap-1">
        {#each item.categories as category (category)}
          <span class="badge badge-sm badge-outline border-base-content/15 text-[0.65rem]">
            {getCategoryLabel(category)}
          </span>
        {/each}
      </div>
    </div>
  {/if}
</article>
