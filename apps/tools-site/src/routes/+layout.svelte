<script lang="ts">
  import "../app.css";
  import { onNavigate } from "$app/navigation";
  import { page } from "$app/state";
  import { ViewerShell, type SidebarItem } from "@platform/ui-shell";
  import { onMount, type Snippet } from "svelte";
  import { createI18nTranslator, getLocalI18nMessages } from "$lib/i18n/runtime";
  import type { LayoutData } from "./$types";

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
  const fallbackMessages = getLocalI18nMessages(["common", "comparison", "tracker"]);
  let messages = $state(fallbackMessages);
  let supportsNativeViewTransition = $state(false);
  let motionAllowed = $state(false);
  const translate = $derived(createI18nTranslator(data.uiLocale, messages));
  const navigationTransitionKey = $derived(page.url.pathname);
  const sidebarItems: SidebarItem[] = $derived([
    { label: translate("navigation.home"), href: "/", active: page.url.pathname === "/" },
    {
      label: translate("navigation.eventTracker"),
      href: "/tracker/jp",
      active: page.url.pathname.startsWith("/tracker/")
    }
  ]);

  onMount(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (updateCallback: () => Promise<void> | void) => unknown;
    };
    supportsNativeViewTransition = typeof viewTransitionDocument.startViewTransition === "function";
    motionAllowed = !reducedMotion;

    if (!supportsNativeViewTransition || reducedMotion) return;

    return onNavigate((navigation) => {
      if (!viewTransitionDocument.startViewTransition) return;
      return new Promise<void>((resolve) => {
        viewTransitionDocument.startViewTransition(async () => {
          resolve();
          await navigation.complete;
        });
      });
    });
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
  showTitle={false}
>
  {#if !supportsNativeViewTransition && motionAllowed}
    {#key navigationTransitionKey}
      <div class="page-switch-shell page-switch-shell-fallback">{@render children()}</div>
    {/key}
  {:else}
    <div class="page-switch-shell">{@render children()}</div>
  {/if}
</ViewerShell>
