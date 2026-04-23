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
  } from "@platform/i18n-dicts";
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
  type ResolvedTheme = "light" | "dark";
  type UiLocaleOption = {
    code: SupportedUiLocale;
  };

  const THEME_STORAGE_KEY = "content_site_theme_mode";
  const uiLocaleOptions: UiLocaleOption[] = supportedUiLocales.map((code) => ({ code }));

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const initialLocale = DEFAULT_UI_LOCALE;
  let uiLocale = $derived<SupportedUiLocale>(normalizeUiLocale(data.uiLocale, DEFAULT_UI_LOCALE));
  let themeMode = $state<ThemeMode>("auto");
  let resolvedTheme = $state<ResolvedTheme>("light");
  let isLocaleMenuOpen = $state(false);
  let systemThemeMediaQuery: MediaQueryList | null = null;

  let homeLabel = $state(getContentSiteCommonText(initialLocale, "home"));
  let databaseLabel = $state(getContentSiteCommonText(initialLocale, "navigation.database"));
  let cardsLabel = $state(getContentSiteCommonText(initialLocale, "navigation.cards"));
  let songsLabel = $state(getContentSiteCommonText(initialLocale, "navigation.songs"));
  let eventsLabel = $state(getContentSiteCommonText(initialLocale, "navigation.events"));
  let virtualLivesLabel = $state(getContentSiteCommonText(initialLocale, "navigation.virtualLives"));
  let settingsLabel = $state(getContentSiteCommonText(initialLocale, "settings.title"));
  let themeControlLabel = $state(getContentSiteCommonText(initialLocale, "darkmode"));
  let interfaceLanguageLabel = $state(
    getContentSiteCommonText(initialLocale, "settings.interfaceLanguage")
  );
  let backToTopLabel = $state(getContentSiteCommonText(initialLocale, "backToTopLabel"));
  let loadingLanguagePackLabel = $state(
    getContentSiteCommonText(initialLocale, "loadingLanguagePack")
  );
  let switchThemeAriaLabel = $state(getContentSiteCommonText(initialLocale, "aria.switchTheme"));
  let switchUiLanguageCurrentLabel = $state(
    getContentSiteCommonText(initialLocale, "aria.switchUiLanguageCurrent")
  );
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
    databaseLabel = tCommon(resolvedLocale, "navigation.database");
    cardsLabel = tCommon(resolvedLocale, "navigation.cards");
    songsLabel = tCommon(resolvedLocale, "navigation.songs");
    eventsLabel = tCommon(resolvedLocale, "navigation.events");
    virtualLivesLabel = tCommon(resolvedLocale, "navigation.virtualLives");
    settingsLabel = tCommon(resolvedLocale, "settings.title");
    themeControlLabel = tCommon(resolvedLocale, "darkmode");
    interfaceLanguageLabel = tCommon(resolvedLocale, "settings.interfaceLanguage");
    backToTopLabel = tCommon(resolvedLocale, "backToTopLabel");
    loadingLanguagePackLabel = tCommon(resolvedLocale, "loadingLanguagePack");
    switchThemeAriaLabel = tCommon(resolvedLocale, "aria.switchTheme");
    switchUiLanguageCurrentLabel = tCommon(resolvedLocale, "aria.switchUiLanguageCurrent");
  };

  const getSystemTheme = (): ResolvedTheme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const resolveThemeMode = (themeModeValue: ThemeMode): ResolvedTheme =>
    themeModeValue === "auto" ? getSystemTheme() : themeModeValue;

  const applyTheme = (nextThemeMode: ThemeMode): void => {
    const nextResolvedTheme = resolveThemeMode(nextThemeMode);
    document.documentElement.setAttribute("data-theme", nextResolvedTheme);
    localStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
    resolvedTheme = nextResolvedTheme;
    themeMode = nextThemeMode;
  };

  const handleSystemThemeChange = (): void => {
    if (themeMode === "auto") {
      const nextResolvedTheme = getSystemTheme();
      document.documentElement.setAttribute("data-theme", nextResolvedTheme);
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

  const getNextThemeMode = (currentThemeMode: ThemeMode): ThemeMode => {
    if (currentThemeMode === "auto") {
      return "light";
    }

    if (currentThemeMode === "light") {
      return "dark";
    }

    return "auto";
  };

  const getThemeModeIcon = (themeModeValue: ThemeMode): string => {
    if (themeModeValue === "auto") {
      return "mdi:brightness-auto";
    }

    return themeModeValue === "light" ? "mdi:white-balance-sunny" : "mdi:weather-night";
  };

  const toggleTheme = (): void => {
    applyTheme(getNextThemeMode(themeMode));
  };

  const getThemeButtonTitle = (): string =>
    themeMode === "auto" ? `${themeModeLabel} (${resolvedThemeLabel})` : themeModeLabel;

  const handleLocaleMenuToggle = (event: Event): void => {
    const detailsElement = event.currentTarget as HTMLDetailsElement;
    isLocaleMenuOpen = detailsElement.open;
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
    applyTheme(resolvePreferredTheme());
    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

    return () => {
      if (backToTopAnimationFrame) {
        window.cancelAnimationFrame(backToTopAnimationFrame);
        backToTopAnimationFrame = 0;
      }
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
        <div class="dropdown-content z-130 mt-3 w-66 rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl backdrop-blur-sm">
          <p class="mb-1 px-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] opacity-70">
            {settingsLabel}
          </p>

          <button
            type="button"
            class="btn btn-sm justify-start rounded-lg border-base-content/15 bg-base-100"
            onclick={toggleTheme}
          >
            <Icon icon={getThemeModeIcon(themeMode)} class="h-4 w-4" />
            <span class="font-semibold">
              {themeControlLabel}: {themeModeLabel}
              {#if themeMode === "auto"}
                ({resolvedThemeLabel})
              {/if}
            </span>
          </button>

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
        title={getThemeButtonTitle()}
        onclick={toggleTheme}
      >
        <Icon icon={getThemeModeIcon(themeMode)} class="h-4 w-4" />
      </button>

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
          <span class="max-w-34 truncate font-semibold sm:max-w-none">{uiLocaleDisplayLabel}</span>
          {#if $isLocaleLoading}
            <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
          {/if}
        </summary>
        <ul class="menu dropdown-content z-120 mt-3 min-w-max rounded-box border border-base-content/15 bg-base-100/96 p-1 shadow-xl backdrop-blur-sm">
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
