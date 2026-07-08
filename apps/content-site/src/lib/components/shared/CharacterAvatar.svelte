<script lang="ts">
  type Variant = "sm" | "default";

  let {
    src,
    label,
    accentColor = null,
    variant = "default",
    class: className,
    imageClass = "size-full object-cover",
    onImageError
  }: {
    src: string | null;
    label: string;
    accentColor?: string | null;
    variant?: Variant;
    class?: string;
    imageClass?: string;
    onImageError?: (event: Event) => void;
  } = $props();

  const sizeClass: Record<Variant, string> = {
    sm: "size-12 text-sm",
    default: "size-20 text-lg"
  };
</script>

<span
  class="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-base-content/15 bg-base-100/80 font-bold text-primary {sizeClass[variant]} {className ?? ''}"
  style:border-color={accentColor ?? undefined}
  aria-label={label}
>
  {#if src}
    <img
      src={src}
      alt=""
      class={imageClass}
      loading="lazy"
      decoding="async"
      aria-hidden="true"
      onerror={onImageError}
    />
  {:else}
    {label.slice(0, 1) || "?"}
  {/if}
</span>
