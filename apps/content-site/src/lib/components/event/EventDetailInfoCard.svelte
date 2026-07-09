<script lang="ts">
  import { getEventPointIconAssetURL } from "$lib/assets/index";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import type { BannerGameCharacter, EventDetail } from "$lib/domain/event-detail";
  import { getEventTypeDisplay } from "$lib/domain/event";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { formatUnitFallbackLabel } from "$lib/domain/unit-profile";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import Icon from "@iconify/svelte";

  let {
    event,
    region,
    uiLocale,
    displayLocale,
    title,
    idLabel,
    internalResourceCodeLabel,
    nameLabel,
    unitLabel,
    mixedUnitLabel,
    unitProfiles,
    eventTypeLabel,
    startAtLabel,
    endAtLabel,
    bannerCharacterLabel
  }: {
    event: EventDetail;
    region: SupportedRegion;
    uiLocale: string;
    displayLocale: string;
    title: string;
    idLabel: string;
    internalResourceCodeLabel: string;
    nameLabel: string;
    unitLabel: string;
    mixedUnitLabel: string;
    unitProfiles: Record<string, string>;
    eventTypeLabel: string;
    startAtLabel: string;
    endAtLabel: string;
    bannerCharacterLabel: string;
  } = $props();
  const getCharacterDisplayName = (char: BannerGameCharacter): string => {
    const parts = [char.firstName, char.givenName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : String(char.id);
  };

  const getDisplayUnitName = (unit: string | null | undefined): string | null => {
    if (!unit) {
      return null;
    }

    const normalizedUnit = unit.trim().toLowerCase();
    return normalizedUnit === "none" || normalizedUnit === "-"
      ? mixedUnitLabel
      : (unitProfiles[normalizedUnit] ?? formatUnitFallbackLabel(normalizedUnit));
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
      <div class="flex items-center gap-1.5">
        {#if event.eventPointIcon}
          <img
            src={getEventPointIconAssetURL(event.eventPointIcon, region)}
            alt=""
            aria-hidden="true"
            class="size-6 shrink-0 object-contain"
            loading="lazy"
            decoding="async"
          />
        {/if}
        <span class="badge badge-outline border-base-content/20 font-semibold">
          {idLabel}{event.id}
        </span>
      </div>
    </div>

    <dl class="space-y-2">
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
        <dd class="mt-1 text-sm font-medium">{event.title}</dd>
      </div>
      {#if event.eventType}
        <div class="content-card-inset rounded-xl p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {eventTypeLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">
            {getEventTypeDisplay(event.eventType, uiLocale)}
          </dd>
        </div>
      {/if}
      {#if getDisplayUnitName(event.unit)}
        <div
          class="content-card-inset flex items-center justify-between gap-4 rounded-xl p-3 sm:px-4"
        >
          <div class="min-w-0">
            <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
              {unitLabel}
            </dt>
            <dd class="mt-1 truncate text-sm font-medium">{getDisplayUnitName(event.unit)}</dd>
          </div>
          {#if event.unit}
            <UnitIconBadge unit={event.unit} variant="lg" />
          {/if}
        </div>
      {/if}
      {#if event.bannerGameCharacter}
        {@const char = event.bannerGameCharacter}
        <div class="content-card-inset flex items-center gap-3 rounded-xl p-3 sm:px-4">
          <div class="min-w-0 flex-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
              {bannerCharacterLabel}
            </dt>
            <dd class="mt-1 text-sm font-medium">{getCharacterDisplayName(char)}</dd>
          </div>
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-base-content/15 bg-base-100/70"
          >
            <img
              src={getLocalCharacterThumbnailAssetURL(char.id) ?? ""}
              alt={getCharacterDisplayName(char)}
              class="size-11 rounded-full object-contain"
              loading="lazy"
              decoding="async"
            />
          </span>
        </div>
      {/if}
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {formatDisplayDateTime(event.startAt, displayLocale)}
        </dd>
      </div>
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {formatDisplayDateTime(event.endAt, displayLocale)}
        </dd>
      </div>
      <div class="content-card-inset rounded-xl p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {internalResourceCodeLabel}
        </dt>
        <dd class="mt-1 text-sm font-medium">{event.assetBundleName ?? "--"}</dd>
      </div>
    </dl>
  </div>
</article>
