<script lang="ts">
  import { ImagePreviewTrigger } from "@platform/ui-shell";

  let {
    src,
    alt = "",
    fallbackLabel = "",
    imageClass = "h-full w-full object-contain",
    buttonClass = "block w-full overflow-hidden",
    interactive = false,
    onclick
  }: {
    src: string;
    alt?: string;
    fallbackLabel?: string;
    imageClass?: string;
    buttonClass?: string;
    interactive?: boolean;
    onclick?: () => void;
  } = $props();
</script>

<ImagePreviewTrigger
  {src}
  {alt}
  {fallbackLabel}
  ariaLabel={alt || fallbackLabel}
  {buttonClass}
  {imageClass}
  disabled={!interactive}
  {onclick}
/>
