<script lang="ts">
  export type BreadcrumbItem = {
    label: string;
    href?: string;
  };

  let {
    items,
    class: className = ""
  }: {
    items: BreadcrumbItem[];
    class?: string;
  } = $props();
</script>

<nav aria-label="Breadcrumb" class={`content-breadcrumbs ${className}`.trim()}>
  <ol class="flex flex-wrap items-center gap-1.5 sm:gap-2">
    {#each items as item, index (item.href ?? `${item.label}-${index}`)}
      {@const isCurrent = index === items.length - 1}
      <li class="flex min-w-0 items-center gap-1.5 sm:gap-2">
        {#if item.href && !isCurrent}
          <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
          <a href={item.href} class="content-breadcrumb-link">
            <span class="truncate">{item.label}</span>
          </a>
        {:else}
          <span
            class={isCurrent ? "content-breadcrumb-current" : "content-breadcrumb-link"}
            aria-current={isCurrent ? "page" : undefined}
          >
            <span class="truncate">{item.label}</span>
          </span>
        {/if}

        {#if !isCurrent}
          <span class="content-breadcrumb-separator" aria-hidden="true">/</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>
