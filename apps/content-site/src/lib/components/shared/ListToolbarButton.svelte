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

  const baseClass =
    "btn btn-sm h-11! min-h-11! w-11! p-0 md:h-9! md:min-h-9! md:w-9! lg:h-10! lg:min-h-10! lg:w-10!";

  const buttonClass = $derived(
    [baseClass, sortIndicatorIcon ? "relative overflow-visible" : "", className]
      .filter(Boolean)
      .join(" ")
  );
</script>

<button type="button" class={buttonClass} {onclick} {title} aria-label={ariaLabel}>
  <Icon {icon} class="size-5 md:size-4.5 lg:size-5" aria-hidden="true" />
  {#if sortIndicatorIcon}
    <span
      class="absolute bottom-1 right-1 grid size-3.5 place-items-center rounded-full bg-primary-content/90 text-primary md:bottom-0.75 md:right-0.75 md:size-3.25 lg:bottom-1 lg:right-1 lg:size-3.5"
      aria-hidden="true"
    >
      <Icon icon={sortIndicatorIcon} class="size-2.5 lg:size-3" />
    </span>
  {/if}
</button>
