<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from "svelte";
  import type { SidebarItem } from "./viewer-shell.types";

  type Props = {
    drawerId: string;
    navTitle: string;
    navBadge?: string;
    navActions?: Snippet;
    desktopRailOpen?: boolean;
    skipToMainLabel?: string;
    openSidebarLabel?: string;
    closeSidebarLabel?: string;
    sidebarLabel?: string;
    sidebarItems?: SidebarItem[];
    showTitle?: boolean;
    title?: string;
    titleBadge?: string;
    children?: Snippet;
  };

  let {
    drawerId,
    navTitle,
    navBadge,
    navActions,
    desktopRailOpen = false,
    skipToMainLabel = "Skip to main content",
    openSidebarLabel = "Open navigation",
    closeSidebarLabel = "Close navigation",
    sidebarLabel = "Navigation",
    sidebarItems = [],
    showTitle = true,
    title = "Sekai Viewer",
    titleBadge = "reborn",
    children
  }: Props = $props();

  let sidebarOpen = $state(false);
  const sidebarPanelId = $derived(`${drawerId}-panel`);
  const mainId = $derived(`${drawerId}-main`);
</script>

<a class="viewer-shell-skip" href={`#${mainId}`}>{skipToMainLabel}</a>

<div class:lg:drawer-open={desktopRailOpen} class="drawer min-h-dvh">
  <input
    id={drawerId}
    type="checkbox"
    class="drawer-toggle"
    bind:checked={sidebarOpen}
    aria-hidden="true"
    tabindex="-1"
  />

  <div class="drawer-content bg-base-200">
    <header
      class="viewer-shell-nav sticky top-3 z-40 mx-3 mt-3 isolate overflow-visible rounded-full border px-2 lg:top-4 lg:mx-6 lg:mt-4"
    >
      <div class="navbar relative z-10 mx-auto min-h-14 w-full max-w-384 px-2">
        <div class="navbar-start">
          <button
            type="button"
            class={`btn btn-ghost btn-circle size-11! min-h-11! ${desktopRailOpen ? "lg:hidden" : ""}`}
            aria-label={openSidebarLabel}
            aria-controls={sidebarPanelId}
            aria-expanded={sidebarOpen}
            onclick={() => {
              sidebarOpen = true;
            }}
          >
            <Icon icon="mdi:menu" class="size-5" aria-hidden="true" />
          </button>
          <span
            class="hidden text-xs font-semibold tracking-[0.16em] text-base-content/55 uppercase lg:inline"
          >
            {navTitle}
          </span>
        </div>
        <div class="navbar-center lg:hidden">
          <span
            class="max-w-28 truncate text-xs font-semibold tracking-wide sm:max-w-none sm:text-sm"
          >
            {navTitle}
          </span>
        </div>
        <div class="navbar-end">
          {#if navActions}
            {@render navActions()}
          {:else if navBadge}
            <span class="badge badge-outline">{navBadge}</span>
          {/if}
        </div>
      </div>
    </header>

    <main
      id={mainId}
      tabindex="-1"
      class="viewer-shell-main mx-auto w-full max-w-384 px-3 pb-8 pt-6 md:px-6 lg:px-8"
    >
      {#if showTitle}
        <section class="py-12 text-center">
          <h1 class="relative inline-block text-4xl font-black tracking-tight md:text-5xl">
            {title}
            <span
              class="badge badge-error absolute -right-11 -top-5 -rotate-12 border border-error-content/25 px-2.5 py-2 text-[0.62rem] leading-none font-black uppercase tracking-wide text-error-content shadow-sm"
            >
              {titleBadge}
            </span>
          </h1>
        </section>
      {/if}

      {@render children?.()}
    </main>
  </div>

  <div class={`drawer-side z-50 ${desktopRailOpen ? "lg:z-30" : ""}`}>
    <button
      type="button"
      aria-label={closeSidebarLabel}
      class={`drawer-overlay ${desktopRailOpen ? "lg:hidden" : ""}`}
      onclick={() => {
        sidebarOpen = false;
      }}
    ></button>
    <nav
      id={sidebarPanelId}
      aria-label={sidebarLabel}
      class={`viewer-shell-rail menu min-h-full w-72 bg-base-100 p-4 ${desktopRailOpen ? "lg:w-68 lg:border-r lg:border-base-content/10 lg:px-3 lg:py-5" : ""}`}
    >
      <div class="mb-2 flex items-center justify-between px-2 py-1">
        <span class="text-sm font-semibold">{sidebarLabel}</span>
        <button
          type="button"
          class={`btn btn-ghost btn-sm btn-circle size-11! min-h-11! ${desktopRailOpen ? "lg:hidden" : ""}`}
          aria-label={closeSidebarLabel}
          aria-controls={sidebarPanelId}
          onclick={() => {
            sidebarOpen = false;
          }}
        >
          <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
        </button>
      </div>
      <ul>
        {#each sidebarItems as item (`${item.type ?? "link"}:${item.label}`)}
          {#if item.type === "section"}
            <li class="px-2 pt-4 first:pt-0">
              <div class="menu-title pointer-events-none px-0 py-1 select-none">
                <span>{item.label}</span>
              </div>
            </li>
          {:else if item.href && !item.disabled}
            <li>
              <a
                href={item.href}
                aria-current={item.active ? "page" : undefined}
                class={`grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 ${item.active ? "active" : ""}`}
                onclick={() => {
                  sidebarOpen = false;
                }}
              >
                {#if item.icon}
                  <span class="grid size-5 shrink-0 place-items-center">
                    <Icon icon={item.icon} class="size-4 shrink-0" aria-hidden="true" />
                  </span>
                {/if}
                <span>{item.label}</span>
              </a>
            </li>
          {:else}
            <li>
              <button
                type="button"
                disabled
                class="grid min-h-11 w-full grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 opacity-45"
              >
                {#if item.icon}
                  <span class="grid size-5 shrink-0 place-items-center">
                    <Icon icon={item.icon} class="size-4 shrink-0" aria-hidden="true" />
                  </span>
                {/if}
                <span>{item.label}</span>
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    </nav>
  </div>
</div>

<style>
  .viewer-shell-skip {
    position: fixed;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 100;
    transform: translateY(-160%);
    border-radius: 9999px;
    background: var(--color-primary);
    color: var(--color-primary-content);
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 700;
    transition: transform 150ms ease-out;
  }

  .viewer-shell-skip:focus-visible,
  .viewer-shell-main:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 4px;
  }

  .viewer-shell-skip:focus-visible {
    transform: translateY(0);
    outline-color: var(--color-primary-content);
    outline-offset: 2px;
  }

  .viewer-shell-nav {
    background: color-mix(in oklab, var(--color-base-100) 92%, transparent);
    border-color: color-mix(in oklab, var(--color-base-content) 12%, transparent);
    box-shadow: 0 4px 14px color-mix(in oklab, var(--color-base-content) 7%, transparent);
  }

  @supports (backdrop-filter: blur(1px)) {
    .viewer-shell-nav {
      background: color-mix(in oklab, var(--color-base-100) 82%, transparent);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }
  }

  .viewer-shell-rail {
    background: color-mix(in oklab, var(--color-base-100) 96%, var(--color-base-200));
  }

  :global([data-low-motion]) .viewer-shell-nav {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }

  :global([data-low-motion]) .viewer-shell-skip {
    transition: none;
  }
</style>
