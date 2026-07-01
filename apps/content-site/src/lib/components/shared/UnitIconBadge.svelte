<script lang="ts">
  import { asset } from "$app/paths";

  /**
   * Known unit slugs that have a dedicated icon PNG under /icons/.
   * Exported so callers can pre-check without rendering.
   */
  export const unitIconSlugs = new Set([
    "idol",
    "light_sound",
    "piapro",
    "school_refusal",
    "street",
    "theme_park"
  ]);

  let {
    unit,
    fallbackLabel,
    class: className
  }: {
    /** Unit slug, e.g. "idol", "light_sound". */
    unit: string;
    /** Text shown in a pill when no icon image exists. Omit to hide when unavailable. */
    fallbackLabel?: string;
    /** Extra classes forwarded to the outer element. */
    class?: string;
  } = $props();

  const resolveIconUrl = (slug: string): string | null => {
    const normalized = slug.trim().toLowerCase();
    return unitIconSlugs.has(normalized) ? asset(`/icons/icon_${normalized}.png`) : null;
  };

  const iconUrl = $derived(resolveIconUrl(unit));
</script>

{#if iconUrl}
  <span
    class="unit-icon-frame inline-flex size-9 items-center justify-center rounded-full border border-base-content/15 bg-white {className ?? ''}"
  >
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      class="size-10 max-w-none shrink-0 object-contain"
      loading="lazy"
      decoding="async"
    />
  </span>
{:else if fallbackLabel}
  <span
    class="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-base-content/15 bg-white px-1 text-[0.65rem] font-semibold leading-none {className ?? ''}"
  >
    <span class="opacity-70">{fallbackLabel}</span>
  </span>
{/if}
