<script lang="ts">
  import { resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import HonorCatalogue from "$lib/components/honor/HonorCatalogue.svelte";
  import type { HonorGroup } from "$lib/domain/honor";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { getRemoteAssetEndpointURL } from "$lib/assets/index";
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
  const navigatePage = (page: number) =>
    void goto(`${resolve("/honors/[region]", { region: data.region })}?page=${page}`);
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
  const honorImage = (bundle: string | null, type: string | null) =>
    bundle
      ? getRemoteAssetEndpointURL(
          `${type === "rank_match" ? "rank_live/honor" : "honor"}/${bundle}/degree_main.webp`,
          data.region
        )
      : null;
  const toItem = (item: HonorGroup) => {
    const bundle = item.backgroundAssetBundleName ?? item.honors[0]?.assetBundleName ?? null;
    const type = item.honorType;
    return {
      key: String(item.id),
      name: item.name ?? item.honors[0]?.name ?? t("honor.unnamed"),
      imageSrc: honorImage(bundle, type),
      countLabel: t("honor.memberCount").replace("{count}", formatNumber(item.honors.length)),
      members: item.honors.map((honor) => ({
        key: String(honor.id),
        name: honor.name ?? t("honor.unnamed"),
        variantLabel: rarityLabel(honor.honorRarity),
        // Event/rank/mission bundles can be overlays, not standalone degree artwork.
        imageSrc:
          honor.assetBundleName !== bundle &&
          !["event", "event_point", "rank_match"].includes(type ?? honor.honorType ?? "") &&
          !honor.honorMissionType
            ? honorImage(honor.assetBundleName, type ?? honor.honorType)
            : null,
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
    {labels}
    homeHref={resolve("/")}
    {regions}
    items={[]}
    catalogueKey={`${data.region}:${data.query.page}`}
    status="loading"
    imageUnavailableLabel={t("imageUnavailable")}
    levelsLabel={t("honor.levels")}
  />
{:then catalogue}
  {@const pagination = catalogue.pagination}
  <HonorCatalogue
    {labels}
    homeHref={resolve("/")}
    {regions}
    items={catalogue.items.map(toItem)}
    catalogueKey={`${data.region}:${data.query.page}`}
    status={catalogue.loadFailed ? "error" : "ready"}
    imageUnavailableLabel={t("imageUnavailable")}
    levelsLabel={t("honor.levels")}
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
    {labels}
    homeHref={resolve("/")}
    {regions}
    items={[]}
    catalogueKey={`${data.region}:${data.query.page}`}
    status="error"
    imageUnavailableLabel={t("imageUnavailable")}
    levelsLabel={t("honor.levels")}
    onRetry={() => void invalidateAll()}
  />
{/await}
