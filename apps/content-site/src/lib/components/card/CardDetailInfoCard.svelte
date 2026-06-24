<script lang="ts">
  import { asset } from "$app/paths";
  import type { CardDetail, CardDetailCharacter } from "$lib/domain/card-detail";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import { formatUnitFallbackLabel } from "$lib/domain/unit-profile";
  import Icon from "@iconify/svelte";

  let {
    card,
    displayLocale,
    title,
    idLabel,
    nameLabel,
    characterLabel,
    unitLabel,
    supportUnitLabel,
    attrLabel,
    rarityLabel,
    typeLabel,
    releaseAtLabel,
    unitProfiles
  }: {
    card: CardDetail;
    displayLocale: string;
    title: string;
    idLabel: string;
    nameLabel: string;
    characterLabel: string;
    unitLabel: string;
    supportUnitLabel: string;
    attrLabel: string;
    rarityLabel: string;
    typeLabel: string;
    releaseAtLabel: string;
    unitProfiles: Record<string, string>;
  } = $props();

  const rarityStarUrl = asset("/card_rarity/rarity_star_normal.png");

  const formatLabel = (value: string | null): string | null =>
    value
      ?.replaceAll("_", " ")
      .split(" ")
      .filter(Boolean)
      .map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
      .join(" ") ?? null;
  const getCharacterDisplayName = (character: CardDetailCharacter): string => {
    const parts = [character.firstName, character.givenName].filter(Boolean);
    return parts.length > 0 ? parts.join(" ") : character.id !== null ? String(character.id) : "--";
  };
  const getDisplayUnitName = (unit: string | null | undefined): string | null => {
    if (!unit) {
      return null;
    }

    const normalizedUnit = unit.trim().toLowerCase();
    return unitProfiles[normalizedUnit] ?? formatUnitFallbackLabel(normalizedUnit);
  };
  const getUnitIconUrl = (unit: string | null | undefined): string | null => {
    if (!unit) {
      return null;
    }

    return asset(`/icons/icon_${unit === "none" ? "piapro" : unit}.png`);
  };
  const getAttrIconUrl = (): string | null =>
    card.attr ? asset(`/card_attr/icon_attribute_${card.attr}_64.png`) : null;
  const getCharacterThumbnailUrl = (): string | null =>
    card.character?.id !== null && card.character?.id !== undefined
      ? getLocalCharacterThumbnailAssetURL(card.character.id)
      : null;
  const getRarityStarCount = (): number => {
    const match = card.rarityType?.match(/rarity_(\d+)/);
    if (!match?.[1]) {
      return 0;
    }

    const count = Number(match[1]);
    return Number.isFinite(count) && count > 0 ? count : 0;
  };
  const getRarityStarKeys = (): string[] =>
    Array.from({ length: getRarityStarCount() }, (_, index) => `rarity-star-${index}`);
  const shouldShowSupportUnit = (): boolean =>
    card.supportUnit !== "none" || card.character?.unit === "piapro";
</script>

{#snippet row(
  label: string,
  value: string | null,
  iconUrl: string | null = null,
  iconFrame = true
)}
  {#if value}
    <div class="content-card-inset flex items-center justify-between gap-4 rounded-xl px-4 py-3">
      <div class="min-w-0">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{label}</dt>
        <dd class="mt-1 truncate text-sm font-medium">{value}</dd>
      </div>
      {#if iconUrl}
        {#if iconFrame}
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-base-content/15 bg-base-100/70"
          >
            <img
              src={iconUrl}
              alt=""
              aria-hidden="true"
              class="size-11 max-w-none object-contain"
              loading="lazy"
              decoding="async"
            />
          </span>
        {:else}
          <img
            src={iconUrl}
            alt=""
            aria-hidden="true"
            class="size-11 shrink-0 object-contain"
            loading="lazy"
            decoding="async"
          />
        {/if}
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet rarityRow()}
  {@const starKeys = getRarityStarKeys()}
  {#if card.rarityType}
    <div class="content-card-inset flex items-center justify-between gap-4 rounded-xl px-4 py-3">
      <div class="min-w-0">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{rarityLabel}</dt>
        <dd class="mt-1 truncate text-sm font-medium">{formatLabel(card.rarityType)}</dd>
      </div>
      {#if starKeys.length > 0}
        <div class="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          {#each starKeys as starKey (starKey)}
            <img src={rarityStarUrl} alt="" class="size-5 object-contain" loading="lazy" decoding="async" />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-5">
    <div class="flex items-start justify-between gap-3">
      <p
        class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"
      >
        <Icon icon="mdi:card-account-details-outline" class="size-4" aria-hidden="true" />
        <span>{title}</span>
      </p>
      <span class="badge badge-outline border-base-content/20 font-semibold">
        {idLabel}{card.id}
      </span>
    </div>

    <dl class="space-y-2">
      {@render row(nameLabel, card.title)}
      {#if card.character}
        {@render row(characterLabel, getCharacterDisplayName(card.character), getCharacterThumbnailUrl())}
      {/if}
      {@render row(unitLabel, getDisplayUnitName(card.character?.unit), getUnitIconUrl(card.character?.unit))}
      {#if shouldShowSupportUnit()}
        {@render row(supportUnitLabel, getDisplayUnitName(card.supportUnit), getUnitIconUrl(card.supportUnit))}
      {/if}
      {@render row(attrLabel, formatLabel(card.attr), getAttrIconUrl(), false)}
      {@render rarityRow()}
      {@render row(typeLabel, formatLabel(card.cardSupplyType))}
      {@render row(releaseAtLabel, formatDisplayDateTime(card.releaseAt ?? card.archivePublishedAt, displayLocale))}
    </dl>
  </div>
</article>
