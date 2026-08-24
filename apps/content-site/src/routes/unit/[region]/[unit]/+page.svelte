<script lang="ts">
  import { browser } from "$app/environment";
  import { resolve } from "$app/paths";
  import Icon from "@iconify/svelte";
  import { swipeRegion } from "$lib/actions/swipe-region";
  import { getLocalCharacterThumbnailAssetURL } from "$lib/assets/characters";
  import CharacterAvatar from "$lib/components/shared/CharacterAvatar.svelte";
  import PageHeader from "$lib/components/shared/PageHeader.svelte";
  import RegionBadgeSwitch, {
    type RegionBadgeOption
  } from "$lib/components/shared/RegionBadgeSwitch.svelte";
  import { UnitIconBadge } from "@platform/ui-shell";
  import { resolveUnitLogoUrl } from "$lib/domain/unit-icon";
  import { regionLabels } from "$lib/domain/regions";
  import { formatUnitMemberName } from "$lib/domain/unit-detail";
  import type { UnitMember } from "$lib/server/unit-detail";
  import { createI18nTranslator, resolveStreamingMessages } from "$lib/i18n/runtime";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const initialMessages = (): Record<string, string> =>
    resolveStreamingMessages(data.i18nMessages, ["common", "unit", "error"]);
  let messages = $state<Record<string, string>>(initialMessages());
  let requestId = 0;
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const t = (key: string, fallback: string): string => translate(key, fallback);
  const currentRegionOption = (): RegionBadgeOption[] => [
    { key: data.region, label: regionLabels[data.region], active: true }
  ];
  const breadcrumbs = (label: string) => [
    { label: t("home", "Home"), href: resolve("/") },
    {
      label: t("navigation.characters", "Characters & Units"),
      href: resolve("/characters/[region]", { region: data.region })
    },
    { label }
  ];
  const memberHref = (member: UnitMember): string =>
    resolve("/character/[region]/[id]", { region: data.region, id: String(member.gameCharacterId) });

  $effect(() => {
    const id = ++requestId;
    if (browser)
      void Promise.resolve(data.i18nMessages)
        .then((next) => {
          if (id === requestId) messages = next;
        })
        .catch(() => {});
  });
</script>

