<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { ImagePreviewDialog } from "@platform/ui-shell";
  import { getLocalCharacterThumbnailAssetURL } from "#lib/assets/characters.js";
  import { getStampImageURL } from "#lib/assets/index.js";
  import CharacterAvatar from "#lib/components/shared/CharacterAvatar.svelte";
  import type { MissionCharacterOption } from "#lib/domain/mission.js";
  import type { SupportedRegion } from "#lib/domain/regions.js";
  import { getStampCharacters, getStampDisplayName, type StampItem } from "#lib/domain/stamp.js";
  import type { ContentSiteTranslator } from "#lib/i18n/runtime.js";
  import { STAMP_PREVIEW_BOX_CLASS } from "#lib/styles/stamp-preview.js";
  import type { Snippet } from "svelte";

  let {
    catalogueKey,
    region,
    characters,
    t
  }: {
    catalogueKey: string;
    region: SupportedRegion;
    characters: readonly MissionCharacterOption[];
    t: ContentSiteTranslator;
  } = $props();

  // History-only: the URL and list loaders are untouched. Kit drops this state on
  // reload (persistState: false), and SSR/direct entry therefore show just the list.
  // A matching payload alone must never turn a normal/direct entry into a modal
  // whose Close button could take the user off the list.
  const selected = $derived(
    page.shallow?.url.href === page.url.href &&
      page.state.stampPreview?.catalogueKey === catalogueKey
      ? page.state.stampPreview
      : null
  );
  let displayedStamp = $state<StampItem | null>(null);
  let host: HTMLDivElement | undefined = $state();
  let opening = false;
  let closing = false;
  let displayedCatalogueKey: string | null = null;

  $effect.pre(() => {
    if (selected) {
      // Focus the originating tile before showModal, including on Forward, so
      // native dismissal restores the right tile without scrolling.
      document
        .querySelector<HTMLButtonElement>(`[data-stamp-preview-id="${selected.stamp.id}"]`)
        ?.focus({ preventScroll: true });
      displayedStamp = selected.stamp;
      displayedCatalogueKey = catalogueKey;
    } else {
      closing = false;
      // Do not load a previously selected stamp's artwork in a new region/filter.
      if (displayedCatalogueKey !== catalogueKey) displayedStamp = null;
    }
  });

  $effect(() => {
    const preview = selected;
    const container = host;
    if (!preview || !container) return;

    // WebKit can restore BODY after showModal during history traversal. Wait
    // until the next rendering frame, then repair only missing/outer focus:
    // never steal a control the user has already reached or scroll the list.
    const frame = requestAnimationFrame(() => {
      const dialog = container.querySelector("dialog");
      if (
        selected !== preview ||
        !dialog?.open ||
        (document.activeElement !== document.body && document.activeElement !== dialog)
      )
        return;
      dialog.querySelector<HTMLElement>(".modal-box summary, .modal-box button")?.focus({
        preventScroll: true
      });
    });
    return () => cancelAnimationFrame(frame);
  });

  export async function show(stamp: StampItem, trigger: HTMLButtonElement): Promise<void> {
    // Do not stack duplicate history entries on double taps or while closing.
    if (opening || selected) return;
    opening = true;
    trigger.focus({ preventScroll: true });
    try {
      await goto(page.url.href, {
        shallow: true,
        persistState: false,
        state: { ...page.state, stampPreview: { catalogueKey, stamp } }
      });
    } finally {
      opening = false;
    }
  }

  const close = (open: boolean): void => {
    // The shared native dialog also emits close when Back closes it. In that
    // case selected is already null, so never traverse history a second time.
    // A queued native close from Back can arrive after Forward reopened the same
    // element; its open flag distinguishes that stale event from a dismissal.
    if (open || !selected || closing || host?.querySelector("dialog")?.open) return;
    closing = true;
    history.back();
  };

  $effect(() => {
    if (!displayedStamp) return;
    const dialog = host?.querySelector("dialog");
    if (!dialog) return;

    const loopFocus = (event: KeyboardEvent): void => {
      if (
        !selected ||
        !dialog.open ||
        event.defaultPrevented ||
        event.key !== "Tab" ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      )
        return;

      // Native modal dialogs make the page inert, but Chromium can still send
      // boundary Tab to browser chrome (activeElement becomes BODY). Wrap only
      // those boundaries; keep native Tab order and details/menu behavior inside.
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>("summary, a[href], button, [tabindex]")
      ].filter((element) => {
        const style = getComputedStyle(element);
        return (
          element.tabIndex >= 0 &&
          !element.matches(":disabled") &&
          !element.closest("[hidden], [inert]") &&
          style.visibility !== "hidden" &&
          style.visibility !== "collapse" &&
          element.getClientRects().length > 0
        );
      });
      const first = controls[0];
      const last = controls[controls.length - 1];
      const boundary = event.shiftKey ? first : last;
      const destination = event.shiftKey ? last : first;
      if (destination && document.activeElement === boundary) {
        event.preventDefault();
        destination.focus();
      }
    };

    dialog.addEventListener("keydown", loopFocus);
    return () => dialog.removeEventListener("keydown", loopFocus);
  });
