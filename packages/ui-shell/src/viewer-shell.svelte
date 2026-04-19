<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from "svelte";
  import type { SidebarItem } from "./viewer-shell.types";

  type Props = {
    drawerId: string;
    navTitle: string;
    navBadge?: string;
    navActions?: Snippet;
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
    sidebarLabel = "导航",
    sidebarItems = [],
    showTitle = true,
    title = "Sekai Viewer",
    titleBadge = "reborn",
    children
  }: Props = $props();

  let sidebarOpen = $state(false);
</script>

<div class="drawer min-h-dvh">
  <input id={drawerId} type="checkbox" class="drawer-toggle" bind:checked={sidebarOpen} />

  <div class="drawer-content bg-base-200">
    <header class="liquid-glass-nav sticky top-4 z-40 mx-4 mt-4 isolate overflow-visible rounded-full border px-2 backdrop-blur-sm backdrop-saturate-150">
      <div class="navbar relative z-10 min-h-14 px-2">
        <div class="navbar-start">
          <label for={drawerId} class="btn btn-ghost btn-circle" aria-label="Open sidebar">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
        </div>
        <div class="navbar-center">
          <span class="max-w-[7rem] truncate text-xs font-semibold tracking-wide sm:max-w-none sm:text-sm">
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
              class="badge badge-error absolute -right-11 -top-5 -rotate-12 border border-error-content/25 px-2.5 py-2 text-[0.62rem] leading-none font-black uppercase tracking-[0.16em] text-error-content shadow-sm"
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
    <label for={drawerId} aria-label="Close sidebar" class="drawer-overlay"></label>
    <aside class="menu min-h-full w-72 bg-base-100 p-4">
      <div class="mb-2 flex items-center justify-between px-2 py-1">
        <span class="text-sm font-semibold">{sidebarLabel}</span>
        <label for={drawerId} class="btn btn-ghost btn-sm btn-circle" aria-label="Close sidebar">✕</label>
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
              <a
                href={item.href ?? "#"}
                aria-disabled="true"
                class="grid grid-cols-[1.25rem_minmax(0,1fr)] items-center gap-3 opacity-45"
                onclick={(event) => {
                  event.preventDefault();
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
          {/if}
        {/each}
      </ul>
    </aside>
  </div>
</div>

<style>
  .liquid-glass-nav {
    background:
      radial-gradient(
        140% 120% at 0% 0%,
        color-mix(in oklab, var(--color-primary) 10%, transparent) 0%,
        transparent 60%
      ),
      radial-gradient(
        120% 130% at 100% 100%,
        color-mix(in oklab, var(--color-accent) 7%, transparent) 0%,
        transparent 64%
      ),
      linear-gradient(
        135deg,
        color-mix(in oklab, var(--color-base-100) 58%, transparent) 0%,
        color-mix(in oklab, var(--color-base-100) 46%, transparent) 45%,
        color-mix(in oklab, var(--color-primary) 7%, var(--color-base-100) 38%) 100%
      );
    background-size: 180% 180%, 170% 170%, 130% 130%;
    border-color: color-mix(in oklab, var(--color-base-content) 14%, transparent);
    box-shadow:
      0 10px 22px -24px color-mix(in oklab, var(--color-base-content) 38%, transparent),
      inset 0 1px 0 color-mix(in oklab, var(--color-base-100) 72%, transparent),
      inset 0 -1px 0 color-mix(in oklab, var(--color-base-content) 6%, transparent);
  }

  .liquid-glass-nav::before {
    content: "";
    position: absolute;
    inset: 1px;
    border-radius: inherit;
    pointer-events: none;
    background:
      radial-gradient(
        120% 95% at 10% 0%,
        color-mix(in oklab, white 34%, transparent),
        transparent 60%
      ),
      radial-gradient(
        95% 85% at 80% 100%,
        color-mix(in oklab, var(--color-primary) 8%, transparent),
        transparent 68%
      ),
      linear-gradient(
        110deg,
        color-mix(in oklab, var(--color-base-100) 46%, transparent) 0%,
        transparent 28%,
        transparent 62%,
        color-mix(in oklab, var(--color-base-content) 8%, transparent) 100%
      );
    background-size: 170% 170%, 150% 150%, 130% 130%;
    mix-blend-mode: screen;
    opacity: 0.34;
  }

  :global([data-theme="dark"]) .liquid-glass-nav {
    background:
      radial-gradient(
        130% 105% at 0% 0%,
        color-mix(in oklab, var(--color-primary) 8%, transparent) 0%,
        transparent 62%
      ),
      radial-gradient(
        115% 120% at 100% 100%,
        color-mix(in oklab, var(--color-accent) 5%, transparent) 0%,
        transparent 66%
      ),
      linear-gradient(
        135deg,
        color-mix(in oklab, var(--color-base-100) 46%, transparent) 0%,
        color-mix(in oklab, var(--color-base-100) 36%, transparent) 48%,
        color-mix(in oklab, var(--color-base-content) 5%, var(--color-base-100) 34%) 100%
      );
    box-shadow:
      0 10px 22px -24px color-mix(in oklab, black 58%, transparent),
      inset 0 1px 0 color-mix(in oklab, var(--color-base-100) 24%, transparent),
      inset 0 -1px 0 color-mix(in oklab, var(--color-base-content) 5%, transparent);
  }

  :global([data-theme="dark"]) .liquid-glass-nav::before {
    background:
      radial-gradient(
        120% 88% at 12% 0%,
        color-mix(in oklab, white 16%, transparent),
        transparent 64%
      ),
      linear-gradient(
        110deg,
        color-mix(in oklab, var(--color-base-100) 28%, transparent) 0%,
        transparent 34%,
        transparent 74%,
        color-mix(in oklab, var(--color-base-content) 5%, transparent) 100%
      );
    mix-blend-mode: soft-light;
    opacity: 0.16;
  }
</style>
