<script lang="ts">
  import Icon from "@iconify/svelte";

  /**
   * Circular primary play/pause toggle shared by audio surfaces. The button
   * only communicates playback state; loading shows a spinner and disables
   * interaction via `disabled`.
   */
  let {
    playing,
    loading = false,
    disabled = false,
    label,
    size = "lg",
    onclick
  }: {
    playing: boolean;
    loading?: boolean;
    disabled?: boolean;
    label: string;
    size?: "sm" | "md" | "lg";
    onclick?: () => void;
  } = $props();

  const sizeClasses = {
    sm: "btn-sm",
    md: "btn-md",
    lg: "btn-lg"
  } as const;
  const iconClasses = {
    sm: "size-4",
    md: "size-5",
    lg: "size-6"
  } as const;
  const spinnerClasses = {
    sm: "loading-xs",
    md: "loading-sm",
    lg: "loading-sm"
  } as const;
</script>

<button
  type="button"
  class={`btn btn-circle btn-primary shrink-0 ${sizeClasses[size]}`}
  {onclick}
  {disabled}
  aria-label={label}
  title={label}
>
  {#if loading}
    <span class={`loading loading-spinner ${spinnerClasses[size]}`} aria-hidden="true"></span>
  {:else}
    <Icon icon={playing ? "mdi:pause" : "mdi:play"} class={iconClasses[size]} />
  {/if}
</button>
