<script lang="ts">
  type Props = {
    heading?: boolean;
  };

  let { heading = false }: Props = $props();
</script>

{#if heading}
  <h1 class="relative inline-block text-4xl font-black tracking-tight md:text-5xl">
    Sekai Viewer
    <span
      class="badge badge-error absolute -right-11 -top-5 -rotate-12 border border-error-content/25 px-2.5 py-2 text-[0.62rem] leading-none font-black uppercase tracking-wide text-error-content shadow-sm"
    >
      reborn
    </span>
  </h1>
{:else}
  <div class="relative inline-block text-4xl font-black tracking-tight md:text-5xl" role="img" aria-label="Sekai Viewer reborn">
    Sekai Viewer
    <span
      class="badge badge-error absolute -right-11 -top-5 -rotate-12 border border-error-content/25 px-2.5 py-2 text-[0.62rem] leading-none font-black uppercase tracking-wide text-error-content shadow-sm"
      aria-hidden="true"
    >
      reborn
    </span>
  </div>
{/if}
