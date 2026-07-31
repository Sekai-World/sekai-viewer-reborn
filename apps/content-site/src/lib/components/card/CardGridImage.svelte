<script lang="ts">
  import { onDestroy } from "svelte";
  import {
    ImageRetryController,
    STATIC_ASSET_RETRY_POLICY,
    type ImageRetryPolicy
  } from "@platform/ui-shell/image-retry";

  let {
    src,
    fallbackSrc = null,
    alt,
    class: className = "",
    loading = "lazy",
    decoding = "async",
    retryPolicy = STATIC_ASSET_RETRY_POLICY
  }: {
    src: string;
    fallbackSrc?: string | null;
    alt: string;
    class?: string;
    loading?: "eager" | "lazy";
    decoding?: "async" | "auto" | "sync";
    retryPolicy?: ImageRetryPolicy;
  } = $props();

  const getInitialRetrySources = (): [string, string | undefined, ImageRetryPolicy] => [
    src,
    fallbackSrc ?? undefined,
    retryPolicy
  ];
  const imageRetry = new ImageRetryController(...getInitialRetrySources());

  $effect.pre(() => {
    imageRetry.setSources(src, fallbackSrc ?? undefined, retryPolicy);
  });

  onDestroy(() => imageRetry.dispose());
</script>

{#key imageRetry.requestKey}
  {@const requestSnapshot = imageRetry.requestSnapshot}
  <img
    src={imageRetry.requestUrl}
    {alt}
    class={className}
    {loading}
    {decoding}
    onload={() => requestSnapshot && imageRetry.handleImageLoad(requestSnapshot)}
    onerror={() => requestSnapshot && imageRetry.handleImageError(requestSnapshot)}
  />
{/key}
