<script lang="ts">
  import { asset } from "$app/paths";
  import { getEventPointIconAssetURL } from "$lib/assets";
  import { formatDisplayDateTime } from "$lib/date-time";
  import type { BannerGameCharacter, EventDetail } from "$lib/event-detail";
  import { getEventTypeDisplay } from "$lib/event";
  import type { SupportedRegion } from "$lib/regions";
  import Icon from "@iconify/svelte";

  const unitIconSlugs = new Set([
    "idol",
    "light_sound",
    "piapro",
    "school_refusal",
    "street",
    "theme_park"
  ]);

  let {
    event,
    region,
    uiLocale,
    displayLocale,
    title,
    idLabel,
    nameLabel,
    unitLabel,
    mixedUnitLabel,
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
    nameLabel: string;
    unitLabel: string;
    mixedUnitLabel: string;
    eventTypeLabel: string;
    startAtLabel: string;
    endAtLabel: string;
    bannerCharacterLabel: string;
  } = $props();
  const getCharacterDisplayName = (char: BannerGameCharacter): string => {
    const parts = [char.firstName, char.givenName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : String(char.id);
  };

  const getDisplayUnitName = (unitName: string | null | undefined): string | null => {
    if (!unitName) {
      return null;
    }

    const normalizedUnitName = unitName.trim().toLowerCase();
    return normalizedUnitName === "none" || normalizedUnitName === "-" ? mixedUnitLabel : unitName;
  };
  const getUnitIconUrl = (unit: string | null | undefined): string | null => {
    if (!unit) {
      return null;
    }

    const slug = unit.trim().toLowerCase();
    return unitIconSlugs.has(slug) ? asset(`/icons/icon_${slug}.png`) : null;
  };
  const getCharacterIconUrl = (characterId: number): string =>
    asset(`/chr_il/chr_il_${characterId}.png`);
</script>

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-5">
    <div class="flex items-start justify-between gap-3">
      <p
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon
          icon="mdi:information-outline"
          class="h-4 w-4 shrink-0 translate-y-[0.5px]"
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
            class="h-6 w-6 shrink-0 object-contain"
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
      <div class="content-card-inset rounded-xl px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
        <dd class="mt-1 text-sm font-medium">{event.title}</dd>
      </div>
      {#if getDisplayUnitName(event.unitName)}
        <div
          class="content-card-inset flex items-center justify-between gap-4 rounded-xl px-4 py-3"
        >
          <div class="min-w-0">
            <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
              {unitLabel}
            </dt>
            <dd class="mt-1 truncate text-sm font-medium">{getDisplayUnitName(event.unitName)}</dd>
          </div>
          {#if getUnitIconUrl(event.unit)}
            <span
              class="unit-icon-frame flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-base-content/15 bg-base-100/70"
            >
              <img
                src={getUnitIconUrl(event.unit)}
                alt=""
                aria-hidden="true"
                class="h-12 w-12 max-w-none object-contain"
                loading="lazy"
                decoding="async"
              />
            </span>
          {/if}
        </div>
      {/if}
      {#if event.eventType}
        <div class="content-card-inset rounded-xl px-4 py-3">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {eventTypeLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">
            {getEventTypeDisplay(event.eventType, uiLocale)}
          </dd>
        </div>
      {/if}
      <div class="content-card-inset rounded-xl px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {formatDisplayDateTime(event.startAt, displayLocale)}
        </dd>
      </div>
      <div class="content-card-inset rounded-xl px-4 py-3">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {formatDisplayDateTime(event.endAt, displayLocale)}
        </dd>
      </div>
      {#if event.bannerGameCharacter}
        {@const char = event.bannerGameCharacter}
        <div class="content-card-inset flex items-center gap-3 rounded-xl px-4 py-3">
          <div class="min-w-0 flex-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
              {bannerCharacterLabel}
            </dt>
            <dd class="mt-1 text-sm font-medium">{getCharacterDisplayName(char)}</dd>
          </div>
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-base-content/15 bg-base-100/70"
          >
            <img
              src={getCharacterIconUrl(char.id)}
              alt={getCharacterDisplayName(char)}
              class="h-12 w-12 max-w-none object-cover"
              loading="lazy"
              decoding="async"
            />
          </span>
        </div>
      {/if}
    </dl>
  </div>
</article>
