<script lang="ts">
  import { onMount, tick } from "svelte";
  import { getLocalCharacterThumbnailAssetURL } from "#lib/assets/characters.js";
  import type { MusicVocal, MusicVocalCharacter } from "#lib/domain/music-detail.js";
  import CharacterAvatar from "#lib/components/shared/CharacterAvatar.svelte";

  let {
    vocals,
    selectedVocalId,
    lockedVocalId = null,
    vocalLabel,
    vocalTypeLabel,
    vocalCharacterLabel,
    lockedVocalLabel,
    noVocalsLabel,
    onSelect
  }: {
    vocals: MusicVocal[];
    selectedVocalId: string;
    lockedVocalId?: string | null;
    vocalLabel: string;
    vocalTypeLabel: string;
    vocalCharacterLabel: string;
    lockedVocalLabel: string;
    noVocalsLabel: string;
    onSelect: (id: string) => void;
  } = $props();

  const menuId = $props.id();
  const getCharacters = (vocal: MusicVocal) => vocal.overrideChara ?? vocal.characters ?? [];
  const characterName = (character: MusicVocalCharacter) =>
    character.name?.trim() || vocalCharacterLabel;
  const availableVocals = $derived(
    vocals.filter((vocal) => vocal.assetBundleName && vocal.assetBundleName.trim().length > 0)
  );
  const selectedVocal = $derived(availableVocals.find((vocal) => vocal.id === selectedVocalId));
  const isLocked = $derived(lockedVocalId !== null && lockedVocalId !== undefined);
  let mobile = $state(false);
  let open = $state(false);
  let trigger = $state<HTMLButtonElement>();
  let menu = $state<HTMLDivElement>();
  let openingScroll = { x: 0, y: 0 };

  function closeMenu(restoreFocus = false) {
    if (menu?.hidePopover) menu.hidePopover();
    else if (menu) menu.style.display = "none";
    open = false;
    if (restoreFocus) trigger?.focus();
  }

  onMount(() => {
    const query = window.matchMedia?.("(max-width: 639px)");
    if (!query) return;
    mobile = query.matches;
    const update = () => {
      closeMenu();
      mobile = query.matches;
    };
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  });

  $effect(() => {
    if (isLocked) closeMenu();
  });

  async function openMenu() {
    if (isLocked) return;
    if (open) return closeMenu(true);
    openingScroll = { x: window.scrollX, y: window.scrollY };
    open = true;
    await tick();
    if (!menu || !trigger || !open) return;
    if (menu.showPopover) menu.showPopover();
    else menu.style.display = "block";
    const anchor = trigger.getBoundingClientRect();
    const width = Math.min(448, window.innerWidth - 32);
    menu.style.width = `${width}px`;
    menu.style.left = `${Math.max(16, Math.min(anchor.left, window.innerWidth - width - 16))}px`;
    const below = window.innerHeight - anchor.bottom - 16;
    const above = anchor.top - 16;
    const preferAbove = below < Math.min(menu.scrollHeight, 360) && above > below;
    menu.style.maxHeight = `${Math.max(44, Math.min(360, preferAbove ? above : below))}px`;
    menu.style.top = `${preferAbove ? anchor.top - menu.getBoundingClientRect().height - 4 : anchor.bottom + 4}px`;
    menu.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
  }

  function chooseVocal(id: string) {
    if (isLocked) return;
    onSelect(id);
    closeMenu(true);
  }

  function menuKeydown(event: KeyboardEvent) {
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      closeMenu(true);
      return;
    }
    const options = Array.from(menu?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
    const current = options.indexOf(document.activeElement as HTMLButtonElement);
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = (current + 1) % options.length;
        break;
      case "ArrowUp":
        next = (current - 1 + options.length) % options.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    options[next]?.focus();
  }

  function outsidePointer(event: PointerEvent) {
    if (
      open &&
      event.target instanceof Node &&
      !menu?.contains(event.target) &&
      !trigger?.contains(event.target)
    )
      closeMenu();
  }

  function pageScroll() {
    // A scroll queued before opening can arrive after the popover is focused.
    if (open && (window.scrollX !== openingScroll.x || window.scrollY !== openingScroll.y))
      closeMenu();
  }
</script>

<svelte:window onpointerdown={outsidePointer} onresize={() => closeMenu()} onscroll={pageScroll} />

