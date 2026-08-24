<script lang="ts">
  import { getStaticUnitColor } from "$lib/domain/unit-colors";
  import { resolveUnitIconUrl } from "$lib/domain/unit-icon";

  type Variant = "sm" | "default" | "lg";

  let {
    unit,
    fallbackLabel,
    mapNoneToPiapro = false,
    variant = "default",
    href,
    ariaLabel,
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
    /** Makes the complete badge a semantic link while preserving its visual frame. */
    href?: string;
    /** Accessible name for a linked badge. */
    ariaLabel?: string;
    /** Extra classes forwarded to the outer element. */
    class?: string;
  } = $props();

  const iconUrl = $derived(resolveUnitIconUrl(unit, mapNoneToPiapro));
  const borderColor = $derived(getStaticUnitColor(unit, mapNoneToPiapro) ?? undefined);

  const frameClass: Record<Variant, string> = {
    sm: "size-7 border border-base-content/15 bg-white",
    default: "size-9 border border-base-content/15 bg-white",
    lg: "size-11 border-2 border-base-content/15 bg-white"
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
  {#if href}
    <a
      {href}
      aria-label={ariaLabel ?? fallbackLabel ?? unit}
      class="unit-icon-frame inline-flex shrink-0 items-center justify-center rounded-full outline-none transition-[transform,border-color] duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 {frameClass[
        variant
      ]} {className ?? ''}"
      style:border-color={borderColor}
    >
      <img
        src={iconUrl}
        alt=""
        aria-hidden="true"
        class="{imgClass[variant]} shrink-0 object-contain"
        loading="lazy"
        decoding="async"
      />
    </a>
  {:else}
    <span
      class="unit-icon-frame inline-flex shrink-0 items-center justify-center rounded-full {frameClass[
        variant
      ]} {className ?? ''}"
      style:border-color={borderColor}
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
  {/if}
{:else if fallbackLabel}
  {#if href}
    <a
      {href}
      aria-label={ariaLabel ?? fallbackLabel}
      class="inline-flex items-center justify-center rounded-full border border-base-content/15 bg-white font-semibold leading-none outline-none transition-[transform,border-color] duration-150 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 {textPillClass[
        variant
      ]} {className ?? ''}"
      style:border-color={borderColor}
    >
      <span class="opacity-70">{fallbackLabel}</span>
    </a>
  {:else}
    <span
      class="inline-flex items-center justify-center rounded-full border border-base-content/15 bg-white font-semibold leading-none {textPillClass[
        variant
      ]} {className ?? ''}"
      style:border-color={borderColor}
    >
      <span class="opacity-70">{fallbackLabel}</span>
    </span>
  {/if}
{/if}
