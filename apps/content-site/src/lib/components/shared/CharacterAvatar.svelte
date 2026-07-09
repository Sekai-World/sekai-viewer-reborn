<script lang="ts">
  import { getStaticCharacterColor } from "$lib/domain/character-colors";

  type Variant = "xs" | "sm" | "default" | "lg";

  let {
    src,
    label,
    accentColor = null,
    characterId = null,
    variant = "default",
    decorative = false,
    class: className,
    imageClass,
    onImageError
  }: {
    src: string | null;
    label: string;
    accentColor?: string | null;
    characterId?: string | number | null;
    variant?: Variant;
    decorative?: boolean;
    class?: string;
    imageClass?: string;
    onImageError?: (event: Event) => void;
  } = $props();

  const sizeClass: Record<Variant, string> = {
    xs: "size-7 border text-xs",
    sm: "size-12 border-2 text-sm",
    default: "size-20 border-2 text-lg",
    lg: "size-11 border-2 text-sm"
  };

  const defaultImageClass: Record<Variant, string> = {
    xs: "size-full object-contain",
    sm: "size-full object-cover",
    default: "size-full object-cover",
    lg: "size-full max-w-none object-contain"
  };

  const borderColor = $derived(accentColor ?? getStaticCharacterColor(characterId) ?? undefined);
</script>

<span
  class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-primary/45 bg-base-100/80 font-bold text-primary {sizeClass[variant]} {className ?? ''}"
  style:border-color={borderColor}
  aria-label={decorative ? undefined : label}
  aria-hidden={decorative ? "true" : undefined}
>
  {#if src}
    <img
      src={src}
      alt=""
      class={imageClass ?? defaultImageClass[variant]}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
      onerror={onImageError}
    />
  {:else}
    {label.slice(0, 1) || "?"}
  {/if}
</span>
