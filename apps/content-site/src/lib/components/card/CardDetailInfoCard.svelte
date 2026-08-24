<script lang="ts">
  import { asset, resolve } from "$app/paths";
  import type { SupportedRegion } from "$lib/domain/regions";
  import type { CardDetail, CardDetailCharacter } from "$lib/domain/card-detail";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import { getCardGachaVoiceAssetURL } from "$lib/assets/index";
  import { formatDisplayDateTime } from "$lib/time/date-time";
  import { formatUnitFallbackLabel } from "$lib/domain/unit-profile";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import { UnitIconBadge } from "@platform/ui-shell";
  import { resolveCanonicalUnitSlug } from "$lib/domain/unit-icon";
  import VoicePlayButton from "$lib/components/shared/VoicePlayButton.svelte";
  import Icon from "@iconify/svelte";

  let {
    card,
    region,
    displayLocale,
    title,
    idLabel,
    internalResourceCodeLabel,
    nameLabel,
    characterLabel,
    unitLabel,
    supportUnitLabel,
    attrLabel,
    rarityLabel,
    typeLabel,
    releaseAtLabel,
    gachaPhraseLabel,
    audioPlayLabel,
    audioUnavailableLabel,
    unitProfiles
  }: {
    card: CardDetail;
    region: SupportedRegion;
    displayLocale: string;
    title: string;
    idLabel: string;
    internalResourceCodeLabel: string;
    nameLabel: string;
    characterLabel: string;
    unitLabel: string;
    supportUnitLabel: string;
    attrLabel: string;
    rarityLabel: string;
    typeLabel: string;
    releaseAtLabel: string;
    gachaPhraseLabel: string;
    audioPlayLabel: string;
    audioUnavailableLabel: string;
    unitProfiles: Record<string, string>;
  } = $props();

  const rarityStarUrl = asset("/card_rarity/rarity_star_normal.png");
  const rarityBirthdayUrl = asset("/card_rarity/rarity_birthday.png");
  const normalizedGachaPhrase = $derived(card.gachaPhrase?.trim() ?? "");
  const shouldShowGachaPhrase = $derived(
    normalizedGachaPhrase.length > 0 && normalizedGachaPhrase !== "-"
  );
  const gachaPhraseAudioUrl = $derived(
    shouldShowGachaPhrase && card.assetBundleName
      ? getCardGachaVoiceAssetURL(card.assetBundleName)
      : null
  );

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
  const getAttrIconUrl = (): string | null =>
    card.attr ? asset(`/card_attr/icon_attribute_${card.attr}.png`) : null;
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
  const getRarityIconUrls = (): string[] =>
    card.rarityType === "rarity_birthday"
      ? [rarityBirthdayUrl]
      : getRarityStarKeys().map(() => rarityStarUrl);
  const shouldShowSupportUnit = (): boolean =>
    card.supportUnit !== "none" || card.character?.unit === "piapro";
</script>

