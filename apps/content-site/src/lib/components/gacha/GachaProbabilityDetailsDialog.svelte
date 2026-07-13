<script lang="ts">
  import { resolve } from "$app/paths";
  import { base } from "$app/paths";
  import { getCardThumbnailAssetURL } from "$lib/assets/index";
  import type { GachaProbabilityCard } from "$lib/domain/gacha-probability";
  import type { SupportedRegion } from "$lib/domain/regions";
  import CardThumbnail from "$lib/components/card/CardThumbnail.svelte";
  import Icon from "@iconify/svelte";
  import { tick } from "svelte";

  type ProbabilityPayload = { cards: GachaProbabilityCard[] };
  type LoadState = "idle" | "loading" | "success" | "failure";

  let {
    region,
    gachaId,
    openLabel,
    title,
    closeLabel,
    disclaimer,
    normalLabel,
    wishLabel,
    unavailableLabel,
    loadingLabel,
    loadFailedLabel,
    retryLabel,
    conditionalLabel,
    cardIdLabel,
    cardAltSuffix,
    rarityLabels,
    diagnosticLabels
  }: {
    region: SupportedRegion;
    gachaId: string;
    openLabel: string;
    title: string;
    closeLabel: string;
    disclaimer: string;
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
    diagnosticLabels: Record<string, string>;
  } = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  let cards = $state<GachaProbabilityCard[]>([]);
  let loadState = $state<LoadState>("idle");
  let activeRarity = $state("");
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
  const getRarityTabId = (rarity: string): string =>
    `gacha-probability-tab-${getIdPart(region)}-${getIdPart(gachaId)}-${getIdPart(rarity)}`;
  const getRarityPanelId = (rarity: string): string =>
    `gacha-probability-panel-${getIdPart(region)}-${getIdPart(gachaId)}-${getIdPart(rarity)}`;

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

<button
  type="button"
  class="btn btn-outline btn-primary btn-sm mt-1 gap-1.5 self-start shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-md"
  onclick={open}
>
  <Icon icon="mdi:chart-box-outline" class="size-4" aria-hidden="true" />{openLabel}
</button>

<dialog bind:this={dialog} class="modal" aria-labelledby="gacha-probability-title">
  <div class="modal-box flex max-h-[min(90vh,52rem)] w-11/12 max-w-5xl flex-col gap-4 p-4 sm:p-6">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 id="gacha-probability-title" class="text-xl font-bold">{title}</h2>
        <p class="mt-1 text-xs/5 opacity-65">{disclaimer}</p>
      </div>
      <button type="button" class="btn btn-circle btn-ghost btn-sm" aria-label={closeLabel} onclick={close}>
        <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
      </button>
    </div>

    {#if loadState === "loading"}
      <div class="content-card-inset flex items-center justify-center gap-2 rounded-xl p-6 text-sm opacity-70">
        <span class="loading loading-spinner loading-sm"></span>{loadingLabel}
      </div>
    {:else if loadState === "failure"}
      <div class="content-card-inset rounded-xl p-6 text-center text-sm text-error/80">
        <p>{loadFailedLabel}</p>
        <button type="button" class="btn btn-outline btn-sm mt-3" onclick={retry}>{retryLabel}</button>
      </div>
    {:else if groups.length === 0}
      <div class="content-card-inset rounded-xl p-6 text-center text-sm opacity-70">{unavailableLabel}</div>
    {:else}
      <div role="tablist" aria-label={title} class="tabs tabs-box content-card-inset flex w-full flex-wrap gap-1 p-1">
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
            class={`tab min-w-16 shrink-0 whitespace-nowrap rounded-lg px-3 ${activeRarity === rarity ? "bg-primary text-primary-content" : ""}`}
            onclick={() => activeRarity = rarity}
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
            }}
          >{rarityLabels[rarity] ?? rarity}</button>
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
          <div class="grid gap-2 sm:grid-cols-2">
            {#if activeRarity === rarity}
              {#each visibleCards as card, index (`${card.cardId ?? "unknown"}-${card.isWish}-${index}`)}
                {@const segment = card.isWish === true ? wishLabel : card.isWish === false ? normalLabel : unavailableLabel}
                {@const conditionalSegments = card.probabilitySegments.filter((item) => item.conditional)}
                <div class="content-card-inset grid grid-cols-[3.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl p-2.5">
                  <CardThumbnail
                    src={card.assetBundleName ? getCardThumbnailAssetURL(card.assetBundleName, false, "jp") : null}
                    fallbackSrc={card.assetBundleName && region !== "jp" ? getCardThumbnailAssetURL(card.assetBundleName, false, region) : null}
                    alt={card.title ? `${card.title} ${cardAltSuffix}` : card.cardId ?? unavailableLabel}
                    fallbackLabel={card.cardId ?? unavailableLabel}
                    rarityType={card.rarityType}
                    rarityCount={card.rarityType === "rarity_birthday" ? 1 : 0}
                    maxSize={60}
                    loadMode="visible"
                    containerClass="relative aspect-square overflow-hidden rounded-lg"
                    imageClass="size-full object-cover"
                  />
                  <div class="min-w-0">
                    {#if card.cardId}
                      <a class="link link-hover block truncate text-sm font-semibold" href={resolve("/card/[region]/[id]", { region, id: card.cardId })}>{card.title ?? card.cardId}</a>
                    {:else}
                      <span class="block truncate text-sm font-semibold">{card.title ?? unavailableLabel}</span>
                    {/if}
                    <div class="mt-0.5 flex flex-wrap gap-x-2 text-[0.68rem] opacity-60">
                      <span>{cardIdLabel}: {card.cardId ?? unavailableLabel}</span><span>{segment}</span>
                      {#if conditionalSegments.length > 0}<span>{conditionalLabel}</span>{/if}
                    </div>
                  </div>
                  <div class="text-right text-xs font-mono tabular-nums">
                    {#if conditionalSegments.length > 0}
                      {#each conditionalSegments as item (item.lotteryType)}
                        <div class="font-semibold">{probability(item.probability)}</div>
                      {/each}
                    {:else}
                      <span class={card.probability === null ? "max-w-20 whitespace-normal text-error/80" : "font-semibold"}>{card.probability === null ? diagnosticLabels[card.diagnostic] ?? unavailableLabel : probability(card.probability)}</span>
                    {/if}
                  </div>
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
  <form method="dialog" class="modal-backdrop"><button aria-label={closeLabel}>{closeLabel}</button></form>
</dialog>
