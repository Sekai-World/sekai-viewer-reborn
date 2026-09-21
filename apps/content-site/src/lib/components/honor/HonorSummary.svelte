<script lang="ts">
  import AssetImage from "$lib/components/shared/AssetImage.svelte";
  import Icon from "@iconify/svelte";

  let {
    name,
    groupName = null,
    compact = false,
    imageSrc = null,
    imageUnavailableLabel
  }: {
    name: string;
    groupName?: string | null;
    compact?: boolean;
    imageSrc?: string | null;
    imageUnavailableLabel: string;
  } = $props();
</script>

<div class="flex min-w-0 flex-col gap-3">
  {#if imageSrc}
    <div
      class={compact
        ? ""
        : "content-card-inset flex h-20 items-center justify-center rounded-xl p-3"}
    >
      <div class="h-12 w-full max-w-57">
        <AssetImage
          src={imageSrc}
          alt={compact ? "" : name}
          imageClass="h-full w-full object-contain"
          fallbackLabel={imageUnavailableLabel}
          loadMode="visible"
        />
      </div>
    </div>
  {/if}
  <div class="flex min-w-0 items-start gap-2">
    <Icon icon="mdi:medal-outline" class="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
    <div class="min-w-0">
      <svelte:element
        this={compact ? "h2" : "h3"}
        class="font-semibold wrap-anywhere text-(--archive-text-strong)">{name}</svelte:element
      >
      {#if groupName && groupName !== name}
        <p class="mt-1 text-sm wrap-break-word text-(--archive-text-muted)">{groupName}</p>
      {/if}
    </div>
  </div>
</div>
