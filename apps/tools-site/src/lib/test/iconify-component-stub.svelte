<script module lang="ts">
  export { addIcon } from "./iconify-stub";
</script>

<script lang="ts">
  let {
    icon,
    class: className,
    "aria-hidden": ariaHidden
  } = $props<{
    icon: string;
    class?: string;
    "aria-hidden"?: boolean | "true" | "false";
  }>();
</script>

<span class={className} aria-hidden={ariaHidden} data-icon={icon}></span>
