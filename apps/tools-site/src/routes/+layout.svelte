<script lang="ts">
  import "../app.css";
  import "$lib/icons/mdi";
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { ThemeControls, ViewerShell, type SidebarItem } from "@platform/ui-shell";
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

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "comparison", "tracker"]);
  let messages = $state(fallbackMessages);
  let themeName = $state<ThemeName>("default");
  let themeMode = $state<ThemeMode>("auto");
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
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
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (updateCallback: () => Promise<void> | void) => unknown;
    };
    const supportsNativeViewTransition = typeof viewTransitionDocument.startViewTransition === "function";

    if (!supportsNativeViewTransition || reducedMotion) {
      return () => colorScheme.removeEventListener("change", handleSystemThemeChange);
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
    };
  });

  $effect(() => {
    void Promise.resolve(data.i18nMessages).then((next) => {
      messages = { ...fallbackMessages, ...next };
    });
  });
</script>

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
    <ThemeControls
      {themeName}
      {themeMode}
      paletteLabel={translate("theme.palette")}
      modeLabel={translate("theme.mode")}
      labels={{
        default: translate("theme.default"),
        sakura: translate("theme.sakura"),
        mint: translate("theme.mint"),
        auto: translate("theme.auto"),
        light: translate("theme.light"),
        dark: translate("theme.dark")
      }}
      onThemeNameChange={(nextName: ThemeName) => applyTheme(nextName, themeMode)}
      onThemeModeChange={(nextMode: ThemeMode) => applyTheme(themeName, nextMode)}
    />
  {/snippet}
  <div class="page-switch-shell">{@render children()}</div>
</ViewerShell>
