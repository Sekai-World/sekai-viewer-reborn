<script lang="ts">
  import "../app.css";
  import { asset } from "$app/paths";
  import { invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import {
    getContentSiteCommonText,
    supportedUiLocales,
    uiLocaleNameByCode,
    type SupportedUiLocale
  } from "$lib/i18n-data";
  import { ViewerShell, type SidebarItem } from "@platform/ui-shell";
  import { onMount, type Snippet } from "svelte";
  import { isLocaleLoading, getThemeModeLabel, setI18nLocale, tCommon } from "$lib/i18n";
  import {
    DEFAULT_REGION,
    DEFAULT_UI_LOCALE,
    normalizeRegion,
    normalizeUiLocale,
    UI_LOCALE_COOKIE_NAME
  } from "$lib/region";
  import type { LayoutData } from "./$types";

  type ThemeMode = "light" | "dark" | "auto";
  type ThemeName = "default" | "sakura" | "mint";
  type ResolvedTheme = "light" | "dark";
  type UiLocaleOption = {
    code: SupportedUiLocale;
  };

  const THEME_STORAGE_KEY = "content_site_theme_mode";
  const THEME_NAME_STORAGE_KEY = "content_site_theme_name";
  const uiLocaleOptions: UiLocaleOption[] = supportedUiLocales.map((code) => ({ code }));
  const themeNameOptions: ThemeName[] = ["default", "sakura", "mint"];

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let uiLocale = $derived<SupportedUiLocale>(normalizeUiLocale(data.uiLocale, DEFAULT_UI_LOCALE));
  let themeName = $state<ThemeName>("default");
  let themeMode = $state<ThemeMode>("auto");
  let resolvedTheme = $state<ResolvedTheme>("light");
  let isLocaleMenuOpen = $state(false);
  let systemThemeMediaQuery: MediaQueryList | null = null;
  let mobileSettingsMenu: HTMLDetailsElement | null = null;
  let desktopThemeMenu: HTMLDetailsElement | null = null;
  let localeMenu: HTMLDetailsElement | null = null;

  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let sidebarLabel = $state(getContentSiteCommonText(initialLocale, "navigation.sidebarTitle"));
  let databaseLabel = $state(getContentSiteCommonText(initialLocale, "navigation.database"));
  let cardsLabel = $state(getContentSiteCommonText(initialLocale, "navigation.cards"));
  let songsLabel = $state(getContentSiteCommonText(initialLocale, "navigation.songs"));
  let eventsLabel = $state(getContentSiteCommonText(initialLocale, "navigation.events"));
  let virtualLivesLabel = $state(getContentSiteCommonText(initialLocale, "navigation.virtualLives"));
  let settingsLabel = $state(getContentSiteCommonText(initialLocale, "settings.title"));
  let themeControlLabel = $state(getContentSiteCommonText(initialLocale, "settings.appearance"));
  let themePaletteLabel = $state(getContentSiteCommonText(initialLocale, "settings.theme"));
  let interfaceLanguageLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.interfaceLanguage")
  );
  let currentLanguageLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.currentLanguage")
  );
  let backToTopLabel = $state(getContentSiteCommonText(initialLocale, "backToTopLabel"));
  let loadingLanguagePackLabel = $state(
    getContentSiteCommonText(initialLocale, "loadingLanguagePack")
  );
  let switchThemeAriaLabel = $state(getContentSiteCommonText(initialLocale, "aria.switchTheme"));
  let switchUiLanguageCurrentLabel = $state(
    getContentSiteCommonText(initialLocale, "aria.switchUiLanguageCurrent")
  );
  let themeNameLabels = $state<Record<ThemeName, string>>({
    default: getContentSiteCommonText(initialLocale, "themeName.default"),
    sakura: getContentSiteCommonText(initialLocale, "themeName.sakura"),
    mint: getContentSiteCommonText(initialLocale, "themeName.mint")
  });
  let showBackToTop = $state(false);
  let backToTopAnimationFrame = 0;

  const sidebarRegion = $derived.by<ReturnType<typeof normalizeRegion>>(() => {
    const [first, second] = page.url.pathname.split("/").filter(Boolean);

    if ((first === "event" || first === "events") && second) {
      return normalizeRegion(second, DEFAULT_REGION);
    }

    return DEFAULT_REGION;
  });

  const sidebarItems = $derived<SidebarItem[]>([
    {
      label: homeLabel,
      href: "/",
      active: page.url.pathname === "/",
      icon: "mdi:home-variant-outline"
    },
    {
      type: "section",
      label: databaseLabel
    },
    {
      label: cardsLabel,
      icon: "mdi:cards-outline",
      disabled: true
    },
    {
      label: songsLabel,
      icon: "mdi:music-note-outline",
      disabled: true
    },
    {
      label: eventsLabel,
      href: `/events/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/events/") || page.url.pathname.startsWith("/event/"),
      icon: "mdi:calendar-star"
    },
    {
      label: virtualLivesLabel,
      icon: "mdi:account-voice",
      disabled: true
    }
  ]);
  const showPageTitle = $derived(page.url.pathname === "/");
  const themeModeLabel = $derived(getThemeModeLabel(uiLocale, themeMode));
  const resolvedThemeLabel = $derived(getThemeModeLabel(uiLocale, resolvedTheme));
  const uiLocaleDisplayLabel = $derived(`${uiLocaleNameByCode[uiLocale]}(${uiLocale})`);

  $effect(() => {
    void refreshTranslations(uiLocale);
  });

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const resolvedLocale = await setI18nLocale(localeValue);

    homeLabel = tCommon(resolvedLocale, "home");
    sidebarLabel = tCommon(resolvedLocale, "navigation.sidebarTitle");
    databaseLabel = tCommon(resolvedLocale, "navigation.database");
    cardsLabel = tCommon(resolvedLocale, "navigation.cards");
    songsLabel = tCommon(resolvedLocale, "navigation.songs");
    eventsLabel = tCommon(resolvedLocale, "navigation.events");
    virtualLivesLabel = tCommon(resolvedLocale, "navigation.virtualLives");
    settingsLabel = tCommon(resolvedLocale, "settings.title");
    themeControlLabel = tCommon(resolvedLocale, "settings.appearance");
    themePaletteLabel = tCommon(resolvedLocale, "settings.theme");
    interfaceLanguageLabel = tCommon(resolvedLocale, "settings.interfaceLanguage");
    currentLanguageLabel = tCommon(resolvedLocale, "settings.currentLanguage");
    backToTopLabel = tCommon(resolvedLocale, "backToTopLabel");
    loadingLanguagePackLabel = tCommon(resolvedLocale, "loadingLanguagePack");
    switchThemeAriaLabel = tCommon(resolvedLocale, "aria.switchTheme");
    switchUiLanguageCurrentLabel = tCommon(resolvedLocale, "aria.switchUiLanguageCurrent");
    themeNameLabels = {
      default: tCommon(resolvedLocale, "themeName.default"),
      sakura: tCommon(resolvedLocale, "themeName.sakura"),
      mint: tCommon(resolvedLocale, "themeName.mint")
    };
  };

  const getSystemTheme = (): ResolvedTheme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const resolveThemeMode = (themeModeValue: ThemeMode): ResolvedTheme =>
    themeModeValue === "auto" ? getSystemTheme() : themeModeValue;

  const applyTheme = (nextThemeName: ThemeName, nextThemeMode: ThemeMode): void => {
    const nextResolvedTheme = resolveThemeMode(nextThemeMode);
    document.documentElement.setAttribute("data-theme", nextThemeName);
    document.documentElement.classList.toggle("dark", nextResolvedTheme === "dark");
    localStorage.setItem(THEME_NAME_STORAGE_KEY, nextThemeName);
    localStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
    themeName = nextThemeName;
    resolvedTheme = nextResolvedTheme;
    themeMode = nextThemeMode;
  };

  const handleSystemThemeChange = (): void => {
    if (themeMode === "auto") {
      const nextResolvedTheme = getSystemTheme();
      document.documentElement.classList.toggle("dark", nextResolvedTheme === "dark");
      resolvedTheme = nextResolvedTheme;
    }
  };

  const resolvePreferredTheme = (): ThemeMode => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "auto") {
      return storedTheme;
    }

    return "auto";
  };

  const resolvePreferredThemeName = (): ThemeName => {
    const storedThemeName = localStorage.getItem(THEME_NAME_STORAGE_KEY);
    if (storedThemeName === "default" || storedThemeName === "sakura" || storedThemeName === "mint") {
      return storedThemeName;
    }

    return "default";
  };

  const getThemeModeIcon = (themeModeValue: ThemeMode): string => {
    if (themeModeValue === "auto") {
      return "mdi:brightness-auto";
    }

    return themeModeValue === "light" ? "mdi:white-balance-sunny" : "mdi:weather-night";
  };

  const getThemeButtonTitle = (): string => {
    const modeLabel =
      themeMode === "auto" ? `${themeModeLabel} (${resolvedThemeLabel})` : themeModeLabel;

    return `${themePaletteLabel}: ${getThemeNameLabel(themeName)} / ${modeLabel}`;
  };

  const getThemeNameLabel = (themeNameValue: ThemeName): string => {
    return themeNameLabels[themeNameValue];
  };

  const handleLocaleMenuToggle = (event: Event): void => {
    const detailsElement = event.currentTarget as HTMLDetailsElement;
    isLocaleMenuOpen = detailsElement.open;
  };

  const closeDropdownIfClickedOutside = (
    detailsElement: HTMLDetailsElement | null,
    target: EventTarget | null
  ): void => {
    if (!detailsElement?.open) {
      return;
    }

    if (target instanceof Node && detailsElement.contains(target)) {
      return;
    }

    detailsElement.open = false;
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

  const updateBackToTopVisibility = (): void => {
    showBackToTop = window.scrollY > 240;
  };

  const scrollToTop = (): void => {
    if (backToTopAnimationFrame) {
      window.cancelAnimationFrame(backToTopAnimationFrame);
      backToTopAnimationFrame = 0;
    }

    const startY = window.scrollY;
    if (startY <= 0) {
      return;
    }

    const durationMs = 220;
    const startTime = performance.now();
    const easeOutCubic = (progress: number): number => 1 - Math.pow(1 - progress, 3);

    const animate = (timestamp: number): void => {
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const easedProgress = easeOutCubic(progress);
      window.scrollTo({ top: startY * (1 - easedProgress) });

      if (progress < 1) {
        backToTopAnimationFrame = window.requestAnimationFrame(animate);
        return;
      }

      backToTopAnimationFrame = 0;
      updateBackToTopVisibility();
    };

    backToTopAnimationFrame = window.requestAnimationFrame(animate);
  };

  onMount(() => {
    systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemThemeMediaQuery.addEventListener("change", handleSystemThemeChange);
    applyTheme(resolvePreferredThemeName(), resolvePreferredTheme());
    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

    const handleDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      closeDropdownIfClickedOutside(mobileSettingsMenu, target);
      closeDropdownIfClickedOutside(desktopThemeMenu, target);
      closeDropdownIfClickedOutside(localeMenu, target);
      isLocaleMenuOpen = localeMenu?.open ?? false;
    };

    document.addEventListener("click", handleDocumentClick);

    return () => {
      if (backToTopAnimationFrame) {
        window.cancelAnimationFrame(backToTopAnimationFrame);
        backToTopAnimationFrame = 0;
      }
      document.removeEventListener("click", handleDocumentClick);
      window.removeEventListener("scroll", updateBackToTopVisibility);
      systemThemeMediaQuery?.removeEventListener("change", handleSystemThemeChange);
    };
  });
</script>

<svelte:head>
  <title>Sekai Viewer</title>
  <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
</svelte:head>

{#if $isLocaleLoading}
  <div class="pointer-events-none fixed inset-x-0 top-2 z-240 flex justify-center px-4">
    <div class="inline-flex items-center gap-2 rounded-full border border-base-content/20 bg-base-100/86 px-3 py-1 text-xs font-semibold shadow-lg backdrop-blur-md">
      <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
      <span>{interfaceLanguageLabel}: {uiLocaleDisplayLabel}</span>
    </div>
  </div>
{/if}

<ViewerShell
  drawerId="content-site-drawer"
  navTitle="Sekai Viewer"
  sidebarLabel={sidebarLabel}
  sidebarItems={sidebarItems}
  showTitle={showPageTitle}
>
  {#snippet navActions()}
    <div class="sm:hidden">
      <details class="dropdown dropdown-end" bind:this={mobileSettingsMenu}>
        <summary
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100"
          aria-label={settingsLabel}
          title={settingsLabel}
        >
          <Icon icon="mdi:tune-variant" class="h-4 w-4" />
        </summary>
        <div class="dropdown-content z-130 mt-3 w-52 rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl backdrop-blur-sm">
          <div class="flex flex-col gap-1">
            <span class="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
              {themePaletteLabel}
            </span>
            <div class="grid grid-cols-3 gap-1">
              {#each themeNameOptions as themeNameOption (themeNameOption)}
                <button
                  type="button"
                  class={`btn btn-sm justify-center rounded-lg border-base-content/15 ${themeName === themeNameOption ? "btn-primary" : "bg-base-100"}`}
                  onclick={() => {
                    applyTheme(themeNameOption, themeMode);
                  }}
                >
                  <span class="font-semibold">{getThemeNameLabel(themeNameOption)}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="my-2 h-px bg-base-content/12"></div>

          <div class="flex flex-col gap-1">
            <span class="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
              {themeControlLabel}
            </span>
            <div class="grid grid-cols-3 gap-1">
              {#each ["auto", "light", "dark"] as themeOption (themeOption)}
                <button
                  type="button"
                  class={`btn btn-sm h-auto flex-col justify-center gap-1 rounded-lg border-base-content/15 py-2 ${themeMode === themeOption ? "btn-primary" : "bg-base-100"}`}
                  onclick={() => {
                    applyTheme(themeName, themeOption as ThemeMode);
                  }}
                >
                  <Icon icon={getThemeModeIcon(themeOption as ThemeMode)} class="h-5 w-5 shrink-0" />
                  <span class="text-[0.6rem] font-semibold leading-none">{getThemeModeLabel(uiLocale, themeOption as ThemeMode)}</span>
                </button>
              {/each}
            </div>
          </div>

          <div class="my-2 h-px bg-base-content/12"></div>

          <div class="flex flex-col gap-1">
            <span class="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
              {interfaceLanguageLabel}
            </span>
            <div class="grid gap-1">
              {#each uiLocaleOptions as localeOption (localeOption.code)}
                {#if localeOption.code === uiLocale}
                  <button
                    type="button"
                    class="btn btn-sm btn-primary justify-start rounded-lg border-base-content/15"
                    disabled={true}
                  >
                    <span>{uiLocaleNameByCode[localeOption.code]}({localeOption.code})</span>
                  </button>
                {/if}
              {/each}
              {#each uiLocaleOptions as localeOption (localeOption.code)}
                {#if localeOption.code !== uiLocale}
                  <button
                    type="button"
                    class="btn btn-sm justify-start rounded-lg border-base-content/15 bg-base-100"
                    disabled={$isLocaleLoading}
                    onclick={async () => {
                      await setUiLocale(localeOption.code);
                      if (mobileSettingsMenu) mobileSettingsMenu.open = true;
                    }}
                  >
                    <span>{uiLocaleNameByCode[localeOption.code]}({localeOption.code})</span>
                  </button>
                {/if}
              {/each}
            </div>
            {#if $isLocaleLoading}
              <span class="px-1 text-xs opacity-70">{loadingLanguagePackLabel}</span>
            {/if}
          </div>
        </div>
      </details>
    </div>

    <div class="hidden items-center gap-2 sm:flex">
      <details class="dropdown dropdown-end" bind:this={desktopThemeMenu}>
        <summary
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100"
          aria-label={switchThemeAriaLabel}
          title={getThemeButtonTitle()}
        >
          <Icon icon="mdi:palette-outline" class="h-4 w-4" />
        </summary>
        <ul class="menu dropdown-content z-120 mt-3 min-w-max rounded-box border border-base-content/15 bg-base-100/96 p-1 shadow-xl backdrop-blur-sm">
          <li class="menu-title px-2 py-1 text-[0.68rem] uppercase tracking-[0.16em] opacity-60">
            {themePaletteLabel}
          </li>
          {#each themeNameOptions as themeNameOption (themeNameOption)}
            <li>
              <button
                type="button"
                class={themeName === themeNameOption ? "menu-active font-semibold" : ""}
                onclick={() => {
                  applyTheme(themeNameOption, themeMode);
                }}
              >
                <span>{getThemeNameLabel(themeNameOption)}</span>
                {#if themeName === themeNameOption}
                  <Icon icon="mdi:check" class="h-4 w-4 opacity-80" />
                {/if}
              </button>
            </li>
          {/each}

          <li class="menu-title mt-2 px-2 py-1 text-[0.68rem] uppercase tracking-[0.16em] opacity-60">
            {themeControlLabel}
          </li>
          {#each ["auto", "light", "dark"] as themeOption (themeOption)}
            <li>
              <button
                type="button"
                class={themeMode === themeOption ? "menu-active font-semibold" : ""}
                onclick={() => {
                  applyTheme(themeName, themeOption as ThemeMode);
                }}
              >
                <Icon icon={getThemeModeIcon(themeOption as ThemeMode)} class="h-4 w-4 opacity-80" />
                <span>{getThemeModeLabel(uiLocale, themeOption as ThemeMode)}</span>
                {#if themeMode === themeOption}
                  <Icon icon="mdi:check" class="h-4 w-4 opacity-80" />
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </details>

      <details class="dropdown dropdown-end" bind:this={localeMenu} bind:open={isLocaleMenuOpen} ontoggle={handleLocaleMenuToggle}>
        <summary
          class={`btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100 ${$isLocaleLoading ? "pointer-events-none opacity-75" : ""}`}
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
          {#if $isLocaleLoading}
            <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
          {/if}
        </summary>
        <div class="dropdown-content z-120 mt-3 min-w-max rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl backdrop-blur-sm">
          <div class="rounded-xl border border-base-content/12 bg-base-100/65 p-2">
            <p class="px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-60">
              {currentLanguageLabel}
            </p>
            <p class="px-1 pt-1 text-sm font-semibold">{uiLocaleDisplayLabel}</p>
          </div>

          <div class="my-2 h-px bg-base-content/12"></div>

          <ul class="menu p-0">
            {#each uiLocaleOptions as localeOption (localeOption.code)}
              {#if localeOption.code !== uiLocale}
                <li>
                  <button
                    type="button"
                    disabled={$isLocaleLoading}
                    onclick={async () => {
                      await setUiLocale(localeOption.code);
                      isLocaleMenuOpen = false;
                    }}
                  >
                    <span>{uiLocaleNameByCode[localeOption.code]}({localeOption.code})</span>
                  </button>
                </li>
              {/if}
            {/each}
          </ul>
        </div>
      </details>
    </div>
  {/snippet}

  {@render children()}
</ViewerShell>

{#if showBackToTop}
  <button
    type="button"
    class="fixed bottom-5 right-5 z-30 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-content shadow-lg transition-[transform,opacity,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
    aria-label={backToTopLabel}
    title={backToTopLabel}
    onclick={scrollToTop}
  >
    <Icon icon="mdi:arrow-up" class="h-5 w-5" />
  </button>
{/if}
