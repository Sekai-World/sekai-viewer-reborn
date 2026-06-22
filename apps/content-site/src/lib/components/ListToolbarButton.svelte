<script lang="ts">
  import Icon from "@iconify/svelte";

  let {
    icon,
    label,
    ariaLabel = label,
    title = label,
    sortIndicatorIcon,
    class: className = "",
    onclick
  }: {
    icon: string;
    label: string;
    ariaLabel?: string;
    title?: string;
    sortIndicatorIcon?: string;
    class?: string;
    onclick: (event: MouseEvent) => void;
  } = $props();

  const baseClass = "btn btn-sm !h-11 !min-h-11 !w-11 p-0 md:!h-8 md:!min-h-8 md:!w-8";

  const buttonClass = $derived(
    [baseClass, sortIndicatorIcon ? "relative overflow-visible" : "", className]
      .filter(Boolean)
      .join(" ")
  );
</script>

<button type="button" class={buttonClass} {onclick} {title} aria-label={ariaLabel}>
  <Icon {icon} class="size-4" aria-hidden="true" />
  {#if sortIndicatorIcon}
    <span
      class="absolute bottom-1 right-1 grid size-3.5 place-items-center rounded-full bg-primary-content/90 text-primary md:bottom-0.5 md:right-0.5 md:size-3"
      aria-hidden="true"
    >
      <Icon icon={sortIndicatorIcon} class="size-2.5" />
    </span>
  {/if}
</button>
