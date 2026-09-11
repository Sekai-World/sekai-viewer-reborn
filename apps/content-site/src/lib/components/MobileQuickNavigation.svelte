<script lang="ts">
  import Icon from "@iconify/svelte";
  import "$lib/icons/mdi";

  type QuickNavigationItem = {
    label: string;
    href: string;
    active: boolean;
    icon: string;
  };

  type Props = {
    items: ReadonlyArray<QuickNavigationItem>;
    navigationLabel: string;
  };

  let { items, navigationLabel }: Props = $props();
</script>

<nav class="content-site-quick-nav lg:hidden" aria-label={navigationLabel}>
  <div class="content-site-quick-nav-inner">
    {#each items as item (item.href)}
      <a
        href={item.href}
        class:content-site-quick-nav-item-active={item.active}
        class="content-site-quick-nav-item"
        aria-current={item.active ? "page" : undefined}
      >
        <Icon icon={item.icon} class="content-site-quick-nav-icon" aria-hidden="true" />
        <span class="content-site-quick-nav-label">{item.label}</span>
      </a>
    {/each}
  </div>
</nav>