<svelte:head>
  {#await data.payload}
    <title>{t("unitPageTitlePrefix", "Unit")} - Sekai Viewer</title>
  {:then result}
    <title>{result.unit?.unitName ?? t("unitPageTitlePrefix", "Unit")} - Sekai Viewer</title>
  {/await}
</svelte:head>

<section use:swipeRegion class="content-page-shell gap-4 px-2">
  {#await data.payload}
    <PageHeader breadcrumbs={breadcrumbs(t("unitPageTitlePrefix", "Unit"))}>
      {#snippet actions()}<RegionBadgeSwitch options={currentRegionOption()} />{/snippet}
    </PageHeader>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)]" aria-busy="true">
      <div class="card content-card-shell animate-pulse"><div class="card-body min-h-64"></div></div>
      <div class="card content-card-shell animate-pulse"><div class="card-body min-h-64"></div></div>
    </div>
  {:then result}
    <PageHeader breadcrumbs={breadcrumbs(result.unit?.unitName ?? t("unitPageTitlePrefix", "Unit"))}>
      {#snippet actions()}<RegionBadgeSwitch options={currentRegionOption()} />{/snippet}
    </PageHeader>

    {#if result.loadFailed}
      <div class="alert alert-error" role="alert">{t("unitLoadFailed", "Unit data could not be loaded.")}</div>
    {:else if !result.unit}
      <div class="alert alert-error" role="alert">{t("unitUnavailable", "This unit is not available in the selected region.")}</div>
    {:else}
      {@const unit = result.unit}
      {@const logoUrl = resolveUnitLogoUrl(unit.unit)}
      <div class="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,min(33%,400px))_minmax(0,1fr)] md:items-start">
        <aside class="flex flex-col gap-4">
          <article class="card content-card-shell overflow-hidden" style:--unit-accent={unit.colorCode ?? "var(--color-primary)"}>
            <div class="card-body relative items-center gap-4 overflow-hidden p-5 text-center sm:p-8">
              <div class="absolute inset-x-0 top-0 h-1 bg-(--unit-accent)" aria-hidden="true"></div>
              {#if logoUrl}
                <img src={logoUrl} alt={unit.unitName} class="h-28 max-w-full object-contain sm:h-32" loading="eager" decoding="async" />
              {:else}
                <UnitIconBadge unit={unit.unit} fallbackLabel={unit.unitName.slice(0, 2)} variant="lg" />
              {/if}
              <h1 class="wrap-break-word text-3xl/tight font-bold sm:text-4xl">{unit.unitName}</h1>
            </div>
          </article>
          {#if unit.profileSentence}
            <article class="card content-card-shell">
              <div class="card-body gap-4 p-3 sm:p-5">
                <h2 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"><Icon icon="mdi:information-outline" class="size-4" aria-hidden="true" />{t("unitProfileTitle", "Profile")}</h2>
                <p class="whitespace-pre-line wrap-break-word text-sm/6">{unit.profileSentence}</p>
              </div>
            </article>
          {/if}
        </aside>
        <article class="card content-card-shell">
          <div class="card-body gap-4 p-3 sm:p-5">
            <h2 class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] opacity-60"><Icon icon="mdi:account-group-outline" class="size-4" aria-hidden="true" />{t("unitRosterTitle", "Members")}</h2>
            {#if result.members.length > 0}
              {@const isPiaproUnit = unit.unit === "piapro"}
              {@const mainMembers = isPiaproUnit
                ? result.members
                : result.members.filter(
                    (member) => member.gameCharacterId < 21 || member.gameCharacterId > 26
                  )}
              {@const supportMembers = isPiaproUnit
                ? []
                : result.members.filter(
                    (member) => member.gameCharacterId >= 21 && member.gameCharacterId <= 26
                  )}
              <div class="grid grid-flow-col auto-cols-fr gap-2">
                {#each mainMembers as member (member.gameCharacterId)}
                  {@const name = formatUnitMemberName(member)}
                  <a
                    href={memberHref(member)}
                    class="group content-card-inset flex flex-col items-center gap-2 rounded-xl p-2 text-center outline-none transition-[background-color,border-color,transform] duration-180 ease-out hover:-translate-y-0.5 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:p-3"
                  >
                    <CharacterAvatar
                      src={getLocalCharacterThumbnailAssetURL(member.gameCharacterId)}
                      label={name}
                      characterId={member.gameCharacterId}
                      accentColor={member.colorCode}
                      decorative
                      variant="default"
                    />
                    <span class="wrap-break-word text-sm font-medium group-hover:text-primary"
                      >{name}</span
                    >
                  </a>
                {/each}
              </div>
              {#if supportMembers.length > 0}
                <div>
                  <h3 class="text-xs font-semibold uppercase tracking-[0.16em] opacity-60">
                    {t("unitSupportMembersTitle", "Support members")}
                  </h3>
                  <div class="mt-2 flex flex-wrap items-center gap-2">
                    {#each supportMembers as member (member.gameCharacterId)}
                      {@const name = formatUnitMemberName(member)}
                      <a
                        href={memberHref(member)}
                        class="group content-card-inset flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 outline-none transition-colors duration-150 hover:border-primary/35 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                      >
                        <CharacterAvatar
                          src={getLocalCharacterThumbnailAssetURL(member.gameCharacterId)}
                          label={name}
                          characterId={member.gameCharacterId}
                          accentColor={member.colorCode}
                          decorative
                          variant="xs"
                        />
                        <span class="text-sm font-medium group-hover:text-primary">{name}</span>
                      </a>
                    {/each}
                  </div>
                </div>
              {/if}
            {:else}
              <p class="content-card-inset rounded-xl p-6 text-center text-sm opacity-65">{t("unitMembersEmpty", "No members are available for this unit.")}</p>
            {/if}
          </div>
        </article>
      </div>
    {/if}
  {/await}
</section>
