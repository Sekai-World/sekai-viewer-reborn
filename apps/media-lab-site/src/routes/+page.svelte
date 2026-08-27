<script lang="ts">
  import { RegionSwitcher, ViewerShell, type SidebarItem } from "@platform/ui-shell";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  const supportedRegions = ["jp", "en", "tw", "kr", "cn"] as const;
  type SupportedRegion = (typeof supportedRegions)[number];
  const regionLabels: Record<SupportedRegion, string> = {
    jp: "JP",
    en: "EN",
    tw: "TW",
    kr: "KR",
    cn: "CN"
  };

  let primaryRegion = $state<SupportedRegion>(supportedRegions[0]);
  let secondaryRegion = $state<SupportedRegion>(supportedRegions[1] ?? supportedRegions[0]);

  const regionOptions = supportedRegions.map((region) => ({
    value: region,
    label: regionLabels[region]
  }));

  const sidebarItems: SidebarItem[] = [
    { label: "Home", href: "/", active: true },
    ...supportedRegions.map((region) => ({
      label: `${regionLabels[region]} media lab`,
      href: `#region-${region}`
    }))
  ];
</script>

<ViewerShell
  drawerId="media-lab-site-drawer"
  navTitle="Sekai Media Lab"
  navBadge="Lab"
  siteVersion={data.siteVersion}
  {sidebarItems}
>
  <RegionSwitcher
    options={regionOptions}
    primaryValue={primaryRegion}
    secondaryValue={secondaryRegion}
    primaryTitle="Primary"
    secondaryTitle="Secondary"
    onSelectPrimary={(region: string) => {
      primaryRegion = region as SupportedRegion;
    }}
    onSelectSecondary={(region: string) => {
      secondaryRegion = region as SupportedRegion;
    }}
  />

  <section class="flex flex-col gap-4 md:flex-row md:flex-wrap md:justify-center">
    {#each supportedRegions as region (region)}
      <article
        id={`region-${region}`}
        class="card w-full bg-base-100 shadow-sm md:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]"
      >
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">{regionLabels[region]}</h2>
            <div class="flex gap-1">
              <span class={`badge ${primaryRegion === region ? "badge-primary" : "badge-ghost"}`}>
                P
              </span>
              <span
                class={`badge ${secondaryRegion === region ? "badge-secondary" : "badge-ghost"}`}
              >
                S
              </span>
            </div>
          </div>
          <p class="text-sm opacity-70">{regionLabels[region]} media tools will appear here.</p>
        </div>
      </article>
    {/each}
  </section>
</ViewerShell>
