<script lang="ts">
  let {
    href = null,
    label,
    ariaLabel = null,
    onclick
  }: {
    /** A link when set; otherwise a button that calls `onclick`. */
    href?: string | null;
    /** Visible text, such as "View all (22)". */
    label: string;
    /** Names what is viewed when several such controls share a page. */
    ariaLabel?: string | null;
    onclick?: () => void;
  } = $props();
</script>

<!-- The section-header "View all" control, as on the Character page's Latest cards. -->
{#if href}
  <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
  <a
    class="btn btn-ghost btn-sm touch-target shrink-0 text-primary"
    {href}
    aria-label={ariaLabel ?? undefined}>{label}</a
  >
{:else}
  <button
    type="button"
    class="btn btn-ghost btn-sm touch-target shrink-0 text-primary"
    aria-label={ariaLabel ?? undefined}
    {onclick}>{label}</button
  >
{/if}
