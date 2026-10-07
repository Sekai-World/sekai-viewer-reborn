<script lang="ts">
  import "../app.css";
  import "$lib/icons/mdi";
  import { asset, resolve } from "$app/paths";
  import { goto, invalidateAll } from "$app/navigation";
  import { page } from "$app/state";
  import Icon from "@iconify/svelte";
  import {
    setContentDisplaySettings,
    type ContentDisplaySettingsState
  } from "$lib/settings/content-display";
  import { supportedUiLocales, uiLocaleNameByCode, type SupportedUiLocale } from "$lib/i18n/config";
  import { regionLabels, supportedRegions, type SupportedRegion } from "$lib/domain/regions";
  import { getCardListViewFromSearchParams, withCardListView } from "$lib/card-list-view";
  import MobileQuickNavigation from "$lib/components/MobileQuickNavigation.svelte";
  import OnboardingDialog from "$lib/components/OnboardingDialog.svelte";
  import SiteUpdateNotice from "$lib/components/SiteUpdateNotice.svelte";
  import { GlobalNotificationBanner, ViewerShell } from "@platform/ui-shell";
  import { onMount, tick, type Snippet } from "svelte";
  import {
    createI18nTranslator,
    resolveStreamingMessages,
    requestI18nLocale,
    isLocaleLoading,
    setI18nLocale
  } from "$lib/i18n/runtime";
  import {
    DEFAULT_REGION,
    DEFAULT_UI_LOCALE,
    normalizeRegion,
    normalizeUiLocale,
    PREFERRED_REGION_CHANGE_EVENT,
    PREFERRED_REGION_STORAGE_KEY,
    persistPreferredRegion,
    resolvePreferredRegion,
    UI_LOCALE_COOKIE_NAME
  } from "$lib/i18n/region";
  import {
    setTitlePreviewLabels,
    type TitlePreviewLabels
  } from "$lib/components/shared/title-preview-labels";
  import {
    readOnboardingSeen,
    readSeenSiteVersion,
    writeOnboardingSeen,
    writeSeenSiteVersion
  } from "$lib/onboarding";
  import { getSiteUpdateForVersion, resolveSiteVersion } from "$lib/site-updates";
  import type { LayoutData } from "./$types";

  type ThemeMode = "light" | "dark" | "auto";
  type ThemeName = "default" | "sakura" | "mint";
  type ResolvedTheme = "light" | "dark";
  type UiLocaleOption = {
    code: SupportedUiLocale;
  };
  type SidebarGroupId = "library" | "activities" | "progression" | "mysekai" | "project";
  type ContentSiteSidebarItem =
    | {
        type?: "link";
        label: string;
        href?: string;
        active?: boolean;
        icon?: string;
        disabled?: boolean;
        groupId?: SidebarGroupId;
      }
    | {
        type: "section";
        label: string;
        groupId: SidebarGroupId;
      };

  const THEME_STORAGE_KEY = "content_site_theme_mode";
  const THEME_NAME_STORAGE_KEY = "content_site_theme_name";
  const CONTENT_DISPLAY_STORAGE_KEY = "content_site_content_display_settings";
  const DESKTOP_SETTINGS_MENU_ID = "content-site-desktop-settings-menu";
  const DESKTOP_THEME_MENU_ID = "content-site-desktop-theme-menu";
  const LOCALE_MENU_ID = "content-site-locale-menu";
  const MOBILE_SETTINGS_MENU_ID = "content-site-mobile-settings-menu";
  const CONTENT_SITE_DRAWER_ID = "content-site-drawer";
  const uiLocaleOptions: UiLocaleOption[] = supportedUiLocales.map((code) => ({ code }));
  const themeNameOptions: ThemeName[] = ["default", "sakura", "mint"];
  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const getInitialMessages = (): Record<string, string> =>
    resolveStreamingMessages(data.i18nMessages, ["common"]);
  let currentLayoutMessages = $state<Record<string, string>>(getInitialMessages());
  const getInitialI18nText = (key: string): string =>
    createI18nTranslator(data.uiLocale, getInitialMessages())(key);
  let uiLocale = $derived<SupportedUiLocale>(normalizeUiLocale(data.uiLocale, DEFAULT_UI_LOCALE));
  let themeName = $state<ThemeName>("default");
  let themeMode = $state<ThemeMode>("auto");
  const getInitialPreferredRegion = (): SupportedRegion => data.preferredRegion;
  let preferredRegion = $state<SupportedRegion>(getInitialPreferredRegion());
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
  let translationRequestId = 0;
  let homeLabel = $state(getInitialI18nText("home"));
  let openSidebarLabel = $state(getInitialI18nText("aria.openSidebar"));
  let closeSidebarLabel = $state(getInitialI18nText("aria.closeSidebar"));
  let skipToMainLabel = $state(getInitialI18nText("aria.skipToMainContent"));
  let sidebarLabel = $state(getInitialI18nText("navigation.sidebarTitle"));
  let libraryLabel = $state(getInitialI18nText("navigation.library"));
  let activitiesLabel = $state(getInitialI18nText("navigation.activities"));
  let progressionLabel = $state(getInitialI18nText("navigation.progression"));
  let projectLabel = $state(getInitialI18nText("navigation.project"));
  let gameNewsLabel = $state(getInitialI18nText("navigation.gameNews"));
  let charactersLabel = $state(getInitialI18nText("navigation.characters"));
  let cardsLabel = $state(getInitialI18nText("navigation.cards"));
  let songsLabel = $state(getInitialI18nText("navigation.songs"));
  let eventsLabel = $state(getInitialI18nText("navigation.events"));
  let gachasLabel = $state(getInitialI18nText("navigation.gachas"));
  let virtualLivesLabel = $state(getInitialI18nText("navigation.virtualLives"));
  let missionsLabel = $state(getInitialI18nText("navigation.missions"));
  let honorsLabel = $state(getInitialI18nText("navigation.honors"));
  let stampsLabel = $state(getInitialI18nText("navigation.stamps"));
  let mysekaiLabel = $state(getInitialI18nText("navigation.mysekai"));
  let mysekaiFixturesLabel = $state(getInitialI18nText("navigation.mysekaiFixtures"));
  let mysekaiMaterialsLabel = $state(getInitialI18nText("navigation.mysekaiMaterials"));
  let mysekaiSoundtracksLabel = $state(getInitialI18nText("navigation.mysekaiSoundtracks"));
  let mysekaiShopLabel = $state(getInitialI18nText("navigation.mysekaiShop"));
  // Any reward list can open a title preview, so the layout provides its labels.
  const titlePreviewLabelsFrom = (text: (key: string) => string): TitlePreviewLabels => ({
    dialog: text("titlePreview.dialog"),
    close: text("closeLabel"),
    loading: text("detailLoading"),
    error: text("titlePreview.error"),
    retry: text("listRetry"),
    rarity: text("rarityLabel"),
    levels: text("titlePreview.levels"),
    level: text("levelLabel"),
    condition: text("titlePreview.condition"),
    imageUnavailable: text("imageUnavailable"),
    rarities: {
      low: text("titlePreview.rarity.low"),
      middle: text("titlePreview.rarity.middle"),
      high: text("titlePreview.rarity.high"),
      highest: text("titlePreview.rarity.highest")
    }
  });
  let titlePreviewLabels = $state(titlePreviewLabelsFrom(getInitialI18nText));
  setTitlePreviewLabels(() => titlePreviewLabels);
  let supportLabel = $state(getInitialI18nText("navigation.support"));
  let quickNavigationLabel = $state(getInitialI18nText("navigation.quickNavigation"));
  let settingsLabel = $state(getInitialI18nText("settings.title"));
  let themeControlLabel = $state(getInitialI18nText("settings.appearance"));
  let themePaletteLabel = $state(getInitialI18nText("settings.theme"));
  let gameContentRegionLabel = $state(getInitialI18nText("settings.gameContentRegion"));
  let interfaceLanguageLabel = $state(getInitialI18nText("settings.interfaceLanguage"));
  let currentLanguageLabel = $state(getInitialI18nText("settings.currentLanguage"));
  let contentDisplayLabel = $state(getInitialI18nText("settings.contentDisplay"));
  let showSpoilerContentLabel = $state(getInitialI18nText("settings.showSpoilerContent"));
  let mosaickedSpoilerContentLabel = $state(getInitialI18nText("settings.mosaickedSpoilerContent"));
  let lowMotionModeLabel = $state(getInitialI18nText("settings.lowMotionMode"));
  let ongoingFirstLabel = $state(getInitialI18nText("settings.ongoingFirst"));
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
  let hasSeenOnboarding = $state(false);
  let isOnboardingDialogOpen = $state(false);
  let seenSiteVersion = $state<string | null>(null);
  let backToTopAnimationFrame = 0;
  let contentDisplaySettings = $state<ContentDisplaySettingsState>({
    showSpoilerContent: false,
    mosaickedSpoilerContent: true,
    lowMotionMode: false,
    ongoingFirst: true
  });

  setContentDisplaySettings(contentDisplaySettings);

  const sidebarRegion = $derived.by<SupportedRegion>(() => {
    const [first, second] = page.url.pathname.split("/").filter(Boolean);

    if (
      (first === "character" ||
        first === "characters" ||
        first === "unit" ||
        first === "card" ||
        first === "cards") &&
      second
    ) {
      return normalizeRegion(second, preferredRegion);
    }

    if (
      (first === "event" ||
        first === "events" ||
        first === "gacha" ||
        first === "gachas" ||
        first === "music" ||
        first === "musics" ||
        first === "missions" ||
        first === "honors" ||
        first === "stamps" ||
        first === "virtual-live" ||
        first === "virtual-lives") &&
      second
    ) {
      return normalizeRegion(second, preferredRegion);
    }

    if (first === "news" && second) {
      return normalizeRegion(second, preferredRegion);
    }

    return preferredRegion;
  });

  const getCardsNavigationHref = (): string =>
    withCardListView(
      `/cards/${sidebarRegion}`,
      getCardListViewFromSearchParams(page.url.searchParams)
    );

  type ContentSiteNavigationItem = {
    label: string;
    href: string;
    active: boolean;
    icon: string;
    groupId?: SidebarGroupId;
  };

  const navigationLinks = $derived<ContentSiteNavigationItem[]>([
    {
      label: homeLabel,
      href: "/",
      active: page.url.pathname === "/",
      icon: "mdi:home-variant-outline"
    },
    {
      label: gameNewsLabel,
      href: `/news/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/news/"),
      icon: "mdi:information-outline"
    },
    {
      label: charactersLabel,
      icon: "mdi:account-group",
      href: `/characters/${sidebarRegion}`,
      active:
        page.url.pathname.startsWith("/characters/") ||
        page.url.pathname.startsWith("/character/") ||
        page.url.pathname.startsWith("/unit/"),
      groupId: "library"
    },
    {
      label: cardsLabel,
      icon: "mdi:cards-outline",
      href: getCardsNavigationHref(),
      active: page.url.pathname.startsWith("/cards/"),
      groupId: "library"
    },
    {
      label: songsLabel,
      icon: "mdi:music-note-outline",
      href: `/musics/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/music/") || page.url.pathname.startsWith("/musics/"),
      groupId: "library"
    },
    {
      label: eventsLabel,
      href: `/events/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/events/") || page.url.pathname.startsWith("/event/"),
      icon: "mdi:calendar-star",
      groupId: "activities"
    },
    {
      label: gachasLabel,
      href: `/gachas/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/gachas/") || page.url.pathname.startsWith("/gacha/"),
      icon: "mdi:gift-outline",
      groupId: "activities"
    },
    {
      label: virtualLivesLabel,
      icon: "mdi:account-voice",
      href: `/virtual-lives/${sidebarRegion}`,
      active:
        page.url.pathname.startsWith("/virtual-lives/") ||
        page.url.pathname.startsWith("/virtual-live/"),
      groupId: "activities"
    },
    {
      label: supportLabel,
      href: resolve("/support"),
      active: page.url.pathname === resolve("/support"),
      icon: "mdi:hand-heart",
      groupId: "project"
    }
  ]);
  const sidebarItems = $derived<ContentSiteSidebarItem[]>([
    navigationLinks[0],
    navigationLinks[1],
    {
      type: "section",
      label: libraryLabel,
      groupId: "library"
    },
    navigationLinks[2],
    navigationLinks[3],
    navigationLinks[4],
    {
      type: "section",
      label: activitiesLabel,
      groupId: "activities"
    },
    navigationLinks[5],
    navigationLinks[6],
    navigationLinks[7],
    {
      type: "section",
      label: progressionLabel,
      groupId: "progression"
    },
    {
      label: missionsLabel,
      href: `/missions/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/missions/"),
      icon: "mdi:playlist-check",
      groupId: "progression"
    },
    {
      label: honorsLabel,
      href: `/honors/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/honors/"),
      icon: "mdi:medal-outline",
      groupId: "progression"
    },
    {
      label: stampsLabel,
      href: `/stamps/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/stamps/"),
      icon: "mdi:sticker-emoji",
      groupId: "progression"
    },
    {
      type: "section",
      label: mysekaiLabel,
      groupId: "mysekai"
    },
    {
      label: mysekaiFixturesLabel,
      href: `/mysekai/fixtures/${sidebarRegion}`,
      active:
        page.url.pathname.startsWith("/mysekai/fixtures/") ||
        page.url.pathname.startsWith("/mysekai/fixture/"),
      icon: "mdi:sofa-outline",
      groupId: "mysekai"
    },
    {
      label: mysekaiMaterialsLabel,
      href: `/mysekai/materials/${sidebarRegion}`,
      active:
        page.url.pathname.startsWith("/mysekai/materials/") ||
        page.url.pathname.startsWith("/mysekai/material/"),
      icon: "mdi:pine-tree-variant-outline",
      groupId: "mysekai"
    },
    {
      label: mysekaiSoundtracksLabel,
      href: `/mysekai/soundtracks/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/mysekai/soundtracks/"),
      icon: "mdi:album",
      groupId: "mysekai"
    },
    {
      label: mysekaiShopLabel,
      href: `/mysekai/shop/${sidebarRegion}`,
      active: page.url.pathname.startsWith("/mysekai/shop/"),
      icon: "mdi:storefront-outline",
      groupId: "mysekai"
    },
    {
      type: "section",
      label: projectLabel,
      groupId: "project"
    },
    navigationLinks[navigationLinks.length - 1]
  ]);
  const quickNavigationItems = $derived<ContentSiteNavigationItem[]>([
    navigationLinks[0],
    navigationLinks[1],
    navigationLinks[3],
    navigationLinks[4],
    navigationLinks[5],
    navigationLinks[6]
  ]);
  const showPageTitle = $derived(page.url.pathname === "/");
  const isHomeRoute = $derived(page.url.pathname === resolve("/"));
  const layoutTranslate = $derived(createI18nTranslator(uiLocale, currentLayoutMessages));
  const siteVersion = $derived(resolveSiteVersion(data.siteVersion));
  const activeSiteUpdate = $derived(getSiteUpdateForVersion(siteVersion));
  const showSiteUpdateNotice = $derived(
    hasSeenOnboarding && !isOnboardingDialogOpen && seenSiteVersion !== siteVersion
  );
  const themeModeLabel = $derived(layoutTranslate(`themeMode.${themeMode}`, themeMode));
  const resolvedThemeLabel = $derived(layoutTranslate(`themeMode.${resolvedTheme}`, resolvedTheme));
  const uiLocaleDisplayLabel = $derived(`${uiLocaleNameByCode[uiLocale]}(${uiLocale})`);
  const onboardingSteps = $derived([
    ...(isHomeRoute
      ? [
          {
            icon: "mdi:calendar-star",
            target: "home-current-events",
            title: layoutTranslate("onboarding.steps.home.currentEvents.title"),
            description: layoutTranslate("onboarding.steps.home.currentEvents.description")
          },
          {
            icon: "mdi:clock-outline",
            target: "home-latest-data",
            title: layoutTranslate("onboarding.steps.home.latestData.title"),
            description: layoutTranslate("onboarding.steps.home.latestData.description")
          },
          {
            icon: "mdi:information-outline",
            target: "home-game-news",
            title: layoutTranslate("onboarding.steps.home.gameNews.title"),
            description: layoutTranslate("onboarding.steps.home.gameNews.description")
          },
          {
            icon: "mdi:view-grid-outline",
            target: "home-catalogue-directory",
            title: layoutTranslate("onboarding.steps.home.catalogueDirectory.title"),
            description: layoutTranslate("onboarding.steps.home.catalogueDirectory.description")
          }
        ]
      : [
          {
            icon: "mdi:home-variant-outline",
            target: "home-entry",
            title: layoutTranslate("onboarding.steps.home.entryTitle"),
            description: layoutTranslate("onboarding.steps.home.entryDescription")
          }
        ]),
    {
      icon: "mdi:cards-outline",
      target: "sidebar-library",
      title: layoutTranslate("onboarding.steps.sidebar.library.title"),
      description: layoutTranslate("onboarding.steps.sidebar.library.description")
    },
    {
      icon: "mdi:calendar-star",
      target: "sidebar-activities",
      title: layoutTranslate("onboarding.steps.sidebar.activities.title"),
      description: layoutTranslate("onboarding.steps.sidebar.activities.description")
    },
    {
      icon: "mdi:playlist-check",
      target: "sidebar-progression",
      title: layoutTranslate("onboarding.steps.sidebar.progression.title"),
      description: layoutTranslate("onboarding.steps.sidebar.progression.description")
    },
    {
      icon: "mdi:map-search-outline",
      target: "sidebar-mysekai",
      title: layoutTranslate("onboarding.steps.sidebar.mysekai.title"),
      description: layoutTranslate("onboarding.steps.sidebar.mysekai.description")
    },
    {
      icon: "mdi:hand-heart",
      target: "sidebar-project",
      title: layoutTranslate("onboarding.steps.sidebar.project.title"),
      description: layoutTranslate("onboarding.steps.sidebar.project.description")
    },
    {
      icon: "mdi:cog-outline",
      target: "settings",
      title: layoutTranslate("onboarding.steps.settings.title"),
      description: layoutTranslate("onboarding.steps.settings.description")
    },
    {
      icon: "mdi:earth",
      target: "region",
      title: layoutTranslate("onboarding.steps.region.title"),
      description: layoutTranslate("onboarding.steps.region.description")
    },
    {
      icon: "mdi:palette-outline",
      target: "theme",
      title: layoutTranslate("onboarding.steps.theme.title"),
      description: layoutTranslate("onboarding.steps.theme.description")
    },
    {
      icon: "mdi:translate",
      target: "language",
      title: layoutTranslate("onboarding.steps.language.title"),
      description: layoutTranslate("onboarding.steps.language.description")
    }
  ]);

  $effect(() => {
    const requestId = ++translationRequestId;
    const messagesOrPromise = data.i18nMessages;
    const localeRequestToken = requestI18nLocale();
    void refreshTranslations(uiLocale, messagesOrPromise, requestId, localeRequestToken);
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
    skipToMainLabel = translate("aria.skipToMainContent");
    sidebarLabel = translate("navigation.sidebarTitle");
    libraryLabel = translate("navigation.library");
    activitiesLabel = translate("navigation.activities");
    progressionLabel = translate("navigation.progression");
    projectLabel = translate("navigation.project");
    gameNewsLabel = translate("navigation.gameNews");
    charactersLabel = translate("navigation.characters");
    cardsLabel = translate("navigation.cards");
    songsLabel = translate("navigation.songs");
    eventsLabel = translate("navigation.events");
    gachasLabel = translate("navigation.gachas");
    virtualLivesLabel = translate("navigation.virtualLives");
    missionsLabel = translate("navigation.missions");
    honorsLabel = translate("navigation.honors");
    stampsLabel = translate("navigation.stamps");
    mysekaiLabel = translate("navigation.mysekai");
    mysekaiFixturesLabel = translate("navigation.mysekaiFixtures");
    mysekaiMaterialsLabel = translate("navigation.mysekaiMaterials");
    mysekaiSoundtracksLabel = translate("navigation.mysekaiSoundtracks");
    mysekaiShopLabel = translate("navigation.mysekaiShop");
    titlePreviewLabels = titlePreviewLabelsFrom(translate);
    supportLabel = translate("navigation.support");
    quickNavigationLabel = translate("navigation.quickNavigation");
    settingsLabel = translate("settings.title");
    themeControlLabel = translate("settings.appearance");
    themePaletteLabel = translate("settings.theme");
    gameContentRegionLabel = translate("settings.gameContentRegion");
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

  const refreshTranslations = async (
    localeValue: string,
    messagesOrPromise: typeof data.i18nMessages,
    requestId: number,
    localeRequestToken: ReturnType<typeof requestI18nLocale>
  ): Promise<void> => {
    let messages: Record<string, string>;
    try {
      messages = await messagesOrPromise;
    } catch {
      return;
    }
    if (requestId !== translationRequestId) return;
    const resolvedLocale = await setI18nLocale(localeValue, messages, localeRequestToken);
    if (requestId !== translationRequestId) return;
    currentLayoutMessages = messages;
    applyTranslations(createI18nTranslator(resolvedLocale, messages));
  };

  const getSystemTheme = (): ResolvedTheme =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

  const resolveThemeMode = (themeModeValue: ThemeMode): ResolvedTheme =>
    themeModeValue === "auto" ? getSystemTheme() : themeModeValue;

  const applyTheme = (nextThemeName: ThemeName, nextThemeMode: ThemeMode): void => {
    const nextResolvedTheme = resolveThemeMode(nextThemeMode);
    document.documentElement.setAttribute("data-theme", nextThemeName);
    document.documentElement.classList.toggle("dark", nextResolvedTheme === "dark");
    persistThemePreferences(nextThemeName, nextThemeMode);
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
    const storedTheme = readThemePreference(THEME_STORAGE_KEY);
    if (storedTheme === "light" || storedTheme === "dark" || storedTheme === "auto") {
      return storedTheme;
    }

    return "auto";
  };

  const resolvePreferredThemeName = (): ThemeName => {
    const storedThemeName = readThemePreference(THEME_NAME_STORAGE_KEY);
    if (
      storedThemeName === "default" ||
      storedThemeName === "sakura" ||
      storedThemeName === "mint"
    ) {
      return storedThemeName;
    }

    return "default";
  };

  const readThemePreference = (storageKey: string): string | null => {
    try {
      return localStorage.getItem(storageKey);
    } catch {
      return null;
    }
  };

  const persistThemePreferences = (nextThemeName: ThemeName, nextThemeMode: ThemeMode): void => {
    try {
      localStorage.setItem(THEME_NAME_STORAGE_KEY, nextThemeName);
      localStorage.setItem(THEME_STORAGE_KEY, nextThemeMode);
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
  };

  const resolvePreferredContentDisplaySettings = (): ContentDisplaySettingsState => {
    const defaultSettings: ContentDisplaySettingsState = {
      showSpoilerContent: false,
      mosaickedSpoilerContent: true,
      lowMotionMode:
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ongoingFirst: true
    };
    let storedSettings: string | null;
    try {
      storedSettings = localStorage.getItem(CONTENT_DISPLAY_STORAGE_KEY);
    } catch {
      return defaultSettings;
    }

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
            : defaultSettings.lowMotionMode,
        ongoingFirst:
          typeof parsed.ongoingFirst === "boolean"
            ? parsed.ongoingFirst
            : defaultSettings.ongoingFirst
      };
    } catch {
      return defaultSettings;
    }
  };

  const persistContentDisplaySettings = (): void => {
    try {
      localStorage.setItem(
        CONTENT_DISPLAY_STORAGE_KEY,
        JSON.stringify({
          showSpoilerContent: contentDisplaySettings.showSpoilerContent,
          mosaickedSpoilerContent: contentDisplaySettings.mosaickedSpoilerContent,
          lowMotionMode: contentDisplaySettings.lowMotionMode,
          ongoingFirst: contentDisplaySettings.ongoingFirst
        })
      );
    } catch {
      // Storage can be unavailable in privacy-restricted browsing contexts.
    }
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

  const handleOngoingFirstChange = (event: Event): void => {
    contentDisplaySettings.ongoingFirst = (event.currentTarget as HTMLInputElement).checked;
    persistContentDisplaySettings();
  };

  const setPreferredRegion = (region: SupportedRegion): void => {
    try {
      persistPreferredRegion(region);
    } catch {
      preferredRegion = normalizeRegion(region, DEFAULT_REGION);
    }
  };

  const closeSettingsMenus = (): void => {
    isDesktopSettingsMenuOpen = false;
    isDesktopThemeMenuOpen = false;
    isMobileSettingsMenuOpen = false;
    isLocaleMenuOpen = false;
  };

  const openOnboarding = (): void => {
    closeSettingsMenus();
    isOnboardingDialogOpen = true;
  };

  let onboardingSession: {
    drawerOpen: boolean;
    scrollX: number;
    scrollY: number;
    drawerScrollTop: number;
  } | null = null;
  let onboardingPreparation = 0;

  const getOnboardingDrawer = (): HTMLInputElement | null =>
    document.getElementById(CONTENT_SITE_DRAWER_ID) as HTMLInputElement | null;

  const setOnboardingDrawer = (checked: boolean): void => {
    const drawer = getOnboardingDrawer();
    if (!drawer || drawer.checked === checked) return;
    drawer.checked = checked;
    drawer.dispatchEvent(new Event("change", { bubbles: true }));
  };

  const isOnboardingTargetVisible = (target: HTMLElement): boolean => {
    const rect = target.getBoundingClientRect();
    const style = getComputedStyle(target);
    return (
      target.getClientRects().length > 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth &&
      style.visibility !== "hidden" &&
      style.display !== "none"
    );
  };

  const getOnboardingSidebarGroupId = (target: string): SidebarGroupId | null => {
    const groupId = target.startsWith("sidebar-") ? target.slice("sidebar-".length) : "";
    return ["library", "activities", "progression", "mysekai", "project"].includes(groupId)
      ? (groupId as SidebarGroupId)
      : null;
  };

  // Resolve shared shell targets by its stable panel ID and real group markers.
  // No translated labels, DOM indexes, or temporary mutations are needed.
  const resolveOnboardingTarget = (target: string): HTMLElement | readonly HTMLElement[] | null => {
    if (target === "home-entry") {
      const panel = document.getElementById(`${CONTENT_SITE_DRAWER_ID}-panel`);
      return (
        [...(panel?.querySelectorAll<HTMLElement>("a[href]") ?? [])].find(
          (link) => link.getAttribute("href") === resolve("/") && isOnboardingTargetVisible(link)
        ) ?? null
      );
    }

    const groupId = getOnboardingSidebarGroupId(target);
    if (groupId) {
      const panel = document.getElementById(`${CONTENT_SITE_DRAWER_ID}-panel`);
      const groupTargets = [
        ...(panel?.querySelectorAll<HTMLElement>(`[data-sidebar-group="${groupId}"]`) ?? [])
      ];
      return groupTargets.length > 0 ? groupTargets : null;
    }

    return (
      [...document.querySelectorAll<HTMLElement>(`[data-onboarding-target="${target}"]`)].find(
        isOnboardingTargetVisible
      ) ?? null
    );
  };

  const cleanupOnboarding = (): void => {
    onboardingPreparation += 1;
    const session = onboardingSession;
    onboardingSession = null;
    if (!session) return;
    setOnboardingDrawer(session.drawerOpen);
    const drawerScroller = document.getElementById(
      `${CONTENT_SITE_DRAWER_ID}-panel`
    )?.parentElement;
    if (drawerScroller) drawerScroller.scrollTop = session.drawerScrollTop;
    window.scrollTo({ left: session.scrollX, top: session.scrollY, behavior: "instant" });
  };

  // Tour-owned menus and drawer never change saved preferences or navigate.
  const prepareOnboardingStep = async (stepIndex: number): Promise<void> => {
    if (!isOnboardingDialogOpen) return;
    const preparation = ++onboardingPreparation;
    const panel = document.getElementById(`${CONTENT_SITE_DRAWER_ID}-panel`);
    onboardingSession ??= {
      drawerOpen: getOnboardingDrawer()?.checked ?? false,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
      drawerScrollTop: panel?.parentElement?.scrollTop ?? 0
    };
    const targetName = onboardingSteps[stepIndex]?.target;
    closeSettingsMenus();
    const rail = window.matchMedia("(min-width: 1280px)").matches;
    const mobile = window.matchMedia("(max-width: 639px)").matches;
    const needsDrawer =
      getOnboardingSidebarGroupId(targetName ?? "") !== null ||
      (targetName === "home-entry" && !rail);
    if (!rail) setOnboardingDrawer(needsDrawer);
    if (targetName === "region" || targetName === "theme" || targetName === "language") {
      if (mobile) isMobileSettingsMenuOpen = true;
      else if (targetName === "region") isDesktopSettingsMenuOpen = true;
      else if (targetName === "theme") isDesktopThemeMenuOpen = true;
      else isLocaleMenuOpen = true;
    }
    await tick();
    // Measure the final drawer position, not its off-screen transition frame.
    if (needsDrawer && !rail && panel) {
      await Promise.allSettled(panel.getAnimations().map((animation) => animation.finished));
    }
    if (!isOnboardingDialogOpen || preparation !== onboardingPreparation) return;
    if (targetName?.startsWith("home-")) {
      const home = document.querySelector<HTMLElement>(`[data-onboarding-target="${targetName}"]`);
      const rect = home?.getBoundingClientRect();
      if (
        home &&
        rect &&
        (rect.top < 100 || rect.bottom > window.innerHeight - 100) &&
        typeof home.scrollIntoView === "function"
      ) {
        home.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
    const groupId = getOnboardingSidebarGroupId(targetName ?? "");
    if (needsDrawer && groupId && panel) {
      const groupTargets = [
        ...panel.querySelectorAll<HTMLElement>(`[data-sidebar-group="${groupId}"]`)
      ];
      const scroller = panel.parentElement;
      if (groupTargets.length > 0 && scroller) {
        const scrollerRect = scroller.getBoundingClientRect();
        const firstTop = Math.min(...groupTargets.map((item) => item.getBoundingClientRect().top));
        const lastBottom = Math.max(
          ...groupTargets.map((item) => item.getBoundingClientRect().bottom)
        );
        const groupHeight = lastBottom - firstTop;
        const viewportHeight = scroller.clientHeight || scrollerRect.height;
        const groupFits = groupHeight <= viewportHeight - 32;
        const targetTop = scrollerRect.top + 16;
        const targetBottom = scrollerRect.bottom - 16;
        if (groupFits && firstTop < targetTop) {
          scroller.scrollTop += firstTop - targetTop;
        } else if (groupFits && lastBottom > targetBottom) {
          scroller.scrollTop += lastBottom - targetBottom;
        } else if (!groupFits && firstTop < targetTop) {
          scroller.scrollTop += firstTop - targetTop;
        }
      }
    }
    if (
      mobile &&
      (targetName === "region" || targetName === "theme" || targetName === "language")
    ) {
      const menu = document.getElementById(MOBILE_SETTINGS_MENU_ID);
      const target = menu?.querySelector<HTMLElement>(`[data-onboarding-target="${targetName}"]`);
      if (target && menu) {
        const menuRect = menu.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        menu.scrollTop += targetRect.top - menuRect.top - 12;
      }
    }
  };

  const restoreOnboardingFocus = (): void => {
    void tick().then(() => {
      const mobile = window.matchMedia("(max-width: 639px)").matches;
      (mobile ? mobileSettingsButton : desktopSettingsButton)?.focus({ preventScroll: true });
    });
  };

  const markCurrentSiteVersionSeen = (): void => {
    writeSeenSiteVersion(siteVersion);
    seenSiteVersion = siteVersion;
  };

  const handleOnboardingDismiss = (): void => {
    writeOnboardingSeen();
    hasSeenOnboarding = true;
    isOnboardingDialogOpen = false;
    closeSettingsMenus();
    cleanupOnboarding();
    restoreOnboardingFocus();
  };

  const handleSettingsUpdatesClick = (): void => {
    closeSettingsMenus();
    markCurrentSiteVersionSeen();
  };

  const navigateToUpdates = (): void => {
    handleSettingsUpdatesClick();
    void goto(resolve("/updates"));
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
    hasSeenOnboarding = readOnboardingSeen();
    seenSiteVersion = readSeenSiteVersion();
    isOnboardingDialogOpen = !hasSeenOnboarding;

    systemThemeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemThemeMediaQuery.addEventListener("change", handleSystemThemeChange);
    const preferredThemeName = resolvePreferredThemeName();
    const preferredThemeMode = resolvePreferredTheme();
    const preferredResolvedTheme = resolveThemeMode(preferredThemeMode);
    document.documentElement.setAttribute("data-theme", preferredThemeName);
    document.documentElement.classList.toggle("dark", preferredResolvedTheme === "dark");
    themeName = preferredThemeName;
    themeMode = preferredThemeMode;
    resolvedTheme = preferredResolvedTheme;
    try {
      preferredRegion = resolvePreferredRegion();
    } catch {
      preferredRegion = DEFAULT_REGION;
    }
    const preferredContentDisplaySettings = resolvePreferredContentDisplaySettings();
    contentDisplaySettings.showSpoilerContent = preferredContentDisplaySettings.showSpoilerContent;
    contentDisplaySettings.mosaickedSpoilerContent =
      preferredContentDisplaySettings.mosaickedSpoilerContent;
    contentDisplaySettings.lowMotionMode = preferredContentDisplaySettings.lowMotionMode;
    contentDisplaySettings.ongoingFirst = preferredContentDisplaySettings.ongoingFirst;
    applyMotionPreference();
    persistContentDisplaySettings();
    updateBackToTopVisibility();
    window.addEventListener("scroll", updateBackToTopVisibility, { passive: true });

    const handlePreferredRegionChange = (event: Event): void => {
      preferredRegion = normalizeRegion(
        (event as CustomEvent<SupportedRegion>).detail,
        DEFAULT_REGION
      );
    };
    const handlePreferredRegionStorageChange = (event: StorageEvent): void => {
      if (event.key === PREFERRED_REGION_STORAGE_KEY) {
        preferredRegion = normalizeRegion(event.newValue, DEFAULT_REGION);
      }
    };
    window.addEventListener(PREFERRED_REGION_CHANGE_EVENT, handlePreferredRegionChange);
    window.addEventListener("storage", handlePreferredRegionStorageChange);

    const handleDocumentClick = (event: MouseEvent): void => {
      if (isOnboardingDialogOpen) return;
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
      if (isOnboardingDialogOpen) return;
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
      cleanupOnboarding();
      stopLocaleProgressTimers();
      if (backToTopAnimationFrame) {
        window.cancelAnimationFrame(backToTopAnimationFrame);
        backToTopAnimationFrame = 0;
      }
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("keydown", handleDocumentKeydown);
      window.removeEventListener("scroll", updateBackToTopVisibility);
      window.removeEventListener(PREFERRED_REGION_CHANGE_EVENT, handlePreferredRegionChange);
      window.removeEventListener("storage", handlePreferredRegionStorageChange);
      systemThemeMediaQuery?.removeEventListener("change", handleSystemThemeChange);
    };
  });
</script>

<svelte:head>
  <title>Sekai Viewer</title>
  <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
</svelte:head>

<GlobalNotificationBanner
  notices={data.globalNotices}
  externalLinkLabel={layoutTranslate("notification.opensInNewWindow")}
/>

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

{#snippet regionSelectorSection()}
  <div class="flex flex-col gap-2" data-onboarding-target="region">
    <span class="px-1 text-xs font-semibold opacity-70">{gameContentRegionLabel}</span>
    <div class="flex flex-wrap gap-1">
      {#each supportedRegions as regionOption (regionOption)}
        <button
          type="button"
          class={`btn btn-sm min-h-11! rounded-lg border-base-content/15 px-3 ${preferredRegion === regionOption ? "btn-primary" : "bg-base-100"}`}
          aria-pressed={preferredRegion === regionOption}
          onclick={() => setPreferredRegion(regionOption)}
        >
          <span>{regionLabels[regionOption]}</span>
        </button>
      {/each}
    </div>
  </div>
{/snippet}

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
    <label
      class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-base-content/12 bg-base-100/65 px-3 py-2"
    >
      <span class="min-w-0 whitespace-normal wrap-break-word text-sm/snug font-medium"
        >{ongoingFirstLabel}</span
      >
      <input
        type="checkbox"
        class="toggle toggle-primary shrink-0"
        checked={contentDisplaySettings.ongoingFirst}
        onchange={handleOngoingFirstChange}
        aria-label={ongoingFirstLabel}
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

{#if isDesktopSettingsMenuOpen || isDesktopThemeMenuOpen || isLocaleMenuOpen || isMobileSettingsMenuOpen}
  <div
    class="fixed inset-0 z-30"
    aria-hidden="true"
    onclick={(event) => {
      event.stopPropagation();
      isDesktopSettingsMenuOpen = false;
      isDesktopThemeMenuOpen = false;
      isLocaleMenuOpen = false;
      isMobileSettingsMenuOpen = false;
    }}
  ></div>
{/if}

<ViewerShell
  drawerId={CONTENT_SITE_DRAWER_ID}
  navTitle="Sekai Viewer"
  siteVersion={data.siteVersion}
  desktopRailOpen={true}
  {openSidebarLabel}
  {closeSidebarLabel}
  {skipToMainLabel}
  {sidebarLabel}
  {sidebarItems}
  showTitle={showPageTitle}
>
  {#snippet bottomNavigation()}
    <MobileQuickNavigation items={quickNavigationItems} navigationLabel={quickNavigationLabel} />
  {/snippet}

  {#snippet navActions()}
    <div class="relative z-120 hidden items-center gap-2 sm:flex">
      <div
        class="dropdown dropdown-end"
        class:dropdown-open={isDesktopSettingsMenuOpen}
        bind:this={desktopSettingsMenu}
      >
        <button
          bind:this={desktopSettingsButton}
          data-onboarding-target="settings"
          type="button"
          class="btn btn-circle btn-sm touch-target btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100"
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
            class="dropdown-content z-120 mt-3 w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)] overflow-hidden rounded-box border border-base-content/15 bg-(--archive-surface-overlay) p-3 shadow-md"
          >
            {@render regionSelectorSection()}

            <div class="my-2 h-px bg-base-content/12"></div>

            {@render contentDisplaySection()}

            <div class="my-2 h-px bg-base-content/12"></div>

            <div class="flex flex-col gap-1">
              <a
                class="btn btn-ghost min-h-11 justify-start gap-2"
                href={resolve("/updates")}
                onclick={handleSettingsUpdatesClick}
              >
                <Icon icon="mdi:information-outline" class="size-4" aria-hidden="true" />
                {layoutTranslate("settings.viewUpdates")}
              </a>
              <button
                type="button"
                class="btn btn-ghost min-h-11 justify-start gap-2"
                onclick={openOnboarding}
              >
                <Icon icon="mdi:book-open-page-variant-outline" class="size-4" aria-hidden="true" />
                {layoutTranslate("settings.openOnboarding")}
              </button>
            </div>
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
          class="btn btn-circle btn-sm touch-target btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100"
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
            data-onboarding-target="theme"
            class="menu dropdown-content z-120 mt-3 min-w-max rounded-box border border-base-content/15 bg-(--archive-surface-overlay) p-1 shadow-md"
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
                  <span>{layoutTranslate(`themeMode.${themeOption}`, themeOption)}</span>
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
          class="btn btn-circle btn-sm touch-target btn-outline border-base-content/20 bg-base-100/65 hover:bg-base-100 disabled:opacity-75"
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
            data-onboarding-target="language"
            class="dropdown-content z-120 mt-3 w-max min-w-44 max-w-[min(14rem,calc(100vw-2rem))] overflow-hidden rounded-box border border-base-content/15 bg-(--archive-surface-overlay) p-2 shadow-md"
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
          data-onboarding-target="settings"
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
          <Icon icon="mdi:tune-variant" class="size-5" aria-hidden="true" />
        </button>
        {#if isMobileSettingsMenuOpen}
          <div
            id={MOBILE_SETTINGS_MENU_ID}
            role="dialog"
            aria-label={settingsLabel}
            class="dropdown-content z-130 mt-3 w-[min(13rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] max-h-[70vh] overflow-x-hidden overflow-y-auto rounded-box border border-base-content/15 bg-(--archive-surface-overlay) p-2 shadow-md"
          >
            {@render regionSelectorSection()}

            <div class="my-2 h-px bg-base-content/12"></div>

            {@render contentDisplaySection()}

            <div class="my-2 h-px bg-base-content/12"></div>

            <div class="flex flex-col gap-1" data-onboarding-target="theme">
              <span class="px-1 text-xs font-semibold opacity-70">
                {themePaletteLabel}
              </span>
              <div class="grid grid-cols-2 gap-1 sm:grid-cols-3">
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
              <div class="grid grid-cols-2 gap-1 sm:grid-cols-3">
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
                      >{layoutTranslate(`themeMode.${themeOption}`, themeOption)}</span
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
                      data-onboarding-target="language"
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

            <div class="my-2 h-px bg-base-content/12"></div>

            <div class="flex flex-col gap-1">
              <a
                class="btn btn-ghost min-h-11 justify-start gap-2"
                href={resolve("/updates")}
                onclick={handleSettingsUpdatesClick}
              >
                <Icon icon="mdi:information-outline" class="size-4" aria-hidden="true" />
                {layoutTranslate("settings.viewUpdates")}
              </a>
              <button
                type="button"
                class="btn btn-ghost min-h-11 justify-start gap-2"
                onclick={openOnboarding}
              >
                <Icon icon="mdi:book-open-page-variant-outline" class="size-4" aria-hidden="true" />
                {layoutTranslate("settings.openOnboarding")}
              </button>
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/snippet}

  <div class="page-switch-shell">
    {#if showSiteUpdateNotice}
      <div class="content-page-shell gap-4 px-2 pb-4 sm:px-4">
        <SiteUpdateNotice
          version={siteVersion}
          title={layoutTranslate("updates.notice.title")}
          message={layoutTranslate(activeSiteUpdate.summaryKey)}
          actionLabel={layoutTranslate("updates.notice.readLabel")}
          dismissLabel={layoutTranslate("updates.notice.dismissLabel")}
          onRead={navigateToUpdates}
          onDismiss={markCurrentSiteVersionSeen}
        />
      </div>
    {/if}
    {@render children()}
  </div>
</ViewerShell>

<OnboardingDialog
  open={isOnboardingDialogOpen}
  title={layoutTranslate("onboarding.title")}
  progressLabel={layoutTranslate("onboarding.progressLabel")}
  previousLabel={layoutTranslate("onboarding.previousLabel")}
  nextLabel={layoutTranslate("onboarding.nextLabel")}
  finishLabel={layoutTranslate("onboarding.finishLabel")}
  skipLabel={layoutTranslate("onboarding.skipLabel")}
  closeLabel={layoutTranslate("onboarding.closeLabel")}
  steps={onboardingSteps}
  onStepChange={prepareOnboardingStep}
  resolveTarget={resolveOnboardingTarget}
  onComplete={handleOnboardingDismiss}
  onSkip={handleOnboardingDismiss}
  onClose={handleOnboardingDismiss}
/>

{#if showBackToTop}
  <button
    type="button"
    class="content-site-back-to-top fixed right-5 z-30 inline-flex size-12 items-center justify-center rounded-full bg-primary text-primary-content shadow-lg transition-[transform,opacity,box-shadow] duration-150 ease-out hover-lift hover:shadow-xl cursor-pointer"
    aria-label={backToTopLabel}
    title={backToTopLabel}
    onclick={scrollToTop}
  >
    <Icon icon="mdi:arrow-up" class="size-5" />
  </button>
{/if}