{#snippet avatars(vocal: MusicVocal)}
  {#if getCharacters(vocal).length > 0}
    <span
      class="flex min-w-0 max-w-full flex-wrap items-center gap-1"
      aria-label={vocalCharacterLabel}
    >
      {#each getCharacters(vocal) as char (`${JSON.stringify(char.characterType) ?? "undefined"}:${char.characterId}`)}
        <span class="shrink-0" title={characterName(char)}>
          {#if char.characterType === undefined || char.characterType === "game_character"}
            <CharacterAvatar
              src={getLocalCharacterThumbnailAssetURL(char.characterId)}
              label={characterName(char)}
              characterId={char.characterId}
              variant="xs"
              decorative
            />
          {:else}
            <span
              class="flex size-7 shrink-0 items-center justify-center rounded-full border border-(--archive-border-subtle) bg-(--archive-surface-sunken) text-xs text-(--archive-text-muted)"
              aria-hidden="true"
              data-character-type={char.characterType === null ? "unknown" : char.characterType}
              data-character-id={char.characterId}>?</span
            >
          {/if}
        </span>
      {/each}
    </span>
  {/if}
{/snippet}

{#snippet vocalContent(vocal: MusicVocal, expanded = false)}
  <span class={expanded ? "flex min-w-0 flex-col items-start gap-2" : "flex items-center gap-1"}>
    <span class={expanded ? "max-w-full whitespace-normal wrap-break-word" : "whitespace-nowrap"}>
      {vocal.vocalType ?? noVocalsLabel}
    </span>
    {@render avatars(vocal)}
  </span>
{/snippet}

{#if mobile}
  <div
    class="dropdown flex h-14 min-w-0 flex-1 items-center"
    class:dropdown-open={open}
    data-testid="music-vocal-mobile"
  >
    {#if availableVocals.length === 0}
      <p class="text-sm opacity-60">{noVocalsLabel}</p>
    {:else}
      <button
        bind:this={trigger}
        type="button"
        class="btn btn-outline min-h-11 w-full min-w-0 cursor-pointer justify-between gap-1 px-2 disabled:cursor-default"
        aria-label={`${vocalLabel}: ${selectedVocal?.vocalType ?? noVocalsLabel}`}
        aria-haspopup="listbox"
        aria-controls={menuId}
        aria-expanded={open}
        title={isLocked ? lockedVocalLabel : (selectedVocal?.vocalType ?? noVocalsLabel)}
        disabled={isLocked}
        onclick={openMenu}
        onkeydown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            if (!open) void openMenu();
          }
        }}
      >
        <span class="min-w-0 truncate">{selectedVocal?.vocalType ?? noVocalsLabel}</span>
        <span class="shrink-0" aria-hidden="true">▾</span>
      </button>
      <div
        bind:this={menu}
        id={menuId}
        popover="auto"
        hidden={!open}
        class="dropdown-content content-card-elevated fixed inset-auto z-50 m-0 overflow-x-hidden overflow-y-auto rounded-xl border border-(--archive-border-subtle) p-1 shadow-md"
        role="listbox"
        tabindex="-1"
        aria-label={vocalLabel}
        onkeydown={menuKeydown}
        ontoggle={(event) => (open = event.newState === "open")}
      >
        {#each availableVocals as vocal (vocal.id)}
          <button
            type="button"
            role="option"
            class="btn min-h-11 h-auto w-full cursor-pointer justify-start whitespace-normal p-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current"
            class:btn-primary={vocal.id === selectedVocalId}
            class:btn-ghost={vocal.id !== selectedVocalId}
            aria-label={vocal.vocalType ?? noVocalsLabel}
            aria-selected={vocal.id === selectedVocalId}
            tabindex={vocal.id === selectedVocalId ? 0 : -1}
            data-vocal-id={vocal.id}
            onclick={() => chooseVocal(vocal.id)}
          >
            {@render vocalContent(vocal, true)}
          </button>
        {/each}
      </div>
    {/if}
  </div>
{:else}
  <fieldset
    class="flex h-14 min-w-0 flex-1 items-center overflow-x-auto scrollbar-thin"
    aria-label={vocalLabel}
  >
    {#if availableVocals.length === 0}
      <p class="text-sm opacity-60">{noVocalsLabel}</p>
    {:else}
      <legend class="sr-only">{vocalLabel}</legend>
      <div class="flex min-w-max items-center gap-1.5 pr-1.5">
        {#each availableVocals as vocal (vocal.id)}
          <div
            class="btn btn-sm min-h-11 shrink-0 items-center gap-1 rounded-full px-1"
            class:btn-primary={vocal.id === selectedVocalId}
            class:btn-ghost={vocal.id !== selectedVocalId}
            role="group"
            aria-label={`${vocalTypeLabel}: ${vocal.vocalType ?? noVocalsLabel}`}
          >
            <button
              type="button"
              class="flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-3 text-inherit focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-current disabled:cursor-default"
              aria-pressed={vocal.id === selectedVocalId}
              aria-label={vocal.vocalType ?? noVocalsLabel}
              title={isLocked ? lockedVocalLabel : (vocal.vocalType ?? noVocalsLabel)}
              disabled={isLocked}
              onclick={() => onSelect(vocal.id)}
            >
              {@render vocalContent(vocal)}
            </button>
          </div>
        {/each}
        <span
          class:invisible={!lockedVocalId}
          class="shrink-0 text-xs text-(--archive-text-muted)"
          aria-hidden={!lockedVocalId}
        >
          {lockedVocalLabel}
        </span>
      </div>
    {/if}
  </fieldset>
{/if}
