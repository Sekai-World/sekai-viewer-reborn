<script lang="ts">
  import type { Snippet } from "svelte";
  import Breadcrumbs, { type BreadcrumbItem } from "$lib/components/shared/Breadcrumbs.svelte";

  let {
    breadcrumbs,
    breadcrumbClass = "",
    actions
  }: {
    breadcrumbs: BreadcrumbItem[];
    breadcrumbClass?: string;
    actions?: Snippet;
  } = $props();
</script>

<div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
  <Breadcrumbs items={breadcrumbs} class={breadcrumbClass} />
  {#if actions}
    <div class="flex flex-wrap items-center gap-1.5 md:justify-end">
      {@render actions()}
    </div>
  {/if}
</div>
