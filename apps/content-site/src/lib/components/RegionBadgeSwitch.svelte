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

  let {
    options
  }: {
    options: RegionBadgeOption[];
  } = $props();
</script>

{#each options as option (option.key)}
  {#if option.active}
    <span
      class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm"
    >
      {option.label}
    </span>
  {:else if option.onclick}
    <button
      type="button"
      class="badge badge-primary badge-outline border-primary/55 bg-base-100/88 font-semibold cursor-pointer"
      onclick={option.onclick}
    >
      {option.label}
    </button>
  {:else if option.href}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a
      href={option.href}
      class="badge badge-primary badge-outline border-primary/55 bg-base-100/88 font-semibold"
    >
      {option.label}
    </a>
  {:else}
    <span
      class="badge badge-outline border-base-content/20 bg-base-100/60 font-semibold opacity-60"
    >
      {option.label}
    </span>
  {/if}
{/each}
