<script lang="ts">
  import {
    RegionSwitcher,
    ViewerShell,
    type SidebarItem
  } from "@platform/ui-shell";
  import {
    regionLabels,
    supportedRegions,
    type SupportedRegion
  } from "@platform/i18n-dicts";

  let activeRegion = $state<SupportedRegion>(supportedRegions[0]);

  const regionOptions = supportedRegions.map((region) => ({
    value: region,
    label: regionLabels[region]
  }));

  const sidebarItems: SidebarItem[] = [
    { label: "首页", href: "/", active: true },
    ...supportedRegions.map((region) => ({
      label: `${regionLabels[region]} 实验区`,
      href: `#region-${region}`
    }))
  ];
</script>

<ViewerShell drawerId="media-lab-site-drawer" navTitle="Sekai Media Lab" navBadge="Lab" sidebarItems={sidebarItems}>
  <RegionSwitcher
    options={regionOptions}
    activeValue={activeRegion}
    onSelect={(region) => {
      activeRegion = region as SupportedRegion;
    }}
  />

  <section class="flex flex-col gap-4 md:flex-row md:flex-wrap md:justify-center">
    {#each supportedRegions as region (region)}
      <article id={`region-${region}`} class="card w-full bg-base-100 shadow-sm md:w-[calc(50%-0.5rem)] lg:w-[calc((100%-2rem)/3)]">
        <div class="card-body">
          <div class="flex items-center justify-between">
            <h2 class="card-title">{regionLabels[region]}</h2>
            <span class={`badge ${activeRegion === region ? "badge-primary" : "badge-ghost"}`}>{region}</span>
          </div>
          <p class="text-sm opacity-70">Media Lab 预留：{regionLabels[region]} 区域实验内容入口</p>
        </div>
      </article>
    {/each}
  </section>
</ViewerShell>
