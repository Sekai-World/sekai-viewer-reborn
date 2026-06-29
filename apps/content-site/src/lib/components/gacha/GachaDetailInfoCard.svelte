<script lang="ts">
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import type { GachaDetail } from "$lib/domain/gacha-detail";
  import Icon from "@iconify/svelte";

  /** Map from raw gachaType value (lowercase) to localized display string. */
  let {
    gacha,
    uiLocale,
    title,
    idLabel,
    nameLabel,
    gachaTypeLabel,
    gachaTypeMap,
    startAtLabel,
    endAtLabel,
    costLabel,
    noGachaDataLabel
  }: {
    gacha: GachaDetail;
    uiLocale: string;
    title: string;
    idLabel: string;
    nameLabel: string;
    gachaTypeLabel: string;
    gachaTypeMap: Record<string, string>;
    startAtLabel: string;
    endAtLabel: string;
    costLabel: string;
    noGachaDataLabel: string;
  } = $props();

  const getGachaTypeDisplay = (gachaType: string | null): string => {
    if (!gachaType) return noGachaDataLabel;
    const normalized = gachaType.trim().toLowerCase();
    return gachaTypeMap[normalized] ?? gachaType;
  };

  const formatCost = (): string => {
    if (gacha.costCount === null) return noGachaDataLabel;
    const parts: string[] = [String(gacha.costCount)];
    if (gacha.costResourceType) {
      parts.push(gacha.costResourceType);
    }
    if (gacha.costResourceId) {
      parts.push(`:${gacha.costResourceId}`);
    }
    return parts.join(" ");
  };
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
    <div class="flex items-start justify-between gap-3">
      <p
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon
          icon="mdi:information-outline"
          class="size-4 shrink-0 translate-y-[0.5px]"
          aria-hidden="true"
        />
        <span>{title}</span>
      </p>
      <span class="badge badge-outline border-base-content/20 font-semibold">
        {idLabel}{gacha.id}
      </span>
    </div>

    <dl class="space-y-2">
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
        <dd class="mt-1 text-sm font-medium">{gacha.name ?? noGachaDataLabel}</dd>
      </div>
      {#if gacha.gachaType}
        <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {gachaTypeLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">{getGachaTypeDisplay(gacha.gachaType)}</dd>
        </div>
      {/if}
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {gacha.startAt ? formatDisplayDateTime(gacha.startAt, uiLocale) : noGachaDataLabel}
        </dd>
      </div>
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {gacha.endAt ? formatDisplayDateTime(gacha.endAt, uiLocale) : noGachaDataLabel}
        </dd>
      </div>
      <div class="content-card-inset rounded-xl px-3 sm:px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{costLabel}</dt>
        <dd class="mt-1 text-sm font-medium">{formatCost()}</dd>
      </div>
    </dl>
  </div>
</article>
