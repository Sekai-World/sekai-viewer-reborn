<script lang="ts">
  import { resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import { SvelteURLSearchParams } from "svelte/reactivity";
  import HonorCatalogue from "$lib/components/honor/HonorCatalogue.svelte";
  import type { HonorGroup } from "$lib/domain/honor";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createHonorDegreeAssetResolver, toCatalogueHonorDegree } from "$lib/honor-degree";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import sourceMessages from "@platform/i18n-source/content-site/honor.json";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  let resolvedMessages = $state<Record<string, string> | null>(null);
  const messages = $derived({
    ...sourceMessages,
    ...resolveStreamingMessages(data.i18nMessages, ["common"]),
    ...resolvedMessages
  });
  const t = $derived(createI18nTranslator(data.uiLocale, messages));
  $effect(() => {
    const bundle = data.i18nMessages;
    let active = true;
    resolvedMessages = null;
    void Promise.resolve(bundle)
      .then((value) => {
        if (active) resolvedMessages = value;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  });
  const labels = $derived({
    title: t("navigation.honors"),
    home: t("home"),
    search: "",
    searchAction: "",
    loading: t("honor.loading"),
    empty: t("honor.empty"),
    error: t("honor.error"),
    retry: t("honor.retry"),
    previous: t("honor.previous"),
    next: t("honor.next")
  });
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: resolve("/honors/[region]", { region })
    }))
  );
  const honorTypeLabelKeys: Record<string, string> = {
    achievement: "honor.category.achievement",
    birthday: "honor.category.birthday",
    character: "honor.category.character",
    event: "honor.category.event",
    rank_match: "honor.category.rank_match"
  };
  const getHonorTypeLabel = (honorType: string | null): string =>
    t(
      honorType === null
        ? "honor.category.all"
        : (honorTypeLabelKeys[honorType] ?? "honor.category.unknown")
    );
  const navigateHonorList = (
    page: number,
    honorType: string | null = data.query.honorType
  ): void => {
    const searchParams = new SvelteURLSearchParams();
    searchParams.set("page", String(page));
    if (honorType) searchParams.set("honor_type", honorType);
    void goto(`${resolve("/honors/[region]", { region: data.region })}?${searchParams.toString()}`);
  };
  const navigatePage = (page: number): void => navigateHonorList(page);
  const navigateHonorType = (honorType: string | null): void => navigateHonorList(1, honorType);
  const formatNumber = (value: number) => new Intl.NumberFormat(data.uiLocale).format(value);
  const rarityLabel = (rarity: string | null): string | undefined => {
    switch (rarity) {
      case "low":
        return t("honor.rarity.low");
      case "middle":
        return t("honor.rarity.middle");
      case "high":
        return t("honor.rarity.high");
      case "highest":
        return t("honor.rarity.highest");
      default:
        return undefined;
    }
  };
  const resolveAsset = $derived(createHonorDegreeAssetResolver(data.region));
  const toItem = (item: HonorGroup) => {
    return {
      key: String(item.id),
      name: item.name ?? item.honors[0]?.name ?? t("honor.unnamed"),
      degree: item.honors[0] ? toCatalogueHonorDegree(item.honors[0], item) : undefined,
      countLabel: t("honor.memberCount").replace("{count}", formatNumber(item.honors.length)),
      members: item.honors.map((honor) => ({
        key: String(honor.id),
        name: honor.name ?? t("honor.unnamed"),
        variantLabel: rarityLabel(honor.honorRarity),
        degree: toCatalogueHonorDegree(honor, item),
        levels: honor.levels.map((level) => ({
          label:
            level.level === null
              ? t("honor.levels")
              : t("honor.level").replace("{level}", formatNumber(level.level)),
          description: level.description
        }))
      }))
    };
  };
</script>

<svelte:head
  ><title>{createPageTitle(`${t("navigation.honors")} ${regionLabels[data.region]}`)}</title
  ></svelte:head
>

{#await data.catalogue}
  <HonorCatalogue
    {resolveAsset}
    {labels}
    homeHref={resolve("/")}
    {regions}
    items={[]}
    catalogueKey={`${data.region}:${data.query.page}:${data.query.honorType ?? "all"}`}
    status="loading"
    imageUnavailableLabel={t("imageUnavailable")}
    levelsLabel={t("honor.levels")}
    closeLabel={t("closeLabel")}
  />
{:then catalogue}
  {@const pagination = catalogue.pagination}
  <HonorCatalogue
    {resolveAsset}
    {labels}
    homeHref={resolve("/")}
    {regions}
    items={catalogue.items.map(toItem)}
    catalogueKey={`${data.region}:${data.query.page}:${data.query.honorType ?? "all"}`}
    status={catalogue.loadFailed ? "error" : "ready"}
    imageUnavailableLabel={t("imageUnavailable")}
    levelsLabel={t("honor.levels")}
    closeLabel={t("closeLabel")}
    honorTypes={catalogue.availableHonorTypes}
    selectedHonorType={data.query.honorType}
    categoryLabel={t("honor.categoryLabel")}
    {getHonorTypeLabel}
    onHonorTypeChange={navigateHonorType}
    onRetry={() => void invalidateAll()}
    onPrevious={!catalogue.loadFailed && pagination.page > 1
      ? () => navigatePage(pagination.page - 1)
      : undefined}
    onNext={!catalogue.loadFailed && pagination.hasNext
      ? () => navigatePage(pagination.page + 1)
      : undefined}
    pageLabel={!catalogue.loadFailed && pagination.totalPages !== 0
      ? pagination.totalPages === null
        ? formatNumber(pagination.page)
        : t("honor.page")
            .replace("{page}", formatNumber(pagination.page))
            .replace("{total}", formatNumber(pagination.totalPages))
      : undefined}
  />
{:catch}
  <HonorCatalogue
    {resolveAsset}
    {labels}
    homeHref={resolve("/")}
    {regions}
    items={[]}
    catalogueKey={`${data.region}:${data.query.page}:${data.query.honorType ?? "all"}`}
    status="error"
    imageUnavailableLabel={t("imageUnavailable")}
    levelsLabel={t("honor.levels")}
    closeLabel={t("closeLabel")}
    onRetry={() => void invalidateAll()}
  />
{/await}
