<script lang="ts">
  import { resolve } from "$app/paths";
  import { swipeRegion } from "#lib/actions/swipe-region.js";
  import { getCostumeThumbnailURL } from "#lib/assets/index.js";
  import { getLocalCharacterThumbnailAssetURL } from "#lib/assets/characters.js";
  import MysekaiDetailSection from "#lib/components/mysekai/MysekaiDetailSection.svelte";
  import MysekaiDetailStatus from "#lib/components/mysekai/MysekaiDetailStatus.svelte";
  import MysekaiInfoRow from "#lib/components/mysekai/MysekaiInfoRow.svelte";
  import AssetImage from "#lib/components/shared/AssetImage.svelte";
  import CharacterAvatar from "#lib/components/shared/CharacterAvatar.svelte";
  import PageHeader from "#lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch from "#lib/components/shared/RegionBadgeSwitch.svelte";
  import {
    costumeRarities,
    getCostumeColors,
    getCostumeObtainMethods,
    type CostumeOutfitDetail
  } from "#lib/domain/costume.js";
  import type { MissionCharacterOption } from "#lib/domain/mission.js";
  import type { MysekaiDetailPayload } from "#lib/domain/mysekai.js";
  import { regionLabels, supportedRegions } from "#lib/domain/regions.js";
  import { createStreamedTranslator } from "#lib/i18n/streamed-translator.svelte.js";
  import { createPageTitle } from "#lib/page-title.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const i18n = createStreamedTranslator(() => data, ["common", "costume"]);
  const t = $derived(i18n.t);

  let payload = $state<MysekaiDetailPayload<CostumeOutfitDetail> | null>(null);
  $effect(() => {
    let active = true;
    payload = null;
    void data.payload.then((value) => {
      if (active) payload = value;
    });
    return () => {
      active = false;
    };
  });
  const outfit = $derived(payload?.status === "ready" ? payload.item : null);

  let characters = $state<MissionCharacterOption[]>([]);
  $effect(() => {
    let active = true;
    characters = [];
    void Promise.resolve(data.characters).then((items) => {
      if (active) characters = items ?? [];
    });
    return () => {
      active = false;
    };
  });

  const listTitle = $derived(t("navigation.costumes"));
  const name = $derived(outfit?.name ?? data.id);
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: resolve("/costume/[region]/[id]", { region, id: data.id })
    }))
  );
  const pageTitle = $derived(
    outfit?.name ? createPageTitle(outfit.name, listTitle) : createPageTitle(listTitle)
  );

  const colors = $derived(outfit ? getCostumeColors(outfit) : []);
  const obtainMethods = $derived(outfit ? getCostumeObtainMethods(outfit) : []);
  const coverSrc = $derived(
    getCostumeThumbnailURL(outfit?.thumbnailAssetbundleName, data.region) ?? ""
  );
  // A designer of "-" means the data names none.
  const designer = $derived(outfit?.designer && outfit.designer !== "-" ? outfit.designer : null);
  const rarity = $derived(costumeRarities.find((value) => value === outfit?.rarity));
  const publishedAt = $derived(
    outfit?.publishedAt
      ? new Intl.DateTimeFormat(data.uiLocale, { dateStyle: "medium" }).format(outfit.publishedAt)
      : null
  );
  const characterName = (id: number): string =>
    characters.find((character) => character.id === id)?.name ?? t("costume.characterTitle");
  const knownParts = new Set(["body", "head", "hair"]);
  const partLabel = (partType: string): string =>
    knownParts.has(partType) ? t(`costume.part.${partType}`) : partType;
</script>

<svelte:head><title>{pageTitle}</title></svelte:head>

