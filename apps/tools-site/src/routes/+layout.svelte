<script lang="ts">
  import "../app.css";
  import "$lib/icons/mdi";
  import { asset } from "$app/paths";
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import { ViewerShell, type SidebarItem } from "@platform/ui-shell";
  import { onMount, type Snippet } from "svelte";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
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
  import {
    regionLabels,
    isTrackerSupportedRegion,
    trackerSupportedRegions,
    type TrackerSupportedRegion
  } from "$lib/regions";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "tracker"]);
  let messages = $state(fallbackMessages);
  let themeName = $state<ThemeName>("default");
  let themeMode = $state<ThemeMode>("auto");
  let isDesktopSettingsMenuOpen = $state(false);
  let isDesktopThemeMenuOpen = $state(false);
  let isMobileSettingsMenuOpen = $state(false);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const activeRegion = $derived.by<TrackerSupportedRegion>(() => {
    const [, route, region] = page.url.pathname.split("/");
    if (route !== "tracker") return "jp";
    return isTrackerSupportedRegion(region) ? region : "jp";
  });
  const trackerRegionHref = (region: TrackerSupportedRegion): string => {
    const search = page.url.search;
    return page.url.pathname.startsWith("/tracker/") ? `/tracker/${region}${search}` : `/tracker/${region}`;
  };
  const themeNames: ThemeName[] = ["default", "sakura", "mint"];
  const themeModes: ThemeMode[] = ["auto", "light", "dark"];
  const DESKTOP_SETTINGS_MENU_ID = "tools-site-desktop-settings-menu";
  const DESKTOP_THEME_MENU_ID = "tools-site-desktop-theme-menu";
  const MOBILE_SETTINGS_MENU_ID = "tools-site-mobile-settings-menu";
  let mobileSettingsMenu: HTMLDivElement | null = null;
  let desktopSettingsMenu: HTMLDivElement | null = null;
  let desktopThemeMenu: HTMLDivElement | null = null;
  let mobileSettingsButton: HTMLButtonElement | null = null;
  let desktopSettingsButton: HTMLButtonElement | null = null;
  let desktopThemeButton: HTMLButtonElement | null = null;
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
    return false;
  };
  const closeIfClickedOutside = (element: HTMLElement | null, target: EventTarget | null, close: () => void): void => {
    if (!(target instanceof Node) || !element?.contains(target)) close();
  };
  const sidebarItems: SidebarItem[] = $derived([
    { type: "section", label: translate("navigation.explore") },
    { label: translate("navigation.home"), href: "/", icon: "mdi:home-variant-outline", active: page.url.pathname === "/" },
    { type: "section", label: translate("navigation.liveData") },
    {
      label: translate("navigation.eventTracker"),
      href: "/tracker/jp",
      icon: "mdi:chart-line",
      active: page.url.pathname.startsWith("/tracker/")
    }
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

  onMount(() => {
    themeName = normalizeThemeName(localStorage.getItem(THEME_NAME_STORAGE_KEY));
    themeMode = normalizeThemeMode(localStorage.getItem(THEME_MODE_STORAGE_KEY));
    applyDocumentTheme(document.documentElement, themeName, themeMode, systemTheme());
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = (): void => {
      if (themeMode === "auto") applyDocumentTheme(document.documentElement, themeName, themeMode, systemTheme());
    };
    colorScheme.addEventListener("change", handleSystemThemeChange);
    const handleDocumentClick = (event: MouseEvent): void => {
      if (isMobileSettingsMenuOpen) closeIfClickedOutside(mobileSettingsMenu, event.target, () => { isMobileSettingsMenuOpen = false; });
      if (isDesktopSettingsMenuOpen) closeIfClickedOutside(desktopSettingsMenu, event.target, () => { isDesktopSettingsMenuOpen = false; });
      if (isDesktopThemeMenuOpen) closeIfClickedOutside(desktopThemeMenu, event.target, () => { isDesktopThemeMenuOpen = false; });
    };
    const handleDocumentKeydown = (event: KeyboardEvent): void => {
      if (event.key === "Escape" && closeOpenMenus(true)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (updateCallback: () => Promise<void> | void) => unknown;
    };
    const supportsNativeViewTransition = typeof viewTransitionDocument.startViewTransition === "function";

    if (!supportsNativeViewTransition || reducedMotion) {
      return () => {
        colorScheme.removeEventListener("change", handleSystemThemeChange);
        document.removeEventListener("click", handleDocumentClick);
        document.removeEventListener("keydown", handleDocumentKeydown);
      };
    }

    onNavigate((navigation) => {
      if (!viewTransitionDocument.startViewTransition) return;
      return new Promise<void>((resolve) => {
        viewTransitionDocument.startViewTransition(async () => {
          resolve();
          await navigation.complete;
        });
      });
    });
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
  <title>Sekai Viewer - Tools</title>
  <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
</svelte:head>

<ViewerShell
  drawerId="tools-site-drawer"
  navTitle={translate("shell.title")}
  navBadge={translate("shell.badge")}
  skipToMainLabel={translate("navigation.skipToMain")}
  openSidebarLabel={translate("navigation.openSidebar")}
  closeSidebarLabel={translate("navigation.closeSidebar")}
  sidebarLabel={translate("navigation.tools")}
  {sidebarItems}
  desktopRailOpen={true}
  showTitle={false}
>
  {#snippet navActions()}
    <div class="relative z-120 hidden items-center gap-2 sm:flex">
      <div class="dropdown dropdown-end" class:dropdown-open={isDesktopSettingsMenuOpen} bind:this={desktopSettingsMenu}>
        <button bind:this={desktopSettingsButton} type="button" class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100" aria-label={translate("settings.title")} aria-haspopup="dialog" aria-expanded={isDesktopSettingsMenuOpen} aria-controls={DESKTOP_SETTINGS_MENU_ID} title={translate("settings.title")} onclick={() => { isDesktopSettingsMenuOpen = !isDesktopSettingsMenuOpen; }}>
          <Icon icon="mdi:cog-outline" class="size-4" aria-hidden="true" />
        </button>
        {#if isDesktopSettingsMenuOpen}
          <div id={DESKTOP_SETTINGS_MENU_ID} role="dialog" aria-modal="true" aria-label={translate("settings.title")} class="dropdown-content z-120 mt-3 w-max max-w-[calc(100vw-2rem)] overflow-hidden rounded-box border border-base-content/15 bg-base-100/96 p-3 shadow-xl">
            {@render regionSelector()}
          </div>
        {/if}
      </div>
      <div class="dropdown dropdown-end" class:dropdown-open={isDesktopThemeMenuOpen} bind:this={desktopThemeMenu}>
        <button bind:this={desktopThemeButton} type="button" class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100" aria-label={translate("theme.palette")} aria-haspopup="true" aria-expanded={isDesktopThemeMenuOpen} aria-controls={DESKTOP_THEME_MENU_ID} title={translate("theme.palette")} onclick={() => { isDesktopThemeMenuOpen = !isDesktopThemeMenuOpen; }}>
          <Icon icon="mdi:palette-outline" class="size-4" aria-hidden="true" />
        </button>
        {#if isDesktopThemeMenuOpen}
          <div id={DESKTOP_THEME_MENU_ID} class="dropdown-content z-120 mt-3 w-max max-w-[calc(100vw-2rem)] rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl">
            {@render themeSelector(() => { isDesktopThemeMenuOpen = false; })}
          </div>
        {/if}
      </div>
    </div>
    <div class="sm:hidden">
      <div class="dropdown dropdown-end" class:dropdown-open={isMobileSettingsMenuOpen} bind:this={mobileSettingsMenu}>
        <button bind:this={mobileSettingsButton} type="button" class="btn btn-circle btn-sm size-11! min-h-11! btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100" aria-label={translate("settings.title")} aria-haspopup="dialog" aria-expanded={isMobileSettingsMenuOpen} aria-controls={MOBILE_SETTINGS_MENU_ID} title={translate("settings.title")} onclick={() => { isMobileSettingsMenuOpen = !isMobileSettingsMenuOpen; }}>
          <Icon icon="mdi:tune-variant" class="size-5" aria-hidden="true" />
        </button>
        {#if isMobileSettingsMenuOpen}
          <div id={MOBILE_SETTINGS_MENU_ID} role="dialog" aria-modal="true" aria-label={translate("settings.title")} class="dropdown-content z-130 mt-3 w-[min(13rem,calc(100vw-1rem))] max-h-[70vh] max-w-[calc(100vw-1rem)] overflow-x-hidden overflow-y-auto rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl">
            {@render regionSelector()}
            <div class="my-3 h-px bg-base-content/12"></div>
            {@render themeSelector(() => {})}
          </div>
        {/if}
      </div>
    </div>
  {/snippet}
  <div class="page-switch-shell">{@render children()}</div>
</ViewerShell>

{#snippet regionSelector()}
  <div class="flex flex-col gap-2">
    <span class="px-1 text-xs font-semibold opacity-70">{translate("settings.region")}</span>
    <div class="flex flex-wrap gap-1">
      {#each trackerSupportedRegions as region (region)}
        <a href={trackerRegionHref(region)} class={`btn btn-sm min-h-11! rounded-lg border-base-content/15 px-3 ${region === activeRegion ? "btn-primary" : "bg-base-100"}`} aria-current={region === activeRegion ? "page" : undefined}>
          {regionLabels[region]}
        </a>
      {/each}
    </div>
  </div>
{/snippet}

{#snippet themeSelector(close: () => void)}
  <div class="flex flex-col gap-1">
    <span class="px-1 text-xs font-semibold opacity-70">{translate("theme.palette")}</span>
    <ul class="menu p-0">
      {#each themeNames as option (option)}
        <li><button type="button" class={themeName === option ? "menu-active font-semibold" : ""} onclick={() => { applyTheme(option, themeMode); close(); }}><span class={`size-3 rounded-full border border-base-content/20 ${option === "default" ? "bg-indigo-500" : option === "sakura" ? "bg-pink-400" : "bg-teal-400"}`} aria-hidden="true"></span>{translate(`theme.${option}`)}{#if themeName === option}<Icon icon="mdi:check" class="size-4 opacity-80" aria-hidden="true" />{/if}</button></li>
      {/each}
    </ul>
    <div class="my-2 h-px bg-base-content/12"></div>
    <span class="px-1 text-xs font-semibold opacity-70">{translate("theme.mode")}</span>
    <ul class="menu p-0">
      {#each themeModes as option (option)}
        <li><button type="button" class={themeMode === option ? "menu-active font-semibold" : ""} onclick={() => { applyTheme(themeName, option); close(); }}><Icon icon={getThemeModeIcon(option)} class="size-4 opacity-80" aria-hidden="true" /><span>{translate(`theme.${option}`)}</span>{#if themeMode === option}<Icon icon="mdi:check" class="size-4 opacity-80" aria-hidden="true" />{/if}</button></li>
      {/each}
    </ul>
  </div>
{/snippet}