</script>

{#snippet previewField(label: string, value: Snippet)}
  <div class="grid gap-0.5">
    <dt class="text-xs font-semibold tracking-[0.16em] uppercase opacity-60">{label}</dt>
    <dd class="text-sm wrap-anywhere whitespace-pre-line">{@render value()}</dd>
  </div>
{/snippet}

<div
  bind:this={host}
  data-stamp-preview-host
  class="[&_.btn]:min-h-11 [&_.btn]:min-w-11 [&_.menu_a]:min-h-11 [&_.menu_a]:min-w-11"
>
  {#if displayedStamp}
    {@const stamp = displayedStamp}
    {@const stampCharacters = getStampCharacters(stamp.characterIds, characters)}
    <ImagePreviewDialog
      bind:open={() => selected !== null, close}
      src={getStampImageURL(stamp.assetbundleName, region) ?? ""}
      alt={getStampDisplayName(stamp.name)}
      fallbackLabel={t("imageUnavailable")}
      closeLabel={t("closeLabel")}
      downloadLabel={t("stamp.previewDownload")}
      openInNewWindowLabel={t("stamp.previewOpenInNewWindow")}
      formatOptions={["webp", "png"]}
      dialogBoxClass={STAMP_PREVIEW_BOX_CLASS}
      dialogImageClass="h-auto max-h-[60dvh] w-auto max-w-full object-contain"
    >
      <dl class="grid gap-3 border-t border-(--archive-border-subtle) pt-3 text-left">
        {#snippet name()}
          <span class="font-semibold">{getStampDisplayName(stamp.name)}</span>
        {/snippet}
        {@render previewField(t("stamp.previewName"), name)}
        {#if stampCharacters.length > 0}
          {#snippet characterList()}
            <ul class="flex flex-wrap gap-x-3 gap-y-1.5">
              {#each stampCharacters as character (character.id)}
                <li class="flex items-center gap-1.5">
                  <CharacterAvatar
                    src={getLocalCharacterThumbnailAssetURL(character.id)}
                    label=""
                    characterId={character.id}
                    variant="xs"
                    decorative
                  />
                  <span>{character.name}</span>
                </li>
              {/each}
            </ul>
          {/snippet}
          {@render previewField(t("stamp.previewCharacters"), characterList)}
        {/if}
        {#if stamp.description}
          {#snippet obtain()}{stamp.description}{/snippet}
          {@render previewField(t("stamp.previewObtain"), obtain)}
        {/if}
      </dl>
    </ImagePreviewDialog>
  {/if}
</div>

<style>
  /* daisyUI adds a stable gutter on modal open. Reserve it before opening too,
     only while this stamp pilot is mounted: otherwise a narrower grid can
     shrink the page and clamp scroll near the bottom of the catalogue. */
  :global(:root:has([data-stamp-preview-host])) {
    scrollbar-gutter: stable;
  }
</style>
