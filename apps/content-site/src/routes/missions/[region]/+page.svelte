<script lang="ts">
  import { resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import MissionCatalogue from "$lib/components/mission/MissionCatalogue.svelte";
  import { groupMissionsByFamily } from "$lib/components/mission/catalogue-groups";
  import type { Mission } from "$lib/domain/mission";
  import { regionLabels, supportedRegions } from "$lib/domain/regions";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import { createPageTitle } from "$lib/page-title";
  import sourceMessages from "@platform/i18n-source/content-site/mission.json";
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
    title: t("navigation.missions"),
    home: t("home"),
    search: "",
    searchAction: "",
    loading: t("mission.loading"),
    empty: t("mission.empty"),
    error: t("mission.error"),
    retry: t("mission.retry"),
    previous: t("mission.previous"),
    next: t("mission.next")
  });
  const pageParams = (page: number) => {
    return [
      `page=${page}`,
      ...data.query.families.map((family) => `family=${encodeURIComponent(family)}`)
    ].join("&");
  };
  const navigatePage = (page: number) =>
    void goto(`${resolve("/missions/[region]", { region: data.region })}?${pageParams(page)}`);
  const catalogueKey = $derived(`${data.region}?${pageParams(data.query.page)}`);
  const regions = $derived(
    supportedRegions.map((region) => ({
      key: region,
      label: regionLabels[region],
      active: region === data.region,
      href: resolve("/missions/[region]", { region })
    }))
  );
  const formatNumber = (value: number) => new Intl.NumberFormat(data.uiLocale).format(value);
  const toItem = (item: Mission) => ({
    key: `${item.family}-${item.id}`,
    sentence: item.sentence ?? item.progressSentence ?? t("mission.unnamed"),
    requirementLabel:
      item.requirement === null
        ? null
        : t("mission.requirement").replace("{count}", formatNumber(item.requirement)),
    rewardLabels: item.rewards
      .flatMap((reward) =>
        reward.resourceBox?.details.length
          ? reward.resourceBox.details
          : reward.resourceType
            ? [reward]
            : []
      )
      .map((reward) => {
        const type = reward.resourceType;
        const label =
          type &&
          ["coin", "jewel", "material", "honor", "bonds_honor", "virtual_coin"].includes(type)
            ? t(`mission.resource.${type}`)
            : t("mission.reward");
        return reward.resourceQuantity === null
          ? label
          : `${label} ×${formatNumber(reward.resourceQuantity)}`;
      })
  });
</script>

<svelte:head
  ><title>{createPageTitle(`${t("navigation.missions")} ${regionLabels[data.region]}`)}</title
  ></svelte:head
>

{#await data.catalogue}
  <MissionCatalogue
    {labels}
    homeHref={resolve("/")}
    {regions}
    {catalogueKey}
    groups={[]}
    loadingGroupCount={data.query.families.length}
    status="loading"
    rewardsLabel={t("mission.rewards")}
  />
{:then catalogue}
  {@const pagination = catalogue.pagination}
  <MissionCatalogue
    {labels}
    homeHref={resolve("/")}
    {regions}
    {catalogueKey}
    groups={groupMissionsByFamily(catalogue.items).map((group) => ({
      family: group.family,
      label: t(`mission.family.${group.family}`),
      countLabel: t("mission.onThisPage").replace("{count}", formatNumber(group.items.length)),
      items: group.items.map(toItem)
    }))}
    status={catalogue.loadFailed ? "error" : "ready"}
    rewardsLabel={t("mission.rewards")}
    onRetry={() => void invalidateAll()}
    onPrevious={!catalogue.loadFailed && pagination.page > 1
      ? () => navigatePage(pagination.page - 1)
      : undefined}
    onNext={!catalogue.loadFailed && pagination.hasNext
      ? () => navigatePage(pagination.page + 1)
      : undefined}
    pageLabel={!catalogue.loadFailed
      ? pagination.totalPages === null
        ? formatNumber(pagination.page)
        : t("mission.page")
            .replace("{page}", formatNumber(pagination.page))
            .replace("{total}", formatNumber(pagination.totalPages))
      : undefined}
  />
{:catch}
  <MissionCatalogue
    {labels}
    homeHref={resolve("/")}
    {regions}
    {catalogueKey}
    groups={[]}
    status="error"
    rewardsLabel={t("mission.rewards")}
    onRetry={() => void invalidateAll()}
  />
{/await}
