<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { RegionOption } from "./region-switcher.types";

  type Props = {
    options: ReadonlyArray<RegionOption>;
    primaryValue: string;
    secondaryValue: string;
    onSelectPrimary: (value: string) => void;
    onSelectSecondary: (value: string) => void;
    primaryTitle?: string;
    secondaryTitle?: string;
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
  };

  let {
    options,
    primaryValue,
    secondaryValue,
    onSelectPrimary,
    onSelectSecondary,
    primaryTitle = "Primary",
    secondaryTitle = "Secondary",
    isOpen = $bindable(false),
    onOpenChange
  }: Props = $props();

  const primaryRegionLabel = $derived(
    options.find((option) => option.value === primaryValue)?.label ?? primaryValue.toUpperCase()
  );
  const secondaryRegionLabel = $derived(
    options.find((option) => option.value === secondaryValue)?.label ?? secondaryValue.toUpperCase()
  );

  const handleMenuToggle = (event: Event): void => {
    const detailsElement = event.currentTarget as HTMLDetailsElement;
    onOpenChange?.(detailsElement.open);
  };
</script>

<details class="dropdown dropdown-end" bind:open={isOpen} ontoggle={handleMenuToggle}>
  <summary
    class="btn btn-sm btn-outline rounded-full border-base-content/20 bg-base-100/65 px-2 text-xs sm:px-3 sm:text-sm hover:bg-base-100"
    aria-label={`Switch data regions. ${primaryTitle}: ${primaryRegionLabel}. ${secondaryTitle}: ${secondaryRegionLabel}`}
    title={`${primaryTitle} | ${secondaryTitle}: ${primaryRegionLabel} | ${secondaryRegionLabel}`}
  >
    <Icon icon="mdi:earth" class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
    <span class="max-w-[4.8rem] truncate font-semibold sm:max-w-none">
      {primaryRegionLabel} | {secondaryRegionLabel}
    </span>
  </summary>
  <div
    class="dropdown-content z-[120] mt-3 w-[16.5rem] rounded-box border border-base-content/15 bg-base-100/96 p-2 shadow-xl backdrop-blur-sm sm:w-[18rem]"
  >
    <div class="grid grid-cols-[1fr_auto_1fr] gap-2">
      <section>
        <p class="mb-1 px-2 text-xs font-semibold uppercase tracking-wide opacity-70">
          {primaryTitle}
        </p>
        <ul class="menu gap-0.5 p-0">
          {#each options as option (option.value)}
            <li>
              <button
                type="button"
                class={option.value === primaryValue ? "menu-active font-semibold" : ""}
                onclick={() => {
                  onSelectPrimary(option.value);
                  isOpen = false;
                  onOpenChange?.(false);
                }}
              >
                <span>{option.label}</span>
                {#if option.value === primaryValue}
                  <Icon icon="mdi:check" class="h-4 w-4 opacity-80" />
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </section>

      <div class="my-1 w-px bg-base-content/12"></div>

      <section>
        <p class="mb-1 px-2 text-xs font-semibold uppercase tracking-wide opacity-70">
          {secondaryTitle}
        </p>
        <ul class="menu gap-0.5 p-0">
          {#each options as option (option.value)}
            <li>
              <button
                type="button"
                class={option.value === secondaryValue ? "menu-active font-semibold" : ""}
                onclick={() => {
                  onSelectSecondary(option.value);
                  isOpen = false;
                  onOpenChange?.(false);
                }}
              >
                <span>{option.label}</span>
                {#if option.value === secondaryValue}
                  <Icon icon="mdi:check" class="h-4 w-4 opacity-80" />
                {/if}
              </button>
            </li>
          {/each}
        </ul>
      </section>
    </div>
  </div>
</details>
