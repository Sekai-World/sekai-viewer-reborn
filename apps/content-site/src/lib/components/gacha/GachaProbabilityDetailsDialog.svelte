<script lang="ts">
  import { resolve, base } from "$app/paths";
  import { getCardThumbnailPresentation } from "$lib/components/card/card-presentation";
  import type { GachaProbabilityCard } from "$lib/domain/gacha-probability";
  import type { SupportedRegion } from "$lib/domain/regions";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import Icon from "@iconify/svelte";
  import { tick } from "svelte";
  import { SvelteMap } from "svelte/reactivity";

  type ProbabilityPayload = { cards: GachaProbabilityCard[] };
  type LoadState = "idle" | "loading" | "success" | "failure";

  let {
    region,
    gachaId,
    openLabel,
    title,
    closeLabel,
    infoLabel,
    disclaimer,
    rateChoiceExplanation,
    showRateChoiceExplanation,
    normalLabel: _normalLabel,
    wishLabel: _wishLabel,
    unavailableLabel,
    loadingLabel,
    loadFailedLabel,
    retryLabel,
    conditionalLabel: _conditionalLabel,
    cardIdLabel: _cardIdLabel,
    cardAltSuffix,
    rarityLabels,
    rarityUnknownLabel,
    diagnosticLabels
  }: {
    region: SupportedRegion;
    gachaId: string;
    openLabel: string;
    title: string;
    closeLabel: string;
    infoLabel: string;
    disclaimer: string;
    rateChoiceExplanation: string;
    showRateChoiceExplanation: boolean;
    normalLabel: string;
    wishLabel: string;
    unavailableLabel: string;
    loadingLabel: string;
    loadFailedLabel: string;
    retryLabel: string;
    conditionalLabel: string;
    cardIdLabel: string;
    cardAltSuffix: string;
    rarityLabels: Record<string, string>;
    rarityUnknownLabel: string;
    diagnosticLabels: Record<string, string>;
  } = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  let cards = $state<GachaProbabilityCard[]>([]);
  let loadState = $state<LoadState>("idle");
  let activeRarity = $state("");
  let infoHovered = $state(false);
  let infoFocused = $state(false);
  let infoPinned = $state(false);
  let probabilityIdentity = "";
  let requestGeneration = 0;
  let activeRequestController: AbortController | null = null;

  const getProbabilityIdentity = (): string => `${region}\u0000${gachaId}`;

  const resetProbabilityState = (nextIdentity: string): void => {
    if (nextIdentity === probabilityIdentity) {
      return;
    }

    probabilityIdentity = nextIdentity;
    requestGeneration += 1;
    activeRequestController?.abort();
    activeRequestController = null;
    cards = [];
    loadState = "idle";
    activeRarity = "";
    infoHovered = false;
    infoFocused = false;
    infoPinned = false;
    if (dialog?.open) {
      dialog.close();
    }
  };

  $effect(() => {
    resetProbabilityState(getProbabilityIdentity());
  });

  const groups = $derived.by(() => {
    const grouped: Record<string, GachaProbabilityCard[]> = {};
    for (const card of cards) {
      const key = card.rarityType?.trim().toLowerCase() || "unknown";
      grouped[key] = [...(grouped[key] ?? []), card];
    }
    return Object.entries(grouped);
  });
  const visibleCards = $derived(groups.find(([key]) => key === activeRarity)?.[1] ?? []);

  $effect(() => {
    if (!groups.some(([key]) => key === activeRarity)) {
      activeRarity = groups[0]?.[0] ?? "";
    }
  });

  const probability = (value: number | null): string =>
    value === null
      ? unavailableLabel
      : value > 0 && value < 0.0001
        ? "<0.0001%"
        : `${value.toFixed(value < 0.01 ? 4 : 2)}%`;

  const getIdPart = (value: string): string => value.replace(/[^a-zA-Z0-9_-]/g, "-");
  const getProbabilityInfoId = (): string =>
    `gacha-probability-info-${getIdPart(region)}-${getIdPart(gachaId)}`;
  const getRarityTabId = (rarity: string): string =>
    `gacha-probability-tab-${getIdPart(region)}-${getIdPart(gachaId)}-${getIdPart(rarity)}`;
  const getRarityPanelId = (rarity: string): string =>
    `gacha-probability-panel-${getIdPart(region)}-${getIdPart(gachaId)}-${getIdPart(rarity)}`;
  const getRarityDisplay = (rarity: string): string => rarityLabels[rarity] ?? rarityUnknownLabel;

  const rarityValueByType: Record<string, number> = {
    rarity_1: 1,
    rarity_2: 2,
    rarity_3: 3,
    rarity_4: 4,
    rarity_birthday: 1
  };

  const getRarityValue = (rarityType: string | null): number =>
    rarityType ? (rarityValueByType[rarityType.trim().toLowerCase()] ?? 0) : 0;

  type ProbabilityGroup = {
    key: string;
    label: string;
    cards: GachaProbabilityCard[];
  };

  const PROBABILITY_GROUP_INITIAL_LIMIT = 18;

  const getProbabilityGroupSortValue = (card: GachaProbabilityCard): number => {
    if (card.probabilitySegments.some((s) => s.conditional)) {
      const first = card.probabilitySegments.find((s) => s.conditional);
      return first?.probability ?? -1;
    }
    return card.probability ?? -1;
  };

  const getProbabilityGroupKey = (card: GachaProbabilityCard): string => {
    if (card.probabilitySegments.some((s) => s.conditional)) {
      return card.probabilitySegments
        .filter((s) => s.conditional)
        .map((s) => `${s.lotteryType}:${s.probability}`)
        .join("|");
    }
    return card.probability === null ? `null:${card.diagnostic}` : String(card.probability);
  };

  const getProbabilityGroupLabel = (card: GachaProbabilityCard): string => {
    if (card.probabilitySegments.some((s) => s.conditional)) {
      return card.probabilitySegments
        .filter((s) => s.conditional)
        .map((s) => `${s.lotteryType}: ${probability(s.probability)}`)
        .join(", ");
    }
    return card.probability === null
      ? (diagnosticLabels[card.diagnostic] ?? unavailableLabel)
      : probability(card.probability);
  };

  const parseCardId = (card: GachaProbabilityCard): number => {
    const id = card.cardId;
    if (!id) return -1;
    const n = Number(id);
    return Number.isFinite(n) ? n : -1;
  };

  let expandedGroups = $state<Record<string, boolean>>({});

  const groupedVisibleCards = $derived.by<ProbabilityGroup[]>(() => {
    const result: ProbabilityGroup[] = [];
    const groupMap = new SvelteMap<string, ProbabilityGroup>();

    for (const card of visibleCards) {
      const key = getProbabilityGroupKey(card);
      let group = groupMap.get(key);
      if (!group) {
        group = { key, label: getProbabilityGroupLabel(card), cards: [] };
        groupMap.set(key, group);
        result.push(group);
      }
      group.cards.push(card);
    }

    result.sort((a, b) => {
      const va = getProbabilityGroupSortValue(a.cards[0]);
      const vb = getProbabilityGroupSortValue(b.cards[0]);
      return vb - va;
    });

    for (const group of result) {
      group.cards.sort((a, b) => parseCardId(b) - parseCardId(a));
    }

    return result;
  });

  let infoVisible = $derived(infoHovered || infoFocused || infoPinned);
  let hasRateChoiceNote = $derived(
    showRateChoiceExplanation && rateChoiceExplanation.trim().length > 0
  );
  let probabilityNoteText = $derived.by(() =>
    [hasRateChoiceNote ? rateChoiceExplanation.trim() : "", disclaimer.trim()]
      .filter(Boolean)
      .join(" ")
  );
  let hasProbabilityNotes = $derived(probabilityNoteText.length > 0);

  const toggleInfo = (event: MouseEvent): void => {
    if (infoPinned) {
      infoPinned = false;
      infoFocused = false;
      (event.currentTarget as HTMLButtonElement).blur();
      return;
    }

    infoPinned = true;
  };

  const handleInfoKeydown = (event: KeyboardEvent): void => {
    if (event.key !== "Escape") return;
    infoPinned = false;
    infoHovered = false;
    infoFocused = false;
    (event.currentTarget as HTMLButtonElement).blur();
  };

  const isCurrentRequest = (identity: string, generation: number): boolean =>
    identity === probabilityIdentity &&
    identity === getProbabilityIdentity() &&
    generation === requestGeneration;

  const focusRarityTab = async (rarity: string): Promise<void> => {
    activeRarity = rarity;
    await tick();
    if (activeRarity === rarity && probabilityIdentity === getProbabilityIdentity()) {
      document.getElementById(getRarityTabId(rarity))?.focus();
    }
  };

  const loadProbabilities = async (): Promise<void> => {
    resetProbabilityState(getProbabilityIdentity());
    if (loadState !== "idle") {
      return;
    }

    loadState = "loading";
    const identity = probabilityIdentity;
    const generation = ++requestGeneration;
    const controller = new AbortController();
    activeRequestController = controller;
    try {
      const response = await fetch(
        `${base}/api/gacha/${encodeURIComponent(region)}/${encodeURIComponent(gachaId)}/probabilities`,
        { signal: controller.signal }
      );
      if (!response.ok) {
        throw new Error("probability request failed");
      }

      const payload = (await response.json()) as ProbabilityPayload;
      if (!isCurrentRequest(identity, generation)) {
        return;
      }
      cards = Array.isArray(payload.cards) ? payload.cards : [];
      loadState = "success";
    } catch {
      if (isCurrentRequest(identity, generation) && !controller.signal.aborted) {
        loadState = "failure";
      }
    } finally {
      if (isCurrentRequest(identity, generation)) {
        activeRequestController = null;
      }
    }
  };

  const retry = (): void => {
    loadState = "idle";
    void loadProbabilities();
  };

  const open = (): void => {
    dialog?.showModal();
    void loadProbabilities();
  };
  const close = (): void => dialog?.close();
