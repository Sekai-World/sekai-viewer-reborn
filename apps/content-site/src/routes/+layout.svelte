<script lang="ts">
  import "../app.css";
  import { asset } from "$app/paths";
  import { invalidateAll, onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import {
    setContentDisplaySettings,
    type ContentDisplaySettingsState
  } from "$lib/content-display-settings";
  import { supportedUiLocales, uiLocaleNameByCode, type SupportedUiLocale } from "$lib/i18n-config";
  import { ViewerShell, type SidebarItem } from "@platform/ui-shell";
  import { onMount, type Snippet } from "svelte";
  import { fade } from "svelte/transition";
  import {
    createI18nTranslator,
    isLocaleLoading,
    getThemeModeLabel,
    setI18nLocale,
    tCommon
  } from "$lib/i18n";
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
  const CONTENT_DISPLAY_STORAGE_KEY = "content_site_content_display_settings";
  const DESKTOP_SETTINGS_MENU_ID = "content-site-desktop-settings-menu";
  const DESKTOP_THEME_MENU_ID = "content-site-desktop-theme-menu";
  const LOCALE_MENU_ID = "content-site-locale-menu";
  const MOBILE_SETTINGS_MENU_ID = "content-site-mobile-settings-menu";
  const uiLocaleOptions: UiLocaleOption[] = supportedUiLocales.map((code) => ({ code }));
  const themeNameOptions: ThemeName[] = ["default", "sakura", "mint"];

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, data.i18nMessages)(key);
  let uiLocale = $derived<SupportedUiLocale>(normalizeUiLocale(data.uiLocale, DEFAULT_UI_LOCALE));
  let themeName = $state<ThemeName>("default");
  let themeMode = $state<ThemeMode>("auto");
  let resolvedTheme = $state<ResolvedTheme>("light");
  let isDesktopSettingsMenuOpen = $state(false);
  let isDesktopThemeMenuOpen = $state(false);
  let isMobileSettingsMenuOpen = $state(false);
  let isLocaleMenuOpen = $state(false);
  let systemThemeMediaQuery: MediaQueryList | null = null;
  let mobileSettingsMenu: HTMLDivElement | null = null;
  let desktopSettingsMenu: HTMLDivElement | null = null;
  let desktopThemeMenu: HTMLDivElement | null = null;
  let localeMenu: HTMLDivElement | null = null;
  let mobileSettingsButton: HTMLButtonElement | null = null;
  let desktopSettingsButton: HTMLButtonElement | null = null;
  let desktopThemeButton: HTMLButtonElement | null = null;
  let localeButton: HTMLButtonElement | null = null;
  let localeLoadingProgress = $state(0);
  let localeLoadingInterval: ReturnType<typeof setInterval> | null = null;
  let localeProgressResetTimeout: ReturnType<typeof setTimeout> | null = null;
  let useFallbackRouteTransition = $state(true);
  const navigationTransitionKey = $derived(`${page.url.pathname}${page.url.search}`);

  let homeLabel = $state(getInitialI18nText("home"));
  let openSidebarLabel = $state(getInitialI18nText("aria.openSidebar"));
  let closeSidebarLabel = $state(getInitialI18nText("aria.closeSidebar"));
  let sidebarLabel = $state(getInitialI18nText("navigation.sidebarTitle"));
  let databaseLabel = $state(getInitialI18nText("navigation.database"));
  let cardsLabel = $state(getInitialI18nText("navigation.cards"));
  let songsLabel = $state(getInitialI18nText("navigation.songs"));
  let eventsLabel = $state(getInitialI18nText("navigation.events"));
  let virtualLivesLabel = $state(getInitialI18nText("navigation.virtualLives"));
  let settingsLabel = $state(getInitialI18nText("settings.title"));
  let themeControlLabel = $state(getInitialI18nText("settings.appearance"));
  let themePaletteLabel = $state(getInitialI18nText("settings.theme"));
  let interfaceLanguageLabel = $state(getInitialI18nText("settings.interfaceLanguage"));
  let currentLanguageLabel = $state(getInitialI18nText("settings.currentLanguage"));
  let contentDisplayLabel = $state(getInitialI18nText("settings.contentDisplay"));
  let showSpoilerContentLabel = $state(getInitialI18nText("settings.showSpoilerContent"));
  let mosaickedSpoilerContentLabel = $state(getInitialI18nText("settings.mosaickedSpoilerContent"));
  let lowMotionModeLabel = $state(getInitialI18nText("settings.lowMotionMode"));
  let backToTopLabel = $state(getInitialI18nText("backToTopLabel"));
  let loadingLanguagePackLabel = $state(getInitialI18nText("loadingLanguagePack"));
  let switchThemeAriaLabel = $state(getInitialI18nText("aria.switchTheme"));
  let switchUiLanguageCurrentLabel = $state(getInitialI18nText("aria.switchUiLanguageCurrent"));
  let themeNameLabels = $state<Record<ThemeName, string>>({
    default: getInitialI18nText("themeName.default"),
    sakura: getInitialI18nText("themeName.sakura"),
    mint: getInitialI18nText("themeName.mint")
  });
  let showBackToTop = $state(false);
  let backToTopAnimationFrame = 0;
  let contentDisplaySettings = $state<ContentDisplaySettingsState>({
    showSpoilerContent: false,
    mosaickedSpoilerContent: true,
    lowMotionMode: false
  });

  setContentDisplaySettings(contentDisplaySettings);

  const sidebarRegion = $derived.by<ReturnType<typeof normalizeRegion>>(() => {
    const [first, second] = page.url.pathname.split("/").filter(Boolean);

    if (first === "cards" && second) {
      return normalizeRegion(second, DEFAULT_REGION);
    }

    if ((first === "event" || first === "events" || first === "musics") && second) {
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
      href: `/cards/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/cards/")
    },
    {
      label: songsLabel,
      icon: "mdi:music-note-outline",
      href: `/musics/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/musics/")
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
    const translate = createI18nTranslator(uiLocale, data.i18nMessages);
    applyTranslations(translate);
    void refreshTranslations(uiLocale);
  });

  const stopLocaleProgressTimers = (): void => {
    if (localeLoadingInterval !== null) {
      clearInterval(localeLoadingInterval);
      localeLoadingInterval = null;
    }

    if (localeProgressResetTimeout !== null) {
      clearTimeout(localeProgressResetTimeout);
      localeProgressResetTimeout = null;
    }
  };

  const startLocaleProgress = (): void => {
    if (typeof window === "undefined") {
      return;
    }

    stopLocaleProgressTimers();
    localeLoadingProgress = 8;

    localeLoadingInterval = setInterval(() => {
      // Smoothly approach 92% until remote dictionary loading finishes.
      const remaining = 92 - localeLoadingProgress;
      if (remaining <= 0) {
        return;
      }

      const step = Math.max(1, Math.ceil(remaining * 0.18));
      localeLoadingProgress = Math.min(92, localeLoadingProgress + step);
    }, 140);
  };

  const finishLocaleProgress = (): void => {
    if (typeof window === "undefined") {
      return;
    }

    stopLocaleProgressTimers();

    if (localeLoadingProgress === 0) {
      return;
    }

    localeLoadingProgress = 100;
    localeProgressResetTimeout = setTimeout(() => {
      localeLoadingProgress = 0;
      localeProgressResetTimeout = null;
    }, 220);
  };

  $effect(() => {
    if ($isLocaleLoading) {
      startLocaleProgress();
      return;
    }

    finishLocaleProgress();
  });

  const applyTranslations = (translate: (key: string) => string): void => {
    homeLabel = translate("home");
    openSidebarLabel = translate("aria.openSidebar");
    closeSidebarLabel = translate("aria.closeSidebar");
    sidebarLabel = translate("navigation.sidebarTitle");
    databaseLabel = translate("navigation.database");
    cardsLabel = translate("navigation.cards");
    songsLabel = translate("navigation.songs");
    eventsLabel = translate("navigation.events");
    virtualLivesLabel = translate("navigation.virtualLives");
    settingsLabel = translate("settings.title");
    themeControlLabel = translate("settings.appearance");
    themePaletteLabel = translate("settings.theme");
    interfaceLanguageLabel = translate("settings.interfaceLanguage");
    currentLanguageLabel = translate("settings.currentLanguage");
    contentDisplayLabel = translate("settings.contentDisplay");
    showSpoilerContentLabel = translate("settings.showSpoilerContent");
    mosaickedSpoilerContentLabel = translate("settings.mosaickedSpoilerContent");
    lowMotionModeLabel = translate("settings.lowMotionMode");
    backToTopLabel = translate("backToTopLabel");
    loadingLanguagePackLabel = translate("loadingLanguagePack");
    switchThemeAriaLabel = translate("aria.switchTheme");
    switchUiLanguageCurrentLabel = translate("aria.switchUiLanguageCurrent");
    themeNameLabels = {
      default: translate("themeName.default"),
      sakura: translate("themeName.sakura"),
      mint: translate("themeName.mint")
    };
  };

  const refreshTranslations = async (localeValue: string): Promise<void> => {
    const resolvedLocale = await setI18nLocale(localeValue, data.i18nMessages);
    applyTranslations((key) => tCommon(resolvedLocale, key));
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
    if (
      storedThemeName === "default" ||
      storedThemeName === "sakura" ||
      storedThemeName === "mint"
    ) {
      return storedThemeName;
    }

    return "default";
  };

  const resolvePreferredContentDisplaySettings = (): ContentDisplaySettingsState => {
    const defaultSettings: ContentDisplaySettingsState = {
      showSpoilerContent: false,
      mosaickedSpoilerContent: true,
      lowMotionMode:
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    };
    const storedSettings = localStorage.getItem(CONTENT_DISPLAY_STORAGE_KEY);

    if (!storedSettings) {
      return defaultSettings;
    }

    try {
      const parsed = JSON.parse(storedSettings) as Partial<ContentDisplaySettingsState>;
      return {
        showSpoilerContent: parsed.showSpoilerContent === true,
        mosaickedSpoilerContent:
          parsed.mosaickedSpoilerContent === false
            ? false
            : defaultSettings.mosaickedSpoilerContent,
        lowMotionMode:
          typeof parsed.lowMotionMode === "boolean"
            ? parsed.lowMotionMode
            : defaultSettings.lowMotionMode
      };
    } catch {
      return defaultSettings;
    }
  };

  const persistContentDisplaySettings = (): void => {
    localStorage.setItem(
      CONTENT_DISPLAY_STORAGE_KEY,
      JSON.stringify({
        showSpoilerContent: contentDisplaySettings.showSpoilerContent,
        mosaickedSpoilerContent: contentDisplaySettings.mosaickedSpoilerContent,
        lowMotionMode: contentDisplaySettings.lowMotionMode
      })
    );
  };

  const applyMotionPreference = (): void => {
    document.documentElement.toggleAttribute(
      "data-low-motion",
      contentDisplaySettings.lowMotionMode
    );
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

  const handleShowSpoilerContentChange = (event: Event): void => {
    contentDisplaySettings.showSpoilerContent = (event.currentTarget as HTMLInputElement).checked;
    persistContentDisplaySettings();
  };

  const handleMosaickedSpoilerContentChange = (event: Event): void => {
    contentDisplaySettings.mosaickedSpoilerContent = (
      event.currentTarget as HTMLInputElement
    ).checked;
    persistContentDisplaySettings();
  };

  const handleLowMotionModeChange = (event: Event): void => {
    contentDisplaySettings.lowMotionMode = (event.currentTarget as HTMLInputElement).checked;
    applyMotionPreference();
    persistContentDisplaySettings();
  };

  const getThemeNameLabel = (themeNameValue: ThemeName): string => {
    return themeNameLabels[themeNameValue];
  };

  const closeDropdownIfClickedOutside = (
    element: HTMLElement | null,
    target: EventTarget | null,
    close: () => void
  ): void => {
    if (target instanceof Node && element?.contains(target)) {
      return;
    }

    close();
  };

  const closeOpenMenus = (focusTrigger = false): boolean => {
    if (isMobileSettingsMenuOpen) {
      isMobileSettingsMenuOpen = false;
      if (focusTrigger) {
        mobileSettingsButton?.focus();
      }
      return true;
    }

    if (isDesktopSettingsMenuOpen) {
      isDesktopSettingsMenuOpen = false;
      if (focusTrigger) {
        desktopSettingsButton?.focus();
      }
      return true;
    }

    if (isDesktopThemeMenuOpen) {
      isDesktopThemeMenuOpen = false;
      if (focusTrigger) {
        desktopThemeButton?.focus();
      }
      return true;
    }

    if (isLocaleMenuOpen) {
      isLocaleMenuOpen = false;
      if (focusTrigger) {
        localeButton?.focus();
      }
      return true;
    }

    return false;
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

    if (contentDisplaySettings.lowMotionMode) {
      window.scrollTo({ top: 0 });
      updateBackToTopVisibility();
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
    const documentWithViewTransition = document as Document & {
      startViewTransition?: (updateCallback: () => Promise<void> | void) => unknown;
    };
    const supportsViewTransition =
      typeof documentWithViewTransition.startViewTransition === "function";
    useFallbackRouteTransition = !supportsViewTransition;

    const maybeDisposeNavigationTransition = supportsViewTransition
      ? onNavigate((navigation) => {
          if (
            contentDisplaySettings.lowMotionMode ||
            !documentWithViewTransition.startViewTransition
          ) {
            return;
          }

          return new Promise<void>((resolve) => {
            documentWithViewTransition.startViewTransition(async () => {
              resolve();
              await navigation.complete;
            });
          });
        })
      : undefined;

    const disposeNavigationTransition =
      typeof maybeDisposeNavigationTransition === "function"
        ? maybeDisposeNavigationTransition
        : () => {};

    systemThemeMediaQuery.addEventListener("change", handleSystemThemeChange);
    applyTheme(resolvePreferredThemeName(), resolvePreferredTheme());
    const preferredContentDisplaySettings = resolvePreferredContentDisplaySettings();
    contentDisplaySettings.showSpoilerContent = preferredContentDisplaySettings.showSpoilerContent;
    contentDisplaySettings.mosaickedSpoilerContent =
      preferredContentDisplaySettings.mosaickedSpoilerContent;
    contentDisplaySettings.lowMotionMode = preferredContentDisplaySettings.lowMotionMode;
    applyMotionPreference();
    persistContentDisplaySettings();
    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

    const handleDocumentClick = (event: MouseEvent): void => {
      const target = event.target;
      if (isMobileSettingsMenuOpen) {
        closeDropdownIfClickedOutside(mobileSettingsMenu, target, () => {
          isMobileSettingsMenuOpen = false;
        });
      }
      if (isDesktopSettingsMenuOpen) {
        closeDropdownIfClickedOutside(desktopSettingsMenu, target, () => {
          isDesktopSettingsMenuOpen = false;
        });
      }
      if (isDesktopThemeMenuOpen) {
        closeDropdownIfClickedOutside(desktopThemeMenu, target, () => {
          isDesktopThemeMenuOpen = false;
        });
      }
      if (isLocaleMenuOpen) {
        closeDropdownIfClickedOutside(localeMenu, target, () => {
          isLocaleMenuOpen = false;
        });
      }
    };

    const handleDocumentKeydown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape") {
        return;
      }

      if (closeOpenMenus(true)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("keydown", handleDocumentKeydown);

    return () => {
      stopLocaleProgressTimers();
      if (backToTopAnimationFrame) {
        window.cancelAnimationFrame(backToTopAnimationFrame);
        backToTopAnimationFrame = 0;
      }
      disposeNavigationTransition();
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeydown);
      window.removeEventListener("scroll", updateBackToTopVisibility);
      systemThemeMediaQuery?.removeEventListener("change", handleSystemThemeChange);
    };
  });
</script>

<svelte:head>
  <title>Sekai Viewer</title>
  <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
</svelte:head>

{#if $isLocaleLoading || localeLoadingProgress > 0}
  <div class="pointer-events-none fixed inset-x-0 top-2 z-240 flex justify-center px-4">
    <div
      class="w-full max-w-xs rounded-xl border border-base-content/20 bg-base-100/92 px-3 py-2 shadow-lg backdrop-blur-md"
      role="status"
      aria-live="polite"
    >
      <div class="mb-1 flex items-center justify-between gap-2 text-xs font-semibold">
        <span class="inline-flex items-center gap-1.5">
          <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
          <span>{loadingLanguagePackLabel}</span>
        </span>
        <span>{localeLoadingProgress}%</span>
      </div>
      <progress
        class="progress progress-primary h-1.5 w-full"
        max="100"
        value={localeLoadingProgress}
        aria-label={loadingLanguagePackLabel}
      ></progress>
    </div>
  </div>
{/if}

{#snippet contentDisplaySection()}
  <div class="flex flex-col gap-2">
    <span class="px-1 text-xs font-semibold opacity-70">
      {contentDisplayLabel}
    </span>
    <label
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-base-content/12 bg-base-100/65 px-3 py-2"
    >
      <span class="min-w-0 whitespace-normal wrap-break-word text-sm/snug font-medium"
        >{showSpoilerContentLabel}</span
      >
      <input
        type="checkbox"
        class="toggle toggle-primary shrink-0"
        checked={contentDisplaySettings.showSpoilerContent}
        onchange={handleShowSpoilerContentChange}
        aria-label={showSpoilerContentLabel}
      />
    </label>
    {#if contentDisplaySettings.showSpoilerContent}
      <label
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-base-content/12 bg-base-100/65 px-3 py-2"
      >
        <span class="min-w-0 whitespace-normal wrap-break-word text-sm/snug font-medium"
          >{mosaickedSpoilerContentLabel}</span
        >
        <input
          type="checkbox"
          class="toggle toggle-primary shrink-0"
          checked={contentDisplaySettings.mosaickedSpoilerContent}
          onchange={handleMosaickedSpoilerContentChange}
          aria-label={mosaickedSpoilerContentLabel}
        />
      </label>
    {/if}
    <label
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-base-content/12 bg-base-100/65 px-3 py-2"
    >
      <span class="min-w-0 whitespace-normal wrap-break-word text-sm/snug font-medium"
        >{lowMotionModeLabel}</span
      >
      <input
        type="checkbox"
        class="toggle toggle-primary shrink-0"
        checked={contentDisplaySettings.lowMotionMode}
        onchange={handleLowMotionModeChange}
        aria-label={lowMotionModeLabel}
      />
    </label>
  </div>
{/snippet}

{#snippet themePalettePreview(themeNameOption: ThemeName)}
  <span
    class="theme-palette-preview size-4 shrink-0 rounded-full border border-base-content/15 bg-primary"
    class:dark={resolvedTheme === "dark"}
    data-theme={themeNameOption}
    aria-hidden="true"
  ></span>
{/snippet}

<ViewerShell
  drawerId="content-site-drawer"
  navTitle="Sekai Viewer"
  {openSidebarLabel}
  {closeSidebarLabel}
  {sidebarLabel}
  {sidebarItems}
  showTitle={showPageTitle}
>
  {#snippet navActions()}
    <div class="hidden items-center gap-2 sm:flex">
      <div
        class="dropdown dropdown-end"
        class:dropdown-open={isDesktopSettingsMenuOpen}
        bind:this={desktopSettingsMenu}
      >
        <button
          bind:this={desktopSettingsButton}
          type="button"
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100"
          aria-label={settingsLabel}
          aria-haspopup="dialog"
          aria-expanded={isDesktopSettingsMenuOpen}
          aria-controls={DESKTOP_SETTINGS_MENU_ID}
          title={settingsLabel}
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
            aria-label={settingsLabel}
            class="dropdown-content z-120 mt-3 w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-box border border-base-content/15 bg-base-100/96 p-3 shadow-xl"
          >
            {@render contentDisplaySection()}
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
          aria-label={switchThemeAriaLabel}
          aria-haspopup="true"
          aria-expanded={isDesktopThemeMenuOpen}
          aria-controls={DESKTOP_THEME_MENU_ID}
          title={getThemeButtonTitle()}
          onclick={() => {
            isDesktopThemeMenuOpen = !isDesktopThemeMenuOpen;
          }}
        >
          <Icon icon="mdi:palette-outline" class="size-4" aria-hidden="true" />
        </button>
        {#if isDesktopThemeMenuOpen}
          <ul
            id={DESKTOP_THEME_MENU_ID}
            class="menu dropdown-content z-120 mt-3 min-w-max rounded-box border border-base-content/15 bg-base-100/96 p-1 shadow-xl"
          >
            <li class="menu-title px-2 py-1 text-xs font-semibold opacity-60">
              {themePaletteLabel}
            </li>
            {#each themeNameOptions as themeNameOption (themeNameOption)}
              <li>
                <button
                  type="button"
                  class={themeName === themeNameOption ? "menu-active font-semibold" : ""}
                  onclick={() => {
                    applyTheme(themeNameOption, themeMode);
                    isDesktopThemeMenuOpen = false;
                  }}
                >
                  {@render themePalettePreview(themeNameOption)}
                  <span>{getThemeNameLabel(themeNameOption)}</span>
                  {#if themeName === themeNameOption}
                    <Icon icon="mdi:check" class="size-4 opacity-80" aria-hidden="true" />
                  {/if}
                </button>
              </li>
            {/each}

            <li class="menu-title mt-2 px-2 py-1 text-xs font-semibold opacity-60">
              {themeControlLabel}
            </li>
            {#each ["auto", "light", "dark"] as themeOption (themeOption)}
              <li>
                <button
                  type="button"
                  class={themeMode === themeOption ? "menu-active font-semibold" : ""}
                  onclick={() => {
                    applyTheme(themeName, themeOption as ThemeMode);
                    isDesktopThemeMenuOpen = false;
                  }}
                >
                  <Icon
                    icon={getThemeModeIcon(themeOption as ThemeMode)}
                    class="size-4 opacity-80"
                    aria-hidden="true"
                  />
                  <span>{getThemeModeLabel(uiLocale, themeOption as ThemeMode)}</span>
                  {#if themeMode === themeOption}
                    <Icon icon="mdi:check" class="size-4 opacity-80" aria-hidden="true" />
                  {/if}
                </button>
              </li>
            {/each}
          </ul>
        {/if}
      </div>

      <div
        class="dropdown dropdown-end"
        class:dropdown-open={isLocaleMenuOpen}
        bind:this={localeMenu}
      >
        <button
          bind:this={localeButton}
          type="button"
          class="btn btn-circle btn-sm btn-outline border-base-content/20 bg-base-100/65 shadow-sm hover:bg-base-100 disabled:opacity-75"
          aria-label={`${switchUiLanguageCurrentLabel}: ${uiLocale}`}
          aria-haspopup="true"
          aria-expanded={isLocaleMenuOpen}
          aria-controls={LOCALE_MENU_ID}
          title={`${interfaceLanguageLabel}: ${uiLocaleDisplayLabel}`}
          aria-busy={$isLocaleLoading}
          disabled={$isLocaleLoading}
          onclick={() => {
            isLocaleMenuOpen = !isLocaleMenuOpen;
          }}
        >
          <Icon icon="mdi:translate" class="size-3.5 sm:size-4" aria-hidden="true" />
          {#if $isLocaleLoading}
            <span class="loading loading-spinner loading-xs" aria-hidden="true"></span>
          {/if}
        </button>
        {#if isLocaleMenuOpen}
          <div
            id={LOCALE_MENU_ID}
            class="dropdown-content z-120 mt-3 w-max min-w-44 max-w-[min(14rem,calc(100vw-2rem))] overflow-hidden rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl"
          >
            <div class="rounded-xl border border-base-content/12 bg-base-100/65 p-2">
              <p class="px-1 text-xs font-semibold opacity-60">
                {currentLanguageLabel}
              </p>
              <p class="wrap-break-word px-1 pt-1 text-sm/snug font-semibold">
                {uiLocaleDisplayLabel}
              </p>
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
                      <span class="min-w-0 wrap-break-word"
                        >{uiLocaleNameByCode[localeOption.code]}({localeOption.code})</span
                      >
                    </button>
                  </li>
                {/if}
              {/each}
            </ul>
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
          aria-label={settingsLabel}
          aria-haspopup="dialog"
          aria-expanded={isMobileSettingsMenuOpen}
          aria-controls={MOBILE_SETTINGS_MENU_ID}
          title={settingsLabel}
          onclick={() => {
            isMobileSettingsMenuOpen = !isMobileSettingsMenuOpen;
          }}
        >
          <Icon icon="mdi:tune-variant" class="size-4" aria-hidden="true" />
        </button>
        {#if isMobileSettingsMenuOpen}
          <div
            id={MOBILE_SETTINGS_MENU_ID}
            role="dialog"
            aria-label={settingsLabel}
            class="dropdown-content z-130 mt-3 w-[min(13rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl"
          >
            {@render contentDisplaySection()}

            <div class="my-2 h-px bg-base-content/12"></div>

            <div class="flex flex-col gap-1">
              <span class="px-1 text-xs font-semibold opacity-70">
                {themePaletteLabel}
              </span>
              <div class="grid grid-cols-3 gap-1">
                {#each themeNameOptions as themeNameOption (themeNameOption)}
                  <button
                    type="button"
                    class={`btn btn-sm h-auto min-h-12! flex-col justify-center gap-1 rounded-lg border-base-content/15 py-2 ${themeName === themeNameOption ? "btn-primary" : "bg-base-100"}`}
                    onclick={() => {
                      applyTheme(themeNameOption, themeMode);
                    }}
                  >
                    {@render themePalettePreview(themeNameOption)}
                    <span class="text-[0.6rem] font-semibold leading-none"
                      >{getThemeNameLabel(themeNameOption)}</span
                    >
                  </button>
                {/each}
              </div>
            </div>

            <div class="my-2 h-px bg-base-content/12"></div>

            <div class="flex flex-col gap-1">
              <span class="px-1 text-xs font-semibold opacity-70">
                {themeControlLabel}
              </span>
              <div class="grid grid-cols-3 gap-1">
                {#each ["auto", "light", "dark"] as themeOption (themeOption)}
                  <button
                    type="button"
                    class={`btn btn-sm h-auto min-h-12! flex-col justify-center gap-1 rounded-lg border-base-content/15 py-2 ${themeMode === themeOption ? "btn-primary" : "bg-base-100"}`}
                    onclick={() => {
                      applyTheme(themeName, themeOption as ThemeMode);
                    }}
                  >
                    <Icon
                      icon={getThemeModeIcon(themeOption as ThemeMode)}
                      class="size-5 shrink-0"
                    />
                    <span class="text-[0.6rem] font-semibold leading-none"
                      >{getThemeModeLabel(uiLocale, themeOption as ThemeMode)}</span
                    >
                  </button>
                {/each}
              </div>
            </div>

            <div class="my-2 h-px bg-base-content/12"></div>

            <div class="flex flex-col gap-1">
              <span class="px-1 text-xs font-semibold opacity-70">
                {interfaceLanguageLabel}
              </span>
              <div class="grid gap-1">
                {#each uiLocaleOptions as localeOption (localeOption.code)}
                  {#if localeOption.code === uiLocale}
                    <button
                      type="button"
                      class="btn btn-sm min-h-12! justify-start rounded-lg border-base-content/15 btn-primary"
                      disabled={true}
                    >
                      <span class="min-w-0 wrap-break-word"
                        >{uiLocaleNameByCode[localeOption.code]}({localeOption.code})</span
                      >
                    </button>
                  {/if}
                {/each}
                {#each uiLocaleOptions as localeOption (localeOption.code)}
                  {#if localeOption.code !== uiLocale}
                    <button
                      type="button"
                      class="btn btn-sm min-h-12! justify-start rounded-lg border-base-content/15 bg-base-100"
                      disabled={$isLocaleLoading}
                      onclick={async () => {
                        await setUiLocale(localeOption.code);
                        isMobileSettingsMenuOpen = true;
                      }}
                    >
                      <span class="min-w-0 wrap-break-word"
                        >{uiLocaleNameByCode[localeOption.code]}({localeOption.code})</span
                      >
                    </button>
                  {/if}
                {/each}
              </div>
              {#if $isLocaleLoading}
                <span class="px-1 text-xs opacity-70">{loadingLanguagePackLabel}</span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/snippet}

  {#if useFallbackRouteTransition && !contentDisplaySettings.lowMotionMode}
    {#key navigationTransitionKey}
      <div
        class="page-switch-shell"
        in:fade|local={{ duration: 150 }}
        out:fade|local={{ duration: 110 }}
      >
        {@render children()}
      </div>
    {/key}
  {:else}
    <div class="page-switch-shell">
      {@render children()}
    </div>
  {/if}
</ViewerShell>

{#if showBackToTop}
  <button
    type="button"
    class="fixed bottom-5 right-5 z-30 inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-content shadow-lg transition-[transform,opacity,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-xl cursor-pointer"
    aria-label={backToTopLabel}
    title={backToTopLabel}
    onclick={scrollToTop}
  >
    <Icon icon="mdi:arrow-up" class="size-5" />
  </button>
{/if}
