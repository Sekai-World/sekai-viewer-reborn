<script lang="ts">
  export type RegionBadgeOption = {
    key: string;
    label: string;
    href?: string;
    active: boolean;
  };

  let {
    options
  }: {
    options: RegionBadgeOption[];
  } = $props();
</script>

{#each options as option (option.key)}
  {#if option.active}
    <span class="badge badge-primary border-primary/65 bg-primary/95 font-semibold text-primary-content shadow-sm">
      {option.label}
    </span>
  {:else}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a
      href={option.href}
      class="badge badge-primary badge-outline border-primary/55 bg-base-100/88 font-semibold"
    >
      {option.label}
    </a>
  {/if}
{/each}