{#snippet row(
  label: string,
  value: string | null,
  iconUrl: string | null = null,
  iconFrame = true,
  unitSlug: string | null = null
)}
  {#if value}
    {@const canonicalUnit = unitSlug ? resolveCanonicalUnitSlug(unitSlug) : null}
    {@const unitHref =
      canonicalUnit ? resolve("/unit/[region]/[unit]", { region, unit: canonicalUnit }) : null}
    <svelte:element
      this={unitHref ? "a" : "div"}
      href={unitHref ?? undefined}
      class={`content-card-inset flex items-center gap-3 rounded-xl p-3 sm:px-4 outline-none transition-[background-color,border-color,transform] duration-180 ease-out ${
        unitHref
          ? "group/card-unit-row hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          : ""
      }`}
      aria-label={unitHref ? `${label}: ${value}` : undefined}
      title={unitHref ? `${label}: ${value}` : undefined}
    >
      <div class="min-w-0 flex-1">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{label}</dt>
        <dd
          class={`mt-1 truncate text-sm font-medium ${unitHref ? "group-hover/card-unit-row:text-primary group-focus-visible/card-unit-row:text-primary" : ""}`}
        >
          {value}
        </dd>
      </div>
      {#if unitSlug}
        <UnitIconBadge unit={unitSlug} variant="lg" />
      {:else if iconUrl}
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
    </svelte:element>
  {/if}
{/snippet}

{#snippet characterRow(character: CardDetailCharacter)}
  {@const value = getCharacterDisplayName(character)}
  {@const characterId = character.id}
  {@const characterHref =
    typeof characterId === "number" && Number.isInteger(characterId) && characterId > 0
      ? resolve("/character/[region]/[id]", { region, id: String(characterId) })
      : null}
  <svelte:element
    this={characterHref ? "a" : "div"}
    href={characterHref ?? undefined}
    class={`content-card-inset flex items-center justify-between gap-4 rounded-xl p-3 sm:px-4 ${
      characterHref
        ? "group/card-character-row outline-none transition-[border-color,background-color,transform] duration-180 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        : ""
    }`}
    aria-label={characterHref ? value : undefined}
    title={characterHref ? value : undefined}
  >
    <div class="min-w-0">
      <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{characterLabel}</dt>
      <dd
        class={`mt-1 truncate text-sm font-medium ${
          characterHref
            ? "group-hover/card-character-row:text-primary group-focus-visible/card-character-row:text-primary"
            : ""
        }`}
      >
        {value}
      </dd>
    </div>
    <CharacterAvatar
      src={getCharacterThumbnailUrl()}
      label={value}
      characterId={characterId}
      variant="lg"
      decorative
    />
  </svelte:element>
{/snippet}

{#snippet gachaPhraseRow()}
  {#if shouldShowGachaPhrase}
    <div class="content-card-inset flex items-center justify-between gap-4 rounded-xl p-3 sm:px-4">
      <div class="min-w-0">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
          {gachaPhraseLabel}
        </dt>
        <dd class="mt-1 truncate text-sm font-medium">{normalizedGachaPhrase}</dd>
      </div>

      <div class="flex shrink-0 items-center gap-3">
        {#if gachaPhraseAudioUrl}
          <VoicePlayButton
            src={gachaPhraseAudioUrl}
            playLabel={audioPlayLabel}
            errorLabel={audioUnavailableLabel}
          />
        {/if}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet rarityRow()}
  {@const rarityIconUrls = getRarityIconUrls()}
  {#if card.rarityType}
    <div class="content-card-inset flex items-center justify-between gap-4 rounded-xl p-3 sm:px-4">
      <div class="min-w-0">
        <dt class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">{rarityLabel}</dt>
        <dd class="mt-1 truncate text-sm font-medium">{formatLabel(card.rarityType)}</dd>
      </div>
      {#if rarityIconUrls.length > 0}
        <div class="flex shrink-0 items-center gap-0.5" aria-hidden="true">
          {#each rarityIconUrls as rarityIconUrl, index (`rarity-icon-${index}`)}
            <img
              src={rarityIconUrl}
              alt=""
              class="size-5 object-contain"
              loading="lazy"
              decoding="async"
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
{/snippet}

<article class="card content-card-shell shadow-sm">
  <div class="card-body gap-4 p-3 sm:p-5">
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
        {@render characterRow(card.character)}
      {/if}
      {@render row(
        unitLabel,
        getDisplayUnitName(card.character?.unit),
        undefined,
        true,
        card.character?.unit ?? null
      )}
      {#if shouldShowSupportUnit()}
        {@render row(
          supportUnitLabel,
          getDisplayUnitName(card.supportUnit),
          undefined,
          true,
          card.supportUnit ?? null
        )}
      {/if}
      {@render gachaPhraseRow()}
      {@render row(attrLabel, formatLabel(card.attr), getAttrIconUrl(), false)}
      {@render rarityRow()}
      {@render row(typeLabel, formatLabel(card.cardSupplyType))}
      {@render row(
        releaseAtLabel,
        formatDisplayDateTime(card.releaseAt ?? card.archivePublishedAt, displayLocale)
      )}
      {@render row(internalResourceCodeLabel, card.assetBundleName)}
    </dl>
  </div>
</article>
