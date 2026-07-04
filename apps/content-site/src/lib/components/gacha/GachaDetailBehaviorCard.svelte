<script lang="ts">
  import type { GachaBehavior } from "$lib/domain/gacha-detail";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { getCommonMaterialThumbnailURL } from "$lib/assets/index";
  import Icon from "@iconify/svelte";

  let {
    behaviors,
    title,
    noBehaviorsLabel,
    spinCountLabel,
    costLabel: _costLabel,
    limitLabel,
    region = "jp",
    behaviorTypeMap,
    spinnableTypeMap,
    resourceCategoryMap,
    costResourceTypeMap
  }: {
    behaviors: GachaBehavior[];
    title: string;
    noBehaviorsLabel: string;
    spinCountLabel: string;
    costLabel: string;
    limitLabel: string;
    region?: SupportedRegion;
    behaviorTypeMap: Record<string, string>;
    spinnableTypeMap: Record<string, string>;
    resourceCategoryMap: Record<string, string>;
    costResourceTypeMap: Record<string, string>;
  } = $props();

  /**
   * Maps costResourceType to the common_material asset bundle name.
   * Both "jewel" and "paid_jewel" use the same jewel icon;
   * paid_jewel gets a "(Paid)" indicator appended via formatCostLine.
   * "gacha_ticket" icons require per-ticket assetbundleName lookup
   * (not yet available from API), so we fall back to a FontAwesome icon.
   */
  const COST_RESOURCE_ICON_MAP: Record<string, string> = {
    jewel: "jewel",
    paid_jewel: "jewel",
  };

  const getCostResourceIconURL = (
    costResourceType: string | null
  ): string | null => {
    if (!costResourceType) return null;
    const bundleName = COST_RESOURCE_ICON_MAP[costResourceType];
    if (!bundleName) return null;
    return getCommonMaterialThumbnailURL(bundleName, region);
  };

  /** Whether to show a ticket icon (Iconify) instead of a game asset image. */
  const isTicketResource = (costResourceType: string | null): boolean =>
    costResourceType === "gacha_ticket";

  const getBehaviorDisplay = (type: string | null): string => {
    if (!type) return "—";
    return behaviorTypeMap[type] ?? type;
  };

  const getSpinnableDisplay = (type: string | null): string => {
    if (!type) return "";
    return spinnableTypeMap[type] ?? type;
  };

  const getResourceCategoryDisplay = (category: string | null): string => {
    if (!category) return "";
    return resourceCategoryMap[category] ?? category;
  };

  const getCostResourceTypeDisplay = (type: string | null): string => {
    if (!type) return "";
    return costResourceTypeMap[type] ?? type;
  };

  const formatCostLine = (behavior: GachaBehavior): string => {
    const quantity = behavior.costResourceQuantity ?? 0;
    const resourceType = getCostResourceTypeDisplay(behavior.costResourceType);
    if (resourceType) {
      return `${resourceType} ×${quantity}`;
    }
    const category = getResourceCategoryDisplay(behavior.resourceCategory);
    if (category) {
      return `${category} ×${quantity}`;
    }
    return `×${quantity}`;
  };

  type BehaviorGroup = {
    key: string;
    type: string;
    display: string;
    spinnableBadge: string | null;
    variants: GachaBehavior[];
  };

  /**
   * Group key uses only the fields that determine the visual "name" of the
   * behavior — the behavior type and the spinnable type. Cost, spin count,
   * and execute-limit vary per price tier / option and are shown as sub-rows
   * within the group rather than splitting into separate cards.
   */
  const getBehaviorGroupKey = (behavior: GachaBehavior): string =>
    [behavior.gachaBehaviorType ?? "", behavior.gachaSpinnableType ?? ""].join(
      ":"
    );

  const getBehaviorVariantKey = (behavior: GachaBehavior, index: number): string =>
    [
      behavior.id ?? "",
      behavior.gachaBehaviorType ?? "",
      behavior.gachaSpinnableType ?? "",
      behavior.resourceCategory ?? "",
      behavior.costResourceType ?? "",
      behavior.costResourceQuantity ?? "",
      behavior.spinCount ?? "",
      behavior.executeLimit ?? "",
      behavior.priority ?? "",
      index
    ].join(":");

  const groupedBehaviors = $derived((): BehaviorGroup[] => {
    const sorted = [...behaviors].sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
    );
    const map: Record<string, GachaBehavior[]> = {};
    const firstOfType: Record<string, GachaBehavior> = {};
    for (const b of sorted) {
      const key = getBehaviorGroupKey(b);
      if (!map[key]) {
        map[key] = [];
        firstOfType[key] = b;
      }
      map[key].push(b);
    }
    const result: BehaviorGroup[] = [];
    for (const [key, variants] of Object.entries(map)) {
      const first = firstOfType[key];
      const spinnable =
        first.gachaSpinnableType && first.gachaSpinnableType !== "any"
          ? getSpinnableDisplay(first.gachaSpinnableType)
          : null;
      result.push({
        key,
        type: first.gachaBehaviorType ?? "",
        display: getBehaviorDisplay(first.gachaBehaviorType),
        spinnableBadge: spinnable,
        variants,
      });
    }
    return result;
  });

  const hasMultipleVariants = (group: BehaviorGroup): boolean =>
    group.variants.length > 1;

  const variantSummaryLabel = (behavior: GachaBehavior): string | null => {
    if (behavior.costResourceType !== null) {
      return formatCostLine(behavior);
    }
    if (behavior.resourceCategory === "free_resource") {
      return getResourceCategoryDisplay(behavior.resourceCategory);
    }
    return null;
  };
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <p
      class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
    >
      <Icon
        icon="mdi:slot-machine-outline"
        class="size-4 shrink-0 translate-y-[0.5px]"
        aria-hidden="true"
      />
      <span>{title}</span>
    </p>

    {#if behaviors.length === 0}
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-6 text-center text-sm opacity-70">
        {noBehaviorsLabel}
      </div>
    {:else}
      <div class="space-y-2.5">
        {#each groupedBehaviors() as group (group.key)}
          <div class="content-card-inset rounded-xl p-3 sm:px-4">
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-semibold">{group.display}</span>
              <span class="flex items-center gap-1.5">
                {#if hasMultipleVariants(group)}
                  <span class="badge badge-ghost badge-sm font-medium opacity-50">
                    ×{group.variants.length}
                  </span>
                {/if}
                {#if group.spinnableBadge}
                  <span class="badge badge-outline badge-sm border-base-content/20 font-medium">
                    {group.spinnableBadge}
                  </span>
                {/if}
              </span>
            </div>

            {#if hasMultipleVariants(group)}
              <div class="mt-2 divide-base-content/10 divide-y">
                {#each group.variants as behavior, index (getBehaviorVariantKey(behavior, index))}
                  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 py-1.5 text-xs first:pt-2 last:pb-0">
                    {#if variantSummaryLabel(behavior)}
                      <span class="inline-flex items-center gap-1 font-medium opacity-80">
                        {#if isTicketResource(behavior.costResourceType)}
                          <Icon
                            icon="mdi:ticket-outline"
                            class="inline size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                        {:else if getCostResourceIconURL(behavior.costResourceType)}
                          <img
                            src={getCostResourceIconURL(behavior.costResourceType)!}
                            alt={getCostResourceTypeDisplay(behavior.costResourceType)}
                            class="inline size-3.5 shrink-0"
                            loading="lazy"
                          />
                        {/if}
                        {variantSummaryLabel(behavior)}
                      </span>
                    {/if}
                    {#if behavior.spinCount !== null}
                      <span class="opacity-70">
                        <span class="font-medium opacity-60">{spinCountLabel}:</span>
                        {behavior.spinCount}
                      </span>
                    {/if}
                    {#if behavior.executeLimit !== null}
                      <span class="opacity-70">
                        <span class="font-medium opacity-60">{limitLabel}:</span>
                        {behavior.executeLimit > 0 ? behavior.executeLimit : "∞"}
                      </span>
                    {/if}
                  </div>
                {/each}
              </div>
            {:else}
              {@const behavior = group.variants[0]}
              <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {#if variantSummaryLabel(behavior)}
                  <span class="inline-flex items-center gap-1 font-medium opacity-80">
                    {#if isTicketResource(behavior.costResourceType)}
                      <Icon
                        icon="mdi:ticket-outline"
                        class="inline size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                    {:else if getCostResourceIconURL(behavior.costResourceType)}
                      <img
                        src={getCostResourceIconURL(behavior.costResourceType)!}
                        alt={getCostResourceTypeDisplay(behavior.costResourceType)}
                        class="inline size-3.5 shrink-0"
                        loading="lazy"
                      />
                    {/if}
                    {variantSummaryLabel(behavior)}
                  </span>
                {/if}
                {#if behavior.spinCount !== null}
                  <span class="opacity-70">
                    <span class="font-medium opacity-60">{spinCountLabel}:</span>
                    {behavior.spinCount}
                  </span>
                {/if}
                {#if behavior.executeLimit !== null}
                  <span class="opacity-70">
                    <span class="font-medium opacity-60">{limitLabel}:</span>
                    {behavior.executeLimit > 0 ? behavior.executeLimit : "∞"}
                  </span>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</article>
