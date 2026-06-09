<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from "svelte";
  import type { SidebarItem } from "./viewer-shell.types";

  type Props = {
    drawerId: string;
    navTitle: string;
    navBadge?: string;
    navActions?: Snippet;
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
</script>

<div class="drawer min-h-dvh">
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
      class="viewer-shell-nav sticky top-4 z-40 mx-4 mt-4 isolate overflow-visible rounded-full border px-2"
    >
      <div class="navbar relative z-10 mx-auto min-h-14 w-full max-w-[96rem] px-2">
        <div class="navbar-start">
          <button
            type="button"
            class="btn btn-ghost btn-circle !h-11 !min-h-11 !w-11"
            aria-label={openSidebarLabel}
            aria-controls={sidebarPanelId}
            aria-expanded={sidebarOpen}
            onclick={() => {
              sidebarOpen = true;
            }}
          >
            <Icon icon="mdi:menu" class="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div class="navbar-center">
          <span
            class="max-w-[7rem] truncate text-xs font-semibold tracking-wide sm:max-w-none sm:text-sm"
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

    <main class="mx-auto w-full max-w-[96rem] px-4 pb-8 pt-6 md:px-6 lg:px-8">
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

  <div class="drawer-side z-50">
    <button
      type="button"
      aria-label={closeSidebarLabel}
      class="drawer-overlay"
      onclick={() => {
        sidebarOpen = false;
      }}
    ></button>
    <aside id={sidebarPanelId} class="menu min-h-full w-72 bg-base-100 p-4">
      <div class="mb-2 flex items-center justify-between px-2 py-1">
        <span class="text-sm font-semibold">{sidebarLabel}</span>
        <button
          type="button"
          class="btn btn-ghost btn-sm btn-circle !h-11 !min-h-11 !w-11"
          aria-label={closeSidebarLabel}
          aria-controls={sidebarPanelId}
          onclick={() => {
            sidebarOpen = false;
          }}
        >
          ✕
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
                class={`grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 ${item.active ? "active" : ""}`}
                onclick={() => {
                  sidebarOpen = false;
                }}
              >
                {#if item.icon}
                  <span class="grid h-5 w-5 shrink-0 place-items-center">
                    <Icon icon={item.icon} class="h-4 w-4 shrink-0" />
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
                  <span class="grid h-5 w-5 shrink-0 place-items-center">
                    <Icon icon={item.icon} class="h-4 w-4 shrink-0" />
                  </span>
                {/if}
                <span>{item.label}</span>
              </button>
            </li>
          {/if}
        {/each}
      </ul>
    </aside>
  </div>
</div>

<style>
  .viewer-shell-nav {
    background: color-mix(in oklab, var(--color-base-100) 94%, var(--color-base-200));
    border-color: color-mix(in oklab, var(--color-base-content) 14%, transparent);
    box-shadow:
      0 2px 8px color-mix(in oklab, var(--color-base-content) 9%, transparent),
      inset 0 1px 0 color-mix(in oklab, var(--color-base-100) 84%, transparent),
      inset 0 -1px 0 color-mix(in oklab, var(--color-base-content) 6%, transparent);
  }

  .viewer-shell-nav::before {
    content: "";
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    pointer-events: none;
    background: linear-gradient(
      110deg,
      color-mix(in oklab, var(--color-base-100) 36%, transparent) 0%,
      transparent 42%,
      color-mix(in oklab, var(--color-base-content) 5%, transparent) 100%
    );
    opacity: 0.28;
  }

  :global(.dark[data-theme="default"]) .viewer-shell-nav {
    background: color-mix(in oklab, var(--color-base-100) 90%, var(--color-base-200));
    box-shadow:
      0 2px 8px color-mix(in oklab, black 24%, transparent),
      inset 0 1px 0 color-mix(in oklab, var(--color-base-100) 30%, transparent),
      inset 0 -1px 0 color-mix(in oklab, var(--color-base-content) 5%, transparent);
  }

  :global(.dark[data-theme="default"]) .viewer-shell-nav::before {
    background: linear-gradient(
      110deg,
      color-mix(in oklab, var(--color-base-100) 20%, transparent) 0%,
      transparent 45%,
      color-mix(in oklab, var(--color-base-content) 4%, transparent) 100%
    );
    opacity: 0.14;
  }
</style>
