<script lang="ts">
  import "../app.css";
  import "$lib/icons/mdi";
  import { env } from "$env/dynamic/public";
  import { goto, invalidateAll } from "$app/navigation";
  import { asset } from "$app/paths";
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import { GlobalNotificationBanner, ViewerShell, type SidebarItem } from "@platform/ui-shell";
  import { onMount, type Snippet } from "svelte";
  import { createI18nTranslator, getLocalI18nMessages, mediaLabI18nNamespaces } from "$lib/i18n/runtime";
  import { registerStoryAssetCache } from "$lib/story/asset-cache-client";
  import {
    isActivePickerStoryTypePath,
    pickerStoryTypeIcons,
    pickerStoryTypes
  } from "$lib/story/story-picker";
  import {
    DEFAULT_UI_LOCALE,
    buildUiLocaleCookie,
    normalizeUiLocale,
    supportedUiLocales,
    type SupportedUiLocale
  } from "$lib/i18n/region";
  import {
    buildPrimaryRegionUrl,
    normalizePrimaryRegion,
    provideRegionSelection,
    supportedRegions,
    type SupportedRegion
  } from "$lib/region-selection.svelte";
  import type { LayoutData } from "./$types";
  import {
    applyDocumentTheme,
    normalizeThemeMode,
    normalizeThemeName,
    THEME_MODE_STORAGE_KEY,
    THEME_NAME_STORAGE_KEY,
    type ResolvedTheme,
    type ThemeMode,
    type ThemeName
  } from "$lib/theme";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const supportPageUrl = env.PUBLIC_SUPPORT_PAGE_URL?.trim();
  const regionSelection = provideRegionSelection();
  regionSelection.primary = normalizePrimaryRegion(page.url.searchParams.get("region"));
  // The shell (including the sidebar's story-type labels) translates keys
  // from every namespace, so the SSR fallback must too; `data.i18nMessages`
  // layers any remote overrides on top after hydration.
  const fallbackMessages = getLocalI18nMessages(mediaLabI18nNamespaces);
  let messages = $state(fallbackMessages);
  let themeName = $state<ThemeName>("default");
  let themeMode = $state<ThemeMode>("auto");
  let isDesktopSettingsMenuOpen = $state(false);
  let isDesktopThemeMenuOpen = $state(false);
  let isDesktopLanguageMenuOpen = $state(false);
  let isMobileSettingsMenuOpen = $state(false);

  const translate = $derived(createI18nTranslator(data.uiLocale, messages));

  // Literal keys keep `pnpm i18n:check` able to verify externalization; the
  // option set itself comes from the shared supported-locale list. The Record
  // type fails svelte-check if the shared locale set ever changes shape.
  const localeNames = $derived<Record<SupportedUiLocale, string>>({
    en: translate("language.en"),
    "ja-JP": translate("language.ja-JP"),
    "ko-KR": translate("language.ko-KR"),
    "zh-CN": translate("language.zh-CN"),
    "zh-TW": translate("language.zh-TW")
  });

  const themeNames: ThemeName[] = ["default", "sakura", "mint"];
  const themeModes: ThemeMode[] = ["auto", "light", "dark"];
  const DESKTOP_SETTINGS_MENU_ID = "media-lab-site-desktop-settings-menu";
  const DESKTOP_THEME_MENU_ID = "media-lab-site-desktop-theme-menu";
  const DESKTOP_LANGUAGE_MENU_ID = "media-lab-site-desktop-language-menu";
  const MOBILE_SETTINGS_MENU_ID = "media-lab-site-mobile-settings-menu";
  let desktopSettingsMenu: HTMLDivElement | null = null;
  let desktopThemeMenu: HTMLDivElement | null = null;
  let desktopLanguageMenu: HTMLDivElement | null = null;
  let mobileSettingsMenu: HTMLDivElement | null = null;
  let desktopSettingsButton: HTMLButtonElement | null = null;
  let desktopThemeButton: HTMLButtonElement | null = null;
  let desktopLanguageButton: HTMLButtonElement | null = null;
  let mobileSettingsButton: HTMLButtonElement | null = null;

  const getThemeModeIcon = (mode: ThemeMode): string =>
    mode === "auto"
      ? "mdi:brightness-auto"
      : mode === "light"
        ? "mdi:white-balance-sunny"
        : "mdi:weather-night";
  const closeOpenMenus = (focusTrigger = false): boolean => {
    if (isMobileSettingsMenuOpen) {
      isMobileSettingsMenuOpen = false;
      if (focusTrigger) mobileSettingsButton?.focus();
      return true;
    }
    if (isDesktopSettingsMenuOpen) {
      isDesktopSettingsMenuOpen = false;
      if (focusTrigger) desktopSettingsButton?.focus();
      return true;
    }
    if (isDesktopThemeMenuOpen) {
      isDesktopThemeMenuOpen = false;
      if (focusTrigger) desktopThemeButton?.focus();
      return true;
    }
    if (isDesktopLanguageMenuOpen) {
      isDesktopLanguageMenuOpen = false;
      if (focusTrigger) desktopLanguageButton?.focus();
      return true;
    }
    return false;
  };
  const closeIfClickedOutside = (
    element: HTMLElement | null,
    target: EventTarget | null,
    close: () => void
  ): void => {
    if (!(target instanceof Node) || !element?.contains(target)) close();
  };

  // The `/live2d/story-reader/...` route is the Live2D Player mode of
  // StoryReader, so it activates the StoryReader destination; every other
  // `/live2d` path belongs to the Model Viewer destination.
  const pathname = $derived(page.url.pathname);
  const isStoryReaderRoute = $derived(
    pathname.startsWith("/story-reader") || pathname.startsWith("/live2d/story-reader")
  );

  const sidebarItems: SidebarItem[] = $derived([
    {
      label: translate("navigation.home"),
      href: "/",
      icon: "mdi:home-variant-outline",
      active: pathname === "/"
    },
    { type: "section", label: translate("navigation.storyReader") },
    ...pickerStoryTypes.map((storyType) => ({
      label: translate(`storyReader.storyType.${storyType}`),
      href: `/story-reader/${storyType}`,
      icon: pickerStoryTypeIcons[storyType],
      active: isActivePickerStoryTypePath(pathname, storyType)
    })),
    { type: "section", label: translate("navigation.studios") },
    {
      label: translate("navigation.live2d"),
      href: "/live2d",
      icon: "mdi:drama-masks",
      active: pathname.startsWith("/live2d") && !isStoryReaderRoute
    },
    {
      label: translate("navigation.assetViewer"),
      icon: "mdi:cube-outline",
      disabled: true
    },
    ...(supportPageUrl
      ? [
          {
            label: translate("navigation.support"),
            href: supportPageUrl,
            icon: "mdi:hand-heart"
          }
        ]
      : [])
  ]);

  const systemTheme = (): ResolvedTheme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const applyTheme = (nextName: ThemeName, nextMode: ThemeMode): void => {
    applyDocumentTheme(document.documentElement, nextName, nextMode, systemTheme());
    localStorage.setItem(THEME_NAME_STORAGE_KEY, nextName);
    localStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode);
    themeName = nextName;
    themeMode = nextMode;
  };

  // Persists the normalized locale in the site cookie, then re-runs every load
  // function so the SSR layout returns the selected locale and its messages.
  const applyUiLocale = async (localeValue: SupportedUiLocale): Promise<void> => {
    const nextLocale = normalizeUiLocale(localeValue, DEFAULT_UI_LOCALE);
    if (nextLocale === data.uiLocale) return;
    document.cookie = buildUiLocaleCookie(nextLocale);
    await invalidateAll();
  };

  const applyPrimaryRegion = async (region: SupportedRegion): Promise<void> => {
    await goto(buildPrimaryRegionUrl(page.url, region), {
      invalidateAll: true,
      keepFocus: true,
      noScroll: true
    });
  };

  $effect(() => {
    // Only an explicit `?region=` updates the shared selection. In-app links
    // that omit the param (e.g. the sidebar picker sub-pages) keep the
    // sticky selection instead of resetting it to the default.
    const regionParam = page.url.searchParams.get("region");
    if (regionParam !== null) {
      regionSelection.primary = normalizePrimaryRegion(regionParam);
    }
  });

  // Best-effort LRU cache for story assets; the allowlist follows the
  // server-resolved asset base so it always matches what the player fetches.
  // Registration failures are swallowed inside the helper.
  onMount(() => {
    void registerStoryAssetCache(data.assetBase);
  });

  onMount(() => {
    themeName = normalizeThemeName(localStorage.getItem(THEME_NAME_STORAGE_KEY));
    themeMode = normalizeThemeMode(localStorage.getItem(THEME_MODE_STORAGE_KEY));
    applyDocumentTheme(document.documentElement, themeName, themeMode, systemTheme());
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (): void => {
      if (themeMode === "auto")
        applyDocumentTheme(document.documentElement, themeName, themeMode, systemTheme());
    };
    colorScheme.addEventListener("change", handleSystemThemeChange);
    const handleDocumentClick = (event: MouseEvent): void => {
      if (isMobileSettingsMenuOpen)
        closeIfClickedOutside(mobileSettingsMenu, event.target, () => {
          isMobileSettingsMenuOpen = false;
        });
      if (isDesktopSettingsMenuOpen)
        closeIfClickedOutside(desktopSettingsMenu, event.target, () => {
          isDesktopSettingsMenuOpen = false;
        });
      if (isDesktopThemeMenuOpen)
        closeIfClickedOutside(desktopThemeMenu, event.target, () => {
          isDesktopThemeMenuOpen = false;
        });
      if (isDesktopLanguageMenuOpen)
        closeIfClickedOutside(desktopLanguageMenu, event.target, () => {
          isDesktopLanguageMenuOpen = false;
        });
    };
    const handleDocumentKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && closeOpenMenus(true)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);
    return () => {
      colorScheme.removeEventListener("change", handleSystemThemeChange);
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeydown);
    };
  });

  $effect(() => {
    void Promise.resolve(data.i18nMessages).then((next) => {
      messages = { ...fallbackMessages, ...next };
    });
  });
