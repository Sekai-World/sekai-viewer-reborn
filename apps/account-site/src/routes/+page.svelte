<script lang="ts">
  import { env } from "$env/dynamic/public";
  import { RegionSwitcher, ViewerShell, type SidebarItem } from "@platform/ui-shell";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
  const supportPageUrl = env.PUBLIC_SUPPORT_PAGE_URL?.trim();

  const supportedRegions = ["jp", "en", "tw", "kr", "cn"] as const;
  type SupportedRegion = (typeof supportedRegions)[number];
  const regionLabels: Record<SupportedRegion, string> = {
    jp: "JP",
    en: "EN",
    tw: "TW",
    kr: "KR",
    cn: "CN"
  };

  const primaryTitle = "Primary";
  const secondaryTitle = "Secondary";

  let primaryRegion = $state<SupportedRegion>(supportedRegions[0]);
  let secondaryRegion = $state<SupportedRegion>(supportedRegions[1] ?? supportedRegions[0]);

  const regionOptions = supportedRegions.map((region) => ({
    value: region,
    label: regionLabels[region]
  }));

  const sidebarItems: SidebarItem[] = [
    { label: "Home", href: "/", active: true },
    ...(supportPageUrl ? [{ label: "Support", href: supportPageUrl }] : []),
    ...supportedRegions.map((region) => ({
      label: `${regionLabels[region]} accounts`,
      href: `#region-${region}`
    }))
  ];
</script>

<svelte:head>
  <title>Sekai Account</title>
</svelte:head>

<ViewerShell
  drawerId="account-site-drawer"
  navTitle="Sekai Account"
  navBadge="Profile"
  siteVersion={data.siteVersion}
  {sidebarItems}
>
  <RegionSwitcher
    options={regionOptions}
    primaryValue={primaryRegion}
    secondaryValue={secondaryRegion}
    {primaryTitle}
    {secondaryTitle}
    onSelectPrimary={(region: string) => {
      primaryRegion = region as SupportedRegion;
    }}
    onSelectSecondary={(region: string) => {
      secondaryRegion = region as SupportedRegion;
    }}
  />
  {#if supportPageUrl}
    <div class="flex justify-end">
      <a class="btn btn-ghost btn-sm min-h-11" href={supportPageUrl}>Support this project</a>
    </div>
  {/if}

  <section class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {#each supportedRegions as region (region)}
      <article
        id={`region-${region}`}
        class="card w-full border border-(--archive-border-subtle) bg-(--archive-surface-default)"
      >
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">{regionLabels[region]}</h2>
            <div class="flex gap-1">
              <span
                class={`badge ${primaryRegion === region ? "badge-primary" : "badge-ghost"}`}
                title={primaryTitle}
              >
                <span class="sr-only">{primaryTitle}</span><span aria-hidden="true">P</span>
              </span>
              <span
                class={`badge ${secondaryRegion === region ? "badge-secondary" : "badge-ghost"}`}
                title={secondaryTitle}
              >
                <span class="sr-only">{secondaryTitle}</span><span aria-hidden="true">S</span>
              </span>
            </div>
          </div>
          <p class="text-sm opacity-70">{regionLabels[region]} account tools will appear here.</p>
        </div>
      </article>
    {/each}
  </section>
</ViewerShell>