<section use:swipeRegion class="content-page-shell gap-4 pb-6">
  <PageHeader
    breadcrumbs={[
      { label: t("home"), href: resolve("/") },
      { label: listTitle, href: resolve("/costumes/[region]", { region: data.region }) },
      { label: name }
    ]}
  >
    {#snippet actions()}<RegionBadgeSwitch options={regions} />{/snippet}
  </PageHeader>

  {#if !outfit}
    <MysekaiDetailStatus
      status={payload?.status ?? "loading"}
      loadingLabel={t("detailLoading")}
      notFoundLabel={t("costume.notFound")}
      errorLabel={t("costume.detailError")}
    />
  {:else}
    <div
      class="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)]"
    >
      <article class="card content-card-shell shadow-sm">
        <div class="card-body gap-4 p-3 sm:p-5">
          <div class="mx-auto aspect-square w-1/2 overflow-hidden rounded-xl">
            <AssetImage
              buttonClass="block size-full overflow-hidden"
              src={coverSrc}
              alt={name}
              fallbackLabel={t("imageUnavailable")}
              imageClass="size-full object-contain"
            />
          </div>
          <h1 class="text-2xl font-bold wrap-anywhere text-(--archive-text-strong)">{name}</h1>
        </div>
      </article>

      <div class="flex min-w-0 flex-col gap-4">
        <MysekaiDetailSection
          title={t("costume.info")}
          icon="mdi:information-outline"
          aside={`${t("idLabel")}${outfit.id}`}
        >
          <dl class="grid gap-2 sm:grid-cols-2">
            {#if designer}
              <MysekaiInfoRow label={t("costume.designer")}>{designer}</MysekaiInfoRow>
            {/if}
            {#if rarity}
              <MysekaiInfoRow label={t("costume.rarityTitle")}>
                {t(`costume.rarity.${rarity}`)}
              </MysekaiInfoRow>
            {/if}
            {#if publishedAt}
              <MysekaiInfoRow label={t("costume.publishedAt")}>{publishedAt}</MysekaiInfoRow>
            {/if}
            {#if obtainMethods.length > 0}
              <div class="sm:col-span-2">
                <MysekaiInfoRow label={t("costume.howToObtain")}>
                  <ul class="grid gap-1">
                    {#each obtainMethods as method (method)}
                      <li>{method}</li>
                    {/each}
                  </ul>
                </MysekaiInfoRow>
              </div>
            {/if}
          </dl>
        </MysekaiDetailSection>

        {#if (outfit.characterIds ?? []).length > 0}
          <MysekaiDetailSection
            title={t("costume.characters")}
            icon="mdi:account-group-outline"
            aside={String(outfit.characterIds?.length)}
          >
            <ul class="flex flex-wrap gap-2">
              {#each outfit.characterIds ?? [] as characterId (characterId)}
                <li title={characterName(characterId)}>
                  <CharacterAvatar
                    src={getLocalCharacterThumbnailAssetURL(characterId)}
                    label={characterName(characterId)}
                    {characterId}
                    variant="sm"
                  />
                </li>
              {/each}
            </ul>
          </MysekaiDetailSection>
        {/if}

        {#if colors.length > 0}
          <MysekaiDetailSection title={t("costume.colors")} icon="mdi:palette-outline">
            <div class="grid gap-4">
              {#each colors as color (color.id)}
                <div class="grid gap-2">
                  <h3 class="text-sm font-semibold text-(--archive-text-strong)">
                    {color.name ?? color.id}
                  </h3>
                  <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-6">
                    {#each color.parts as part (part.thumbnail)}
                      <li class="content-card-inset min-w-0 rounded-xl p-2">
                        <div class="aspect-square w-full overflow-hidden rounded-lg">
                          <AssetImage
                            buttonClass="block size-full overflow-hidden"
                            src={getCostumeThumbnailURL(part.thumbnail, data.region) ?? ""}
                            alt={partLabel(part.partType)}
                            fallbackLabel={t("imageUnavailable")}
                            loadMode="visible"
                            imageClass="size-full object-contain"
                          />
                        </div>
                        <p class="mt-1 text-center text-xs text-(--archive-text-muted)">
                          {partLabel(part.partType)}
                        </p>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}
            </div>
          </MysekaiDetailSection>
        {/if}
      </div>
    </div>
  {/if}
</section>
