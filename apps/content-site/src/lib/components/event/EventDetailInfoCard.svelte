<script lang="ts">
  import { resolve } from "$app/paths";
  import { getEventPointIconAssetURL } from "$lib/assets/index";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import type { BannerGameCharacter, EventDetail } from "$lib/domain/event-detail";
  import { getEventTypeDisplay } from "$lib/domain/event";
  import type { SupportedRegion } from "$lib/domain/regions";
  import { formatUnitFallbackLabel } from "$lib/domain/unit-profile";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import UnitIconBadge from "$lib/components/shared/UnitIconBadge.svelte";
  import { resolveCanonicalUnitSlug } from "$lib/domain/unit-icon";
  import Icon from "@iconify/svelte";
  import type { I18nTranslator } from "@platform/i18n-runtime";

  let {
    event,
    region,
    translate,
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
    translate: I18nTranslator;
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

<article
  class="card content-card-shell shadow-[0_8px_24px_color-mix(in_oklab,var(--color-base-content)_4%,transparent)]"
>
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
        <span
          class="badge badge-outline border-(--archive-border-default) bg-(--archive-surface-raised) font-semibold text-(--archive-text-default)"
        >
          {idLabel}{event.id}
        </span>
      </div>
    </div>

    <dl class="space-y-2">
      <div class="content-card-inset rounded-xl border-(--archive-border-subtle) p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{nameLabel}</dt>
        <dd class="mt-1 text-sm font-medium">{event.title}</dd>
      </div>
      {#if event.eventType}
        <div class="content-card-inset rounded-xl border-(--archive-border-subtle) p-3 sm:px-4">
          <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
            {eventTypeLabel}
          </dt>
          <dd class="mt-1 text-sm font-medium">
            {getEventTypeDisplay(event.eventType, translate)}
          </dd>
        </div>
      {/if}
      {#if getDisplayUnitName(event.unit)}
        {@const canonicalUnit = event.unit ? resolveCanonicalUnitSlug(event.unit) : null}
        {@const unitHref =
          canonicalUnit ? resolve("/unit/[region]/[unit]", { region, unit: canonicalUnit }) : null}
        <svelte:element
          this={unitHref ? "a" : "div"}
          href={unitHref ?? undefined}
          class={`content-card-inset flex items-center gap-3 rounded-xl p-3 sm:px-4 outline-none transition-[background-color,border-color,transform] duration-180 ease-out ${
            unitHref
              ? "group/event-unit-row border-(--archive-border-default) hover:-translate-y-0.5 hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              : "border-(--archive-border-subtle)"
          }`}
          aria-label={unitHref ? (getDisplayUnitName(event.unit) ?? undefined) : undefined}
        >
          <div class="min-w-0 flex-1">
            <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
              {unitLabel}
            </dt>
            <dd
              class={`mt-1 truncate text-sm font-medium ${unitHref ? "group-hover/event-unit-row:text-primary group-focus-visible/event-unit-row:text-primary" : ""}`}
            >
              {getDisplayUnitName(event.unit)}
            </dd>
          </div>
          {#if event.unit}
            <UnitIconBadge unit={event.unit} variant="lg" />
          {/if}
        </svelte:element>
      {/if}
      {#if event.bannerGameCharacter}
        {@const char = event.bannerGameCharacter}
        {#if char.id > 0}
          <a
            href={resolve("/character/[region]/[id]", { region, id: String(char.id) })}
            class="content-card-inset group/banner-character-row flex items-center gap-3 rounded-xl border-(--archive-border-default) p-3 sm:px-4 outline-none transition-[background-color,border-color] duration-150 hover:border-primary/35 hover:bg-(--archive-surface-raised) focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            aria-label={getCharacterDisplayName(char)}
          >
            <div class="min-w-0 flex-1">
              <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                {bannerCharacterLabel}
              </dt>
              <dd
                class="mt-1 text-sm font-medium group-hover/banner-character-row:text-primary group-focus-visible/banner-character-row:text-primary"
              >
                {getCharacterDisplayName(char)}
              </dd>
            </div>
            <CharacterAvatar
              src={getLocalCharacterThumbnailAssetURL(char.id)}
              label={getCharacterDisplayName(char)}
              characterId={char.id}
              variant="lg"
              decorative
            />
          </a>
        {:else}
          <div
            class="content-card-inset flex items-center gap-3 rounded-xl border-(--archive-border-subtle) p-3 sm:px-4"
          >
            <div class="min-w-0 flex-1">
              <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                {bannerCharacterLabel}
              </dt>
              <dd class="mt-1 text-sm font-medium">{getCharacterDisplayName(char)}</dd>
            </div>
            <CharacterAvatar
              src={getLocalCharacterThumbnailAssetURL(char.id)}
              label={getCharacterDisplayName(char)}
              characterId={char.id}
              variant="lg"
            />
          </div>
        {/if}
      {/if}
      <div class="content-card-inset rounded-xl border-(--archive-border-subtle) p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{startAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {formatDisplayDateTime(event.startAt, displayLocale)}
        </dd>
      </div>
      <div class="content-card-inset rounded-xl border-(--archive-border-subtle) p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{endAtLabel}</dt>
        <dd class="mt-1 text-sm font-medium">
          {formatDisplayDateTime(event.endAt, displayLocale)}
        </dd>
      </div>
      <div class="content-card-inset rounded-xl border-(--archive-border-subtle) p-3 sm:px-4">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {internalResourceCodeLabel}
        </dt>
        <dd class="mt-1 text-sm font-medium">{event.assetBundleName ?? "--"}</dd>
      </div>
    </dl>
  </div>
</article>
