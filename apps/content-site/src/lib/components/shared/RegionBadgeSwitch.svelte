<script lang="ts">
  type BaseRegionBadgeOption = {
    key: string;
    label: string;
    active: boolean;
  };

  export type RegionBadgeOption =
    | (BaseRegionBadgeOption & { href: string; onclick?: never })
    | (BaseRegionBadgeOption & { href?: never; onclick: () => void })
    | (BaseRegionBadgeOption & { href?: never; onclick?: never });

  let { options }: { options: RegionBadgeOption[] } = $props();
</script>

<div data-region-switcher class="flex flex-wrap items-center gap-1.5">
  {#each options as option (option.key)}
      {#if option.active}
        <span
          data-region-option
          data-region-active="true"
          class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm max-md:size-11 max-md:min-h-11 max-md:px-0"
        >
          {option.label}
        </span>
      {:else if option.onclick}
        <button
          data-region-option
          data-region-active="false"
          type="button"
          class="badge badge-primary badge-outline cursor-pointer border-primary/55 bg-base-100/88 font-semibold max-md:size-11 max-md:min-h-11 max-md:px-0"
          onclick={option.onclick}
        >
          {option.label}
        </button>
      {:else if option.href}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a
          data-region-option
          data-region-active="false"
          href={option.href}
          class="badge badge-primary badge-outline border-primary/55 bg-base-100/88 font-semibold max-md:size-11 max-md:min-h-11 max-md:px-0"
        >
          {option.label}
        </a>
      {:else}
        <span
          class="badge badge-outline border-base-content/20 bg-base-100/60 font-semibold opacity-60 max-md:size-11 max-md:min-h-11 max-md:px-0"
        >
          {option.label}
        </span>
      {/if}
  {/each}
</div>
