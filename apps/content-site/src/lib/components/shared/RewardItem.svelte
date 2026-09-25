<script lang="ts">
  import type { MissionResourceBoxDetail } from "$lib/domain/mission";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getRewardItemIcon } from "$lib/domain/reward-item";

  let {
    detail,
    region,
    label,
    quantityLabel = null,
    class: className = ""
  }: {
    detail: Pick<
      MissionResourceBoxDetail,
      "resourceType" | "resourceId" | "resourceAssetbundleName"
    >;
    region: SupportedRegion;
    /** The item's name: the icon's tooltip and accessible label, or the text without an icon. */
    label: string;
    /** Already formatted, for example "×100". */
    quantityLabel?: string | null;
    class?: string;
  } = $props();

  // Without a configured asset server the item still shows as text.
  const icon = $derived.by(() => {
    try {
      return getRewardItemIcon(detail, region);
    } catch {
      return null;
    }
  });
  // How many icon sources have failed: 0 shows `src`, 1 shows `fallbackSrc`, then text only.
  let failures = $state(0);
  $effect(() => {
    void icon?.src;
    failures = 0;
  });
  const src = $derived(
    !icon ? null : failures === 0 ? icon.src : failures === 1 ? icon.fallbackSrc : null
  );
</script>

{#if src}
  <!-- A game-asset icon may stand alone (DESIGN.md, Focus and accessibility): the tooltip
       and the accessible label carry the item's name. -->
  <span
    class="tooltip inline-flex shrink-0 items-center gap-1 align-middle {className}"
    data-tip={label}
    role="img"
    aria-label={quantityLabel ? `${label} ${quantityLabel}` : label}
  >
    <img
      {src}
      alt=""
      class="size-6 shrink-0 object-contain"
      loading="lazy"
      decoding="async"
      onerror={() => (failures += 1)}
    />
    {#if quantityLabel}<span class="tabular-nums" aria-hidden="true">{quantityLabel}</span>{/if}
  </span>
{:else}
  <span class="inline-flex min-w-0 items-center gap-1.5 align-middle {className}">
    <span class="min-w-0 wrap-anywhere">{label}</span>
    {#if quantityLabel}<span class="shrink-0 tabular-nums">{quantityLabel}</span>{/if}
  </span>
{/if}
