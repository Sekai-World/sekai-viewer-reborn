<script lang="ts">
  import { UnitIconBadge as SharedUnitIconBadge } from "@platform/ui-shell";
  import { getStaticUnitColor } from "$lib/domain/unit-colors";
  import { resolveUnitIconUrl } from "$lib/domain/unit-icon";

  let {
    unit,
    fallbackLabel,
    mapNoneToPiapro = false,
    variant = "default",
    class: className
  }: {
    /** Unit slug, e.g. "idol", "light_sound", "none". */
    unit: string;
    /** Text shown in a pill when no icon image exists. Omit to hide when unavailable. */
    fallbackLabel?: string;
    /** Treat the support-unit "none" slug as the piapro icon. */
    mapNoneToPiapro?: boolean;
    /** Visual size: "sm" (card list), "default" (event cards), "lg" (detail cards). */
    variant?: "sm" | "default" | "lg";
    /** Extra classes forwarded to the outer element. */
    class?: string;
  } = $props();

</script>

<SharedUnitIconBadge
  {unit}
  {fallbackLabel}
  {mapNoneToPiapro}
  {variant}
  class={className}
  resolveIconUrl={resolveUnitIconUrl}
  getBorderColor={getStaticUnitColor}
/>
