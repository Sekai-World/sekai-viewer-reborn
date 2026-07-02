<script lang="ts">
  import { resolveUnitIconUrl } from "$lib/domain/unit-icon";

  type Variant = "sm" | "default" | "lg";

  let {
    unit,
    fallbackLabel,
    mapNoneToPiapro = false,
    variant = "default",
    class: className
  }: {
    /** Unit slug, e.g. "idol", "light_sound", "none". */
    unit: string;
    /** Text shown in a pill when no icon image exists. Omit to hide when unavailable. */
    fallbackLabel?: string;
    /** Treat the support-unit "none" slug as the piapro icon. */
    mapNoneToPiapro?: boolean;
    /** Visual size: "sm" (card list), "default" (event cards), "lg" (detail cards). */
    variant?: Variant;
    /** Extra classes forwarded to the outer element. */
    class?: string;
  } = $props();

  const iconUrl = $derived(resolveUnitIconUrl(unit, mapNoneToPiapro));

  const frameClass: Record<Variant, string> = {
    sm: "size-7 border border-base-content/15 bg-base-100/70 dark:bg-gray-300",
    default: "size-9 border border-base-content/15 bg-base-100/70 dark:bg-gray-300",
    lg: "size-11 border-2 border-base-content/15 bg-base-100/70 dark:bg-gray-300"
  };

  const imgClass: Record<Variant, string> = {
    sm: "size-7",
    default: "size-10 max-w-none",
    lg: "size-12 max-w-none"
  };

  const textPillClass: Record<Variant, string> = {
    sm: "h-5 min-w-5 px-1 text-[0.55rem]",
    default: "h-7 min-w-7 px-1 text-[0.65rem]",
    lg: "h-9 min-w-9 px-1.5 text-xs"
  };
</script>

{#if iconUrl}
  <span
    class="unit-icon-frame inline-flex shrink-0 items-center justify-center rounded-full {frameClass[variant]} {className ?? ''}"
  >
    <img
      src={iconUrl}
      alt=""
      aria-hidden="true"
      class="{imgClass[variant]} shrink-0 object-contain"
      loading="lazy"
      decoding="async"
    />
  </span>
{:else if fallbackLabel}
  <span
    class="inline-flex items-center justify-center rounded-full border border-base-content/15 bg-white font-semibold leading-none {textPillClass[variant]} {className ?? ''}"
  >
    <span class="opacity-70">{fallbackLabel}</span>
  </span>
{/if}
