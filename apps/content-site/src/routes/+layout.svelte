<script lang="ts">
  import "../app.css";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import {
    getContentSiteCommonText,
    regionLabels,
    supportedRegions,
    supportedUiLocales,
    uiLocaleNameByCode,
    type SupportedRegion,
    type SupportedUiLocale
  } from "@platform/i18n-dicts";
  import { RegionSwitcher, ViewerShell, type RegionOption, type SidebarItem } from "@platform/ui-shell";
  import { onMount, type Snippet } from "svelte";
  import {
    getRegionRoleLabels,
    isLocaleLoading,
    getThemeModeLabel,
    setI18nLocale,
    tCommon
  } from "$lib/i18n";
  import {
    DEFAULT_PRIMARY_REGION,
    DEFAULT_SECONDARY_REGION,
    DEFAULT_UI_LOCALE,
    normalizeRegion,
    normalizeUiLocale,
    PRIMARY_REGION_COOKIE_NAME,
    SECONDARY_REGION_COOKIE_NAME,
    UI_LOCALE_COOKIE_NAME
  } from "$lib/region";
  import type { LayoutData } from "./$types";

  type ThemeMode = "light" | "dark";
  type UiLocaleOption = {
    code: SupportedUiLocale;
  };

  const THEME_STORAGE_KEY = "content_site_theme_mode";
  const regionOptions: RegionOption[] = supportedRegions.map((region) => ({
    value: region,
    label: regionLabels[region]
  }));
  const uiLocaleOptions: UiLocaleOption[] = supportedUiLocales.map((code) => ({ code }));

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let primaryRegion = $state<SupportedRegion>(DEFAULT_PRIMARY_REGION);
  let secondaryRegion = $state<SupportedRegion>(DEFAULT_SECONDARY_REGION);
  let uiLocale = $state<SupportedUiLocale>(DEFAULT_UI_LOCALE);
  let themeMode = $state<ThemeMode>("light");
  let isRegionMenuOpen = $state(false);
  let isLocaleMenuOpen = $state(false);

  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let settingsLabel = $state(getContentSiteCommonText(initialLocale, "settings.title"));
  let themeControlLabel = $state(getContentSiteCommonText(initialLocale, "darkmode"));
  let primaryRegionLabel = $state(getContentSiteCommonText(initialLocale, "labels.primary"));
  let secondaryRegionLabel = $state(getContentSiteCommonText(initialLocale, "labels.secondary"));
  let gameContentRegionLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.gameContentRegion")
  );
  let interfaceLanguageLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.interfaceLanguage")
  );
  let loadingLanguagePackLabel = $state(
    getContentSiteCommonText(initialLocale, "loadingLanguagePack")
  );
  let switchThemeAriaLabel = $state(getContentSiteCommonText(initialLocale, "aria.switchTheme"));
  let switchUiLanguageCurrentLabel = $state(
    getContentSiteCommonText(initialLocale, "aria.switchUiLanguageCurrent")
  );

  const sidebarItems = $derived<SidebarItem[]>([
    { label: homeLabel, href: "/", active: true }
  ]);
  const showPageTitle = $derived(page.url.pathname === "/");
  const themeModeLabel = $derived(getThemeModeLabel(uiLocale, themeMode));
  const uiLocaleDisplayLabel = $derived(`${uiLocaleNameByCode[uiLocale]}(${uiLocale})`);

  $effect(() => {
    primaryRegion = normalizeRegion(data.primaryRegion, DEFAULT_PRIMARY_REGION);
    secondaryRegion = normalizeRegion(data.secondaryRegion, DEFAULT_SECONDARY_REGION);
    uiLocale = normalizeUiLocale(data.uiLocale, DEFAULT_UI_LOCALE);
  });

  $effect(() => {
    void refreshTranslations(uiLocale);
  });

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const resolvedLocale = await setI18nLocale(localeValue);
    const regionRoleLabels = getRegionRoleLabels(resolvedLocale);

    homeLabel = tCommon(resolvedLocale, "home");
    settingsLabel = tCommon(resolvedLocale, "settings.title");
    themeControlLabel = tCommon(resolvedLocale, "darkmode");
    gameContentRegionLabel = tCommon(resolvedLocale, "settings.gameContentRegion");
    interfaceLanguageLabel = tCommon(resolvedLocale, "settings.interfaceLanguage");
    loadingLanguagePackLabel = tCommon(resolvedLocale, "loadingLanguagePack");
    switchThemeAriaLabel = tCommon(resolvedLocale, "aria.switchTheme");
    switchUiLanguageCurrentLabel = tCommon(resolvedLocale, "aria.switchUiLanguageCurrent");
    primaryRegionLabel = regionRoleLabels.primary;
    secondaryRegionLabel = regionRoleLabels.secondary;
  };

  const applyTheme = (nextTheme: ThemeMode): void => {
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    themeMode = nextTheme;
  };

  const resolvePreferredTheme = (): ThemeMode => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark") {
      return storedTheme;
    }

    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  };

  const toggleTheme = (): void => {
    applyTheme(themeMode === "light" ? "dark" : "light");
  };

  const setRegionMenuOpen = (nextOpen: boolean): void => {
    isRegionMenuOpen = nextOpen;
    if (nextOpen) {
      isLocaleMenuOpen = false;
    }
  };

  const handleLocaleMenuToggle = (event: Event): void => {
    const detailsElement = event.currentTarget as HTMLDetailsElement;
    isLocaleMenuOpen = detailsElement.open;
    if (detailsElement.open) {
      isRegionMenuOpen = false;
    }
  };

  const setPrimaryRegion = async (regionValue: string): Promise<void> => {
    const nextRegion = normalizeRegion(regionValue, DEFAULT_PRIMARY_REGION);
    if (nextRegion === primaryRegion) {
      return;
    }

    primaryRegion = nextRegion;
    document.cookie = `${PRIMARY_REGION_COOKIE_NAME}=${nextRegion}; Path=/; Max-Age=31536000; SameSite=Lax`;
    await invalidateAll();
  };

  const setSecondaryRegion = async (regionValue: string): Promise<void> => {
    const nextRegion = normalizeRegion(regionValue, DEFAULT_SECONDARY_REGION);
    if (nextRegion === secondaryRegion) {
      return;
    }

    secondaryRegion = nextRegion;
    document.cookie = `${SECONDARY_REGION_COOKIE_NAME}=${nextRegion}; Path=/; Max-Age=31536000; SameSite=Lax`;
    await invalidateAll();
  };

  const setUiLocale = async (localeValue: string): Promise<void> => {
    const nextLocale = normalizeUiLocale(localeValue, DEFAULT_UI_LOCALE);
    if (nextLocale === uiLocale) {
      return;
    }

    uiLocale = nextLocale;
    document.cookie = `${UI_LOCALE_COOKIE_NAME}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    await invalidateAll();
  };

  onMount(() => {
    applyTheme(resolvePreferredTheme());
    primaryRegion = normalizeRegion(data.primaryRegion, DEFAULT_PRIMARY_REGION);
    secondaryRegion = normalizeRegion(data.secondaryRegion, DEFAULT_SECONDARY_REGION);
    uiLocale = normalizeUiLocale(data.uiLocale, DEFAULT_UI_LOCALE);
  });
</script>

<svelte:head>
  <title>Sekai Viewer</title>
</svelte:head>

{#if $isLocaleLoading}
  <div class="pointer-events-none fixed inset-x-0 top-2 z-[240] flex justify-center px-4">
    <div class="inline-flex items-center gap-2 rounded-full border border-base-content/20 bg-base-100/86 px-3 py-1 text-xs font-semibold shadow-lg backdrop-blur-md">
      <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
      <span>{interfaceLanguageLabel}: {uiLocaleDisplayLabel}</span>
    </div>
  </div>
{/if}

<ViewerShell
  drawerId="content-site-drawer"
  navTitle="Sekai Viewer"
  sidebarItems={sidebarItems}
  showTitle={showPageTitle}
>
  {#snippet navActions()}
    <div class="sm:hidden">
      <details class="dropdown dropdown-end">
        <summary
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100"
          aria-label={settingsLabel}
          title={settingsLabel}
        >
          <Icon icon="mdi:tune-variant" class="h-4 w-4" />
        </summary>
        <div class="dropdown-content z-[130] mt-3 w-[16.5rem] rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl backdrop-blur-sm">
          <p class="mb-1 px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
            {settingsLabel}
          </p>

          <button
            type="button"
            class="btn btn-sm justify-start rounded-lg border-base-content/15 bg-base-100"
            onclick={toggleTheme}
          >
            {#if themeMode === "light"}
              <Icon icon="mdi:white-balance-sunny" class="h-4 w-4" />
            {:else}
              <Icon icon="mdi:weather-night" class="h-4 w-4" />
            {/if}
            <span class="font-semibold">{themeControlLabel}: {themeModeLabel}</span>
          </button>

          <div class="my-2 h-px bg-base-content/12"></div>

          <section class="space-y-1.5">
            <p class="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
              {gameContentRegionLabel}
            </p>

            <label class="flex flex-col gap-1">
              <span class="px-1 text-xs font-medium opacity-80">{primaryRegionLabel}</span>
              <select
                class="select select-sm w-full rounded-lg border-base-content/15 bg-base-100"
                value={primaryRegion}
                onchange={async (event) => {
                  const nextValue = (event.currentTarget as HTMLSelectElement).value;
                  await setPrimaryRegion(nextValue);
                }}
              >
                {#each regionOptions as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>

            <label class="flex flex-col gap-1">
              <span class="px-1 text-xs font-medium opacity-80">{secondaryRegionLabel}</span>
              <select
                class="select select-sm w-full rounded-lg border-base-content/15 bg-base-100"
                value={secondaryRegion}
                onchange={async (event) => {
                  const nextValue = (event.currentTarget as HTMLSelectElement).value;
                  await setSecondaryRegion(nextValue);
                }}
              >
                {#each regionOptions as option (option.value)}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </label>
          </section>

          <div class="my-2 h-px bg-base-content/12"></div>

          <label class="flex flex-col gap-1">
            <span class="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
              {interfaceLanguageLabel}
            </span>
            <select
              class="select select-sm w-full rounded-lg border-base-content/15 bg-base-100"
              disabled={$isLocaleLoading}
              aria-busy={$isLocaleLoading}
              value={uiLocale}
              onchange={async (event) => {
                const nextValue = (event.currentTarget as HTMLSelectElement).value;
                await setUiLocale(nextValue);
              }}
            >
              {#each uiLocaleOptions as localeOption (localeOption.code)}
                <option value={localeOption.code}>
                  {uiLocaleNameByCode[localeOption.code]}({localeOption.code})
                </option>
              {/each}
            </select>
            {#if $isLocaleLoading}
              <span class="px-1 text-xs opacity-70">{loadingLanguagePackLabel}</span>
            {/if}
          </label>
        </div>
      </details>
    </div>

    <div class="hidden items-center gap-2 sm:flex">
      <button
        type="button"
        class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100"
        aria-label={switchThemeAriaLabel}
        title={themeModeLabel}
        onclick={toggleTheme}
      >
        {#if themeMode === "light"}
          <Icon icon="mdi:white-balance-sunny" class="h-4 w-4" />
        {:else}
          <Icon icon="mdi:weather-night" class="h-4 w-4" />
        {/if}
      </button>

      <RegionSwitcher
        options={regionOptions}
        primaryValue={primaryRegion}
        secondaryValue={secondaryRegion}
        primaryTitle={primaryRegionLabel}
        secondaryTitle={secondaryRegionLabel}
        isOpen={isRegionMenuOpen}
        onOpenChange={setRegionMenuOpen}
        onSelectPrimary={setPrimaryRegion}
        onSelectSecondary={setSecondaryRegion}
      />

      <details class="dropdown dropdown-end" bind:open={isLocaleMenuOpen} ontoggle={handleLocaleMenuToggle}>
        <summary
          class={`btn btn-sm btn-outline rounded-full border-base-content/20 bg-base-100/65 px-2 text-xs sm:px-3 sm:text-sm hover:bg-base-100 ${$isLocaleLoading ? "pointer-events-none opacity-75" : ""}`}
          aria-label={`${switchUiLanguageCurrentLabel}: ${uiLocale}`}
          title={`${interfaceLanguageLabel}: ${uiLocaleDisplayLabel}`}
          aria-busy={$isLocaleLoading}
          onclick={(event) => {
            if ($isLocaleLoading) {
              event.preventDefault();
            }
          }}
        >
          <Icon icon="mdi:translate" class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span class="max-w-[8.5rem] truncate font-semibold sm:max-w-none">{uiLocaleDisplayLabel}</span>
          {#if $isLocaleLoading}
            <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
          {/if}
        </summary>
        <ul class="menu dropdown-content z-[120] mt-3 w-56 rounded-box border border-base-content/15 bg-base-100/96 p-1 shadow-xl backdrop-blur-sm">
          {#each uiLocaleOptions as localeOption (localeOption.code)}
            <li>
              <button
                type="button"
                class={localeOption.code === uiLocale ? "menu-active font-semibold" : ""}
                disabled={$isLocaleLoading}
                onclick={async () => {
                  await setUiLocale(localeOption.code);
                  isLocaleMenuOpen = false;
                }}
              >
                <span>{uiLocaleNameByCode[localeOption.code]}({localeOption.code})</span>
                {#if localeOption.code === uiLocale}
                  <Icon icon="mdi:check" class="h-4 w-4 opacity-80" />
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </details>
    </div>
  {/snippet}

  {@render children()}
</ViewerShell>
