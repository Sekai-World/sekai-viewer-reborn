<script lang="ts">
  type Props = {
    heading?: boolean;
    title?: string;
    badge?: string;
  };

  let { heading = false, title = "Sekai Viewer", badge = "reborn" }: Props = $props();
</script>

{#if heading}
  <h1 class="relative inline-block text-4xl font-black tracking-tight md:text-5xl">
    {title}
    <span
      class="badge badge-error absolute -right-11 -top-5 -rotate-12 border border-error-content/25 px-2.5 py-2 text-[0.62rem] leading-none font-black uppercase tracking-wide text-error-content shadow-sm"
    >
      {badge}
    </span>
  </h1>
{:else}
  <div
    class="relative inline-block text-4xl font-black tracking-tight md:text-5xl"
    role="img"
    aria-label={`${title} ${badge}`}
  >
    {title}
    <span
      class="badge badge-error absolute -right-11 -top-5 -rotate-12 border border-error-content/25 px-2.5 py-2 text-[0.62rem] leading-none font-black uppercase tracking-wide text-error-content shadow-sm"
      aria-hidden="true"
    >
      {badge}
    </span>
  </div>
{/if}
