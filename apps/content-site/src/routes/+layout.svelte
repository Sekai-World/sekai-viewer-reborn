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
    DEFAULT_UI_LOCALE,
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
  let settingsLabel = $state(getContentSiteCommonText(initialLocale, "settings.title"));
  let themeControlLabel = $state(getContentSiteCommonText(initialLocale, "darkmode"));
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
  const resolvedThemeLabel = $derived(getThemeModeLabel(uiLocale, resolvedTheme));
  const uiLocaleDisplayLabel = $derived(`${uiLocaleNameByCode[uiLocale]}(${uiLocale})`);

  $effect(() => {
    void refreshTranslations(uiLocale);
  });

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const resolvedLocale = await setI18nLocale(localeValue);

    homeLabel = tCommon(resolvedLocale, "home");
    settingsLabel = tCommon(resolvedLocale, "settings.title");
    themeControlLabel = tCommon(resolvedLocale, "darkmode");
    interfaceLanguageLabel = tCommon(resolvedLocale, "settings.interfaceLanguage");
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

  const getThemeModeIcon = (themeModeValue: ThemeMode, resolvedThemeValue: ResolvedTheme): string => {
    if (themeModeValue === "auto") {
      return resolvedThemeValue === "dark" ? "mdi:theme-light-dark" : "mdi:brightness-auto";
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

  onMount(() => {
    systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemThemeMediaQuery.addEventListener("change", handleSystemThemeChange);
    applyTheme(resolvePreferredTheme());

    return () => {
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
            <Icon icon={getThemeModeIcon(themeMode, resolvedTheme)} class="h-4 w-4" />
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
        <Icon icon={getThemeModeIcon(themeMode, resolvedTheme)} class="h-4 w-4" />
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
        <ul class="menu dropdown-content z-120 mt-3 w-56 rounded-box border border-base-content/15 bg-base-100/96 p-1 shadow-xl backdrop-blur-sm">
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