</script>

<svelte:head>
  <title>{translate("shell.title")}</title>
  <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
</svelte:head>

<GlobalNotificationBanner
  notices={data.globalNotices}
  externalLinkLabel={translate("notification.opensInNewWindow")}
/>

<ViewerShell
  drawerId="media-lab-site-drawer"
  navTitle={translate("shell.title")}
  navBadge={translate("shell.badge")}
  siteVersion={data.siteVersion}
  skipToMainLabel={translate("navigation.skipToMain")}
  openSidebarLabel={translate("navigation.openSidebar")}
  closeSidebarLabel={translate("navigation.closeSidebar")}
  sidebarLabel={translate("navigation.sidebar")}
  {sidebarItems}
  desktopRailOpen={true}
  showTitle={page.url.pathname === "/"}
  mainWidthClass="max-w-320"
>
  {#snippet navActions()}
    <div class="relative z-120 hidden items-center gap-2 sm:flex">
      <div
        class="dropdown dropdown-end"
        class:dropdown-open={isDesktopSettingsMenuOpen}
        bind:this={desktopSettingsMenu}
      >
        <button
          bind:this={desktopSettingsButton}
          type="button"
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100"
          aria-label={translate("settings.title")}
          aria-haspopup="dialog"
          aria-expanded={isDesktopSettingsMenuOpen}
          aria-controls={DESKTOP_SETTINGS_MENU_ID}
          title={translate("settings.title")}
          onclick={() => {
            isDesktopSettingsMenuOpen = !isDesktopSettingsMenuOpen;
          }}
        >
          <Icon icon="mdi:cog-outline" class="size-4" aria-hidden="true" />
        </button>
        {#if isDesktopSettingsMenuOpen}
          <div
            id={DESKTOP_SETTINGS_MENU_ID}
            role="dialog"
            aria-label={translate("settings.title")}
            class="dropdown-content z-120 mt-3 w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded-box border border-base-content/15 bg-base-100/96 p-3 shadow-xl"
          >
            {@render regionSelector()}
          </div>
        {/if}
      </div>
      <div
        class="dropdown dropdown-end"
        class:dropdown-open={isDesktopThemeMenuOpen}
        bind:this={desktopThemeMenu}
      >
        <button
          bind:this={desktopThemeButton}
          type="button"
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100"
          aria-label={translate("theme.palette")}
          aria-haspopup="true"
          aria-expanded={isDesktopThemeMenuOpen}
          aria-controls={DESKTOP_THEME_MENU_ID}
          title={translate("theme.palette")}
          onclick={() => {
            isDesktopThemeMenuOpen = !isDesktopThemeMenuOpen;
          }}
        >
          <Icon icon="mdi:palette-outline" class="size-4" aria-hidden="true" />
        </button>
        {#if isDesktopThemeMenuOpen}
          <div
            id={DESKTOP_THEME_MENU_ID}
            class="dropdown-content z-120 mt-3 w-max max-w-[calc(100vw-2rem)] rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl"
          >
            {@render themeSelector(() => {
              isDesktopThemeMenuOpen = false;
            })}
          </div>
        {/if}
      </div>
      <div
        class="dropdown dropdown-end"
        class:dropdown-open={isDesktopLanguageMenuOpen}
        bind:this={desktopLanguageMenu}
      >
        <button
          bind:this={desktopLanguageButton}
          type="button"
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100"
          aria-label={`${translate("aria.switchUiLanguage")}: ${localeNames[data.uiLocale]}`}
          aria-haspopup="true"
          aria-expanded={isDesktopLanguageMenuOpen}
          aria-controls={DESKTOP_LANGUAGE_MENU_ID}
          title={`${translate("aria.switchUiLanguage")}: ${localeNames[data.uiLocale]}`}
          onclick={() => {
            isDesktopLanguageMenuOpen = !isDesktopLanguageMenuOpen;
          }}
        >
          <Icon icon="mdi:translate" class="size-4" aria-hidden="true" />
        </button>
        {#if isDesktopLanguageMenuOpen}
          <div
            id={DESKTOP_LANGUAGE_MENU_ID}
            class="dropdown-content z-120 mt-3 w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl"
          >
            {@render languageSelector(() => {
              isDesktopLanguageMenuOpen = false;
            })}
          </div>
        {/if}
      </div>
    </div>
    <div class="sm:hidden">
      <div
        class="dropdown dropdown-end"
        class:dropdown-open={isMobileSettingsMenuOpen}
        bind:this={mobileSettingsMenu}
      >
        <button
          bind:this={mobileSettingsButton}
          type="button"
          class="btn btn-circle btn-sm size-11! min-h-11! btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100"
          aria-label={translate("settings.title")}
          aria-haspopup="dialog"
          aria-expanded={isMobileSettingsMenuOpen}
          aria-controls={MOBILE_SETTINGS_MENU_ID}
          title={translate("settings.title")}
          onclick={() => {
            isMobileSettingsMenuOpen = !isMobileSettingsMenuOpen;
          }}
        >
          <Icon icon="mdi:tune-variant" class="size-5" aria-hidden="true" />
        </button>
        {#if isMobileSettingsMenuOpen}
          <div
            id={MOBILE_SETTINGS_MENU_ID}
            role="dialog"
            aria-label={translate("settings.title")}
            class="dropdown-content z-130 mt-3 w-[min(16rem,calc(100vw-1rem))] max-h-[70vh] max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl"
          >
            {@render regionSelector()}
            <div class="my-3 h-px bg-base-content/12"></div>
            {@render themeSelector(() => {})}
            <div class="my-3 h-px bg-base-content/12"></div>
            {@render languageSelector(() => {})}
          </div>
        {/if}
      </div>
    </div>
  {/snippet}
  {@render children()}
</ViewerShell>

{#snippet regionSelector()}
  <div class="flex flex-col gap-2">
    <span class="px-1 text-xs font-semibold opacity-70">{translate("settings.primaryRegion")}</span>
    <div class="flex flex-wrap gap-1">
      {#each supportedRegions as region (region)}
        <button
          type="button"
          class={`btn btn-sm min-h-11! rounded-lg border-base-content/15 px-3 ${regionSelection.primary === region ? "btn-primary" : "bg-base-100"}`}
          aria-pressed={regionSelection.primary === region}
          onclick={() => {
            void applyPrimaryRegion(region);
          }}
        >
          {translate(`region.${region}`)}
        </button>
      {/each}
    </div>
    <span class="px-1 text-xs font-semibold opacity-70"
      >{translate("settings.secondaryRegion")}</span
    >
    <div class="flex flex-wrap gap-1">
      {#each supportedRegions as region (region)}
        <button
          type="button"
          class={`btn btn-sm min-h-11! rounded-lg border-base-content/15 px-3 ${regionSelection.secondary === region ? "btn-primary" : "bg-base-100"}`}
          aria-pressed={regionSelection.secondary === region}
          onclick={() => {
            regionSelection.secondary = region;
          }}
        >
          {translate(`region.${region}`)}
        </button>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet languageSelector(close: () => void)}
  <div class="flex flex-col gap-1">
    <span class="px-1 text-xs font-semibold opacity-70"
      >{translate("settings.interfaceLanguage")}</span
    >
    <ul class="menu w-full p-0">
      {#each supportedUiLocales as locale (locale)}
        <li>
          <button
            type="button"
            class={data.uiLocale === locale ? "menu-active font-semibold" : ""}
            aria-current={data.uiLocale === locale ? "true" : undefined}
            onclick={() => {
              void applyUiLocale(locale).then(close);
            }}
          >
            <span>{localeNames[locale]}</span>
            {#if data.uiLocale === locale}
              <Icon icon="mdi:check" class="size-4 opacity-80" aria-hidden="true" />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/snippet}

{#snippet themeSelector(close: () => void)}
  <div class="flex flex-col gap-1">
    <span class="px-1 text-xs font-semibold opacity-70">{translate("theme.palette")}</span>
    <ul class="menu w-full p-0">
      {#each themeNames as option (option)}
        <li>
          <button
            type="button"
            class={themeName === option ? "menu-active font-semibold" : ""}
            onclick={() => {
              applyTheme(option, themeMode);
              close();
            }}
          >
            <span
              class={`size-3 rounded-full border border-base-content/20 ${option === "default" ? "bg-indigo-500" : option === "sakura" ? "bg-pink-400" : "bg-teal-400"}`}
              aria-hidden="true"
            ></span>
            {translate(`theme.${option}`)}
            {#if themeName === option}
              <Icon icon="mdi:check" class="size-4 opacity-80" aria-hidden="true" />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
    <div class="my-2 h-px bg-base-content/12"></div>
    <span class="px-1 text-xs font-semibold opacity-70">{translate("theme.mode")}</span>
    <ul class="menu w-full p-0">
      {#each themeModes as option (option)}
        <li>
          <button
            type="button"
            class={themeMode === option ? "menu-active font-semibold" : ""}
            onclick={() => {
              applyTheme(themeName, option);
              close();
            }}
          >
            <Icon icon={getThemeModeIcon(option)} class="size-4 opacity-80" aria-hidden="true" />
            <span>{translate(`theme.${option}`)}</span>
            {#if themeMode === option}
              <Icon icon="mdi:check" class="size-4 opacity-80" aria-hidden="true" />
            {/if}
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/snippet}