</script>

<div class="mt-1 flex w-full items-center justify-between gap-2">
  <button
    type="button"
    class="btn btn-outline btn-primary btn-sm gap-1.5 shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md"
    onclick={open}
  >
    <Icon icon="mdi:chart-box-outline" class="size-4" aria-hidden="true" />{openLabel}
  </button>

  {#if hasProbabilityNotes}
    <span
      role="group"
      class="relative inline-flex shrink-0"
      onpointerleave={(event) => {
        if (event.pointerType === "mouse") infoHovered = false;
      }}
    >
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-sm size-8 min-h-8 p-0 text-base-content/65 transition-colors hover:text-primary focus-visible:text-primary"
        aria-label={infoLabel}
        aria-controls={getProbabilityInfoId()}
        aria-expanded={infoVisible}
        aria-describedby={infoVisible ? getProbabilityInfoId() : undefined}
        onclick={toggleInfo}
        onpointerenter={(event) => {
          if (event.pointerType === "mouse") infoHovered = true;
        }}
        onfocus={() => (infoFocused = true)}
        onblur={() => {
          infoFocused = false;
          infoPinned = false;
        }}
        onkeydown={handleInfoKeydown}
      >
        <Icon icon="mdi:information-outline" class="size-5" aria-hidden="true" />
      </button>

      {#if infoVisible}
        <div
          id={getProbabilityInfoId()}
          role="tooltip"
          class="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-neutral-content/15 bg-neutral p-3 text-left text-xs/5 text-neutral-content shadow-xl"
        >
          <p>{probabilityNoteText}</p>
        </div>
      {/if}
    </span>
  {/if}
</div>

<dialog bind:this={dialog} class="modal" aria-labelledby="gacha-probability-title">
  <div class="modal-box flex max-h-[min(90vh,52rem)] w-11/12 max-w-5xl flex-col gap-4 p-4 sm:p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 id="gacha-probability-title" class="text-xl font-bold">{title}</h2>
      </div>
      <button
        type="button"
        class="btn btn-circle btn-ghost btn-sm"
        aria-label={closeLabel}
        onclick={close}
      >
        <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
      </button>
    </div>

    {#if loadState === "loading"}
      <div
        class="content-card-inset flex items-center justify-center gap-2 rounded-xl p-6 text-sm opacity-70"
      >
        <span class="loading loading-spinner loading-sm"></span>{loadingLabel}
      </div>
    {:else if loadState === "failure"}
      <div class="content-card-inset rounded-xl p-6 text-center text-sm text-error/80">
        <p>{loadFailedLabel}</p>
        <button type="button" class="btn btn-outline btn-sm mt-3" onclick={retry}
          >{retryLabel}</button
        >
      </div>
    {:else if groups.length === 0}
      <div class="content-card-inset rounded-xl p-6 text-center text-sm opacity-70">
        {unavailableLabel}
      </div>
    {:else}
      <div
        role="tablist"
        aria-label={title}
        class="tabs tabs-box content-card-inset grid w-full gap-1 p-1"
        style={`grid-template-columns: repeat(${groups.length}, 1fr)`}
      >
        {#each groups as [rarity] (rarity)}
          {@const tabId = getRarityTabId(rarity)}
          {@const panelId = getRarityPanelId(rarity)}
          <button
            type="button"
            id={tabId}
            role="tab"
            aria-selected={activeRarity === rarity}
            aria-controls={panelId}
            tabindex={activeRarity === rarity ? 0 : -1}
            class={`tab min-w-0 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs sm:text-sm ${activeRarity === rarity ? "bg-primary text-primary-content" : ""}`}
            onclick={() => (activeRarity = rarity)}
            onkeydown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                const index = groups.findIndex(([key]) => key === rarity);
                const next = groups[(index + 1) % groups.length]?.[0];
                if (next) void focusRarityTab(next);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                const index = groups.findIndex(([key]) => key === rarity);
                const previous = groups[(index - 1 + groups.length) % groups.length]?.[0];
                if (previous) void focusRarityTab(previous);
              }
            }}>{getRarityDisplay(rarity)}</button
          >
        {/each}
      </div>
      {#each groups as [rarity] (rarity)}
        <div
          id={getRarityPanelId(rarity)}
          role="tabpanel"
          aria-labelledby={getRarityTabId(rarity)}
          tabindex="0"
          hidden={activeRarity !== rarity}
          class="min-h-0 overflow-y-auto pr-1"
        >
          <div class="grid gap-3">
            {#if activeRarity === rarity}
              {#each groupedVisibleCards as group (group.key)}
                {@const isExpanded = expandedGroups[group.key] ?? false}
                {@const visibleItems = isExpanded
                  ? group.cards
                  : group.cards.slice(0, PROBABILITY_GROUP_INITIAL_LIMIT)}
                {@const hiddenCount = group.cards.length - PROBABILITY_GROUP_INITIAL_LIMIT}
                <div>
                  <div class="mb-1.5 flex items-center gap-2 px-1">
                    <span class="text-xs font-semibold opacity-70">{group.label}</span>
                    <span class="text-[0.65rem] opacity-40">({group.cards.length})</span>
                  </div>
                  <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-10">
                    {#each visibleItems as card, index (`${card.cardId ?? "unknown"}-${card.isWish}-${index}`)}
                      {#if card.cardId}
                        <a
                          href={resolve("/card/[region]/[id]", { region, id: card.cardId })}
                          target="_blank"
                          rel="noopener"
                          class="group block"
                        >
                          <CardThumbnail
                            {...getCardThumbnailPresentation(card, region)}
                            alt={card.title
                              ? `${card.title} ${cardAltSuffix}`
                              : (card.cardId ?? unavailableLabel)}
                            fallbackLabel={card.cardId ?? unavailableLabel}
                            attr={card.attr}
                            rarityType={card.rarityType}
                            rarityCount={card.rarityType === "rarity_birthday"
                              ? 1
                              : getRarityValue(card.rarityType)}
                            showFrame={true}
                            showIcons={true}
                            loadMode="visible"
                            containerClass="relative aspect-square overflow-hidden rounded-lg"
                            imageClass="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                        </a>
                      {:else}
                        <CardThumbnail
                          src={null}
                          alt={unavailableLabel}
                          fallbackLabel={unavailableLabel}
                          containerClass="relative aspect-square overflow-hidden rounded-lg"
                          imageClass="size-full object-cover"
                        />
                      {/if}
                    {/each}
                  </div>
                  {#if !isExpanded && hiddenCount > 0}
                    <button
                      type="button"
                      class="link link-hover mt-1.5 inline-flex items-center gap-0.5 px-1 text-xs opacity-60"
                      onclick={() => (expandedGroups = { ...expandedGroups, [group.key]: true })}
                    >
                      <Icon icon="mdi:chevron-down" class="size-3.5" aria-hidden="true" />
                      {hiddenCount} more
                    </button>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label={closeLabel}>{closeLabel}</button>
  </form>
</dialog>
