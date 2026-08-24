<script lang="ts">
  import { AssetImage } from "@platform/ui-shell";
  import type { ImageRetryPolicy } from "@platform/ui-shell/image-retry";

  let props = $props<{
    src: string;
    fallbackSrc?: string;
    alt?: string;
    fallbackLabel?: string;
    imageClass?: string;
    buttonClass?: string;
    loadMode?: "immediate" | "visible";
    interactive?: boolean;
    retryPolicy?: ImageRetryPolicy;
    onclick?: () => void;
  }>();
</script>

<AssetImage {...props} />
