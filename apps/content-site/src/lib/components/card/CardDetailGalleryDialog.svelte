<script lang="ts">
  import {
    getCardCutoutAssetURL,
    getCardCutoutTrimmedAssetURL,
    getCardFullAssetURL,
    getCardGachaAssetURL,
    getCardSmallAssetURL,
    getCardThumbnailAssetURL
  } from "$lib/assets/index";
  import type { CardDetail } from "$lib/domain/card-detail";
  import Icon from "@iconify/svelte";
  import { untrack } from "svelte";

  type GalleryAssetKind = "thumbnail" | "small" | "full" | "cutout" | "cutoutTrimmed" | "gacha";
  type ImageAssetStatus = "loading" | "available" | "unavailable";
  type ProbeStatus = "idle" | "loading" | "complete";

  type GalleryAssetDefinition = {
    kind: GalleryAssetKind;
    label: string;
    getUrl: (assetBundleName: string, trained: boolean) => string;
  };

  type GalleryAsset = GalleryAssetDefinition & {
    key: string;
    trained: boolean;
    stateLabel: string;
    url: string;
  };

  let {
    card,
    open = $bindable(false),
    title,
    description,
    closeLabel,
    normalLabel,
    trainedLabel,
    loadingLabel,
    unavailableLabel,
    thumbnailLabel,
    smallLabel,
    fullLabel,
    cutoutLabel,
    cutoutTrimmedLabel,
    gachaLabel
  }: {
    card: CardDetail;
    open?: boolean;
    title: string;
    description: string;
    closeLabel: string;
    normalLabel: string;
    trainedLabel: string;
    loadingLabel: string;
    unavailableLabel: string;
    thumbnailLabel: string;
    smallLabel: string;
    fullLabel: string;
    cutoutLabel: string;
    cutoutTrimmedLabel: string;
    gachaLabel: string;
  } = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  let probeStatus = $state<ProbeStatus>("idle");
  let probeSignature = $state("");
  let headStatusByAsset = $state<Record<string, boolean>>({});
  let imageStatusByAsset = $state<Record<string, ImageAssetStatus>>({});
  let probeGeneration = $state(0);

  const isTrainableCard = (): boolean =>
    card.rarityType === "rarity_3" || card.rarityType === "rarity_4";
  const isTrainedOnlyCard = (): boolean =>
    card.initialSpecialTrainingStatus === "done" && isTrainableCard();

  const assetDefinitions = $derived.by<GalleryAssetDefinition[]>(() => [
    {
      kind: "thumbnail",
      label: thumbnailLabel,
      getUrl: (assetBundleName, trained) => getCardThumbnailAssetURL(assetBundleName, trained, "jp")
    },
    {
      kind: "small",
      label: smallLabel,
      getUrl: (assetBundleName, trained) => getCardSmallAssetURL(assetBundleName, trained, "jp")
    },
    {
      kind: "full",
      label: fullLabel,
      getUrl: (assetBundleName, trained) => getCardFullAssetURL(assetBundleName, trained, "jp")
    },
    {
      kind: "cutout",
      label: cutoutLabel,
      getUrl: (assetBundleName, trained) => getCardCutoutAssetURL(assetBundleName, trained, "jp")
    },
    {
      kind: "cutoutTrimmed",
      label: cutoutTrimmedLabel,
      getUrl: (assetBundleName, trained) =>
        getCardCutoutTrimmedAssetURL(assetBundleName, trained, "jp")
    },
    {
      kind: "gacha",
      label: gachaLabel,
      getUrl: (assetBundleName, trained) => getCardGachaAssetURL(assetBundleName, trained, "jp")
    }
  ]);

  const galleryAssets = $derived.by<GalleryAsset[]>(() => {
    const assetBundleName = card.assetBundleName;
    if (!assetBundleName) {
      return [];
    }

    const variants = isTrainedOnlyCard()
      ? [{ trained: true, stateLabel: trainedLabel }]
      : isTrainableCard()
        ? [
            { trained: false, stateLabel: normalLabel },
            { trained: true, stateLabel: trainedLabel }
          ]
        : [{ trained: false, stateLabel: normalLabel }];

    return assetDefinitions.flatMap((definition) =>
      variants.map(({ trained, stateLabel }) => ({
        ...definition,
        key: `${definition.kind}-${trained ? "trained" : "normal"}`,
        trained,
        stateLabel,
        url: definition.getUrl(assetBundleName, trained)
      }))
    );
  });
  const galleryAssetSignature = $derived(
    `${card.id}|${galleryAssets.map((asset) => `${asset.key}:${asset.url}`).join("|")}`
  );
  const isCurrentProbeComplete = $derived(
    open && probeStatus === "complete" && probeSignature === galleryAssetSignature
  );
  const headAvailableAssets = $derived(
    isCurrentProbeComplete
      ? galleryAssets.filter((asset) => headStatusByAsset[asset.key] === true)
      : []
  );
  const visibleAssets = $derived(
    headAvailableAssets.filter((asset) => imageStatusByAsset[asset.key] !== "unavailable")
  );
  const hasLoadingAssets = $derived(
    isCurrentProbeComplete &&
      headAvailableAssets.some(
        (asset) => (imageStatusByAsset[asset.key] ?? "loading") === "loading"
      )
  );
  const allAssetsUnavailable = $derived(
    isCurrentProbeComplete &&
      (headAvailableAssets.length === 0 ||
        headAvailableAssets.every((asset) => imageStatusByAsset[asset.key] === "unavailable"))
  );

  const setImageStatus = (
    key: string,
    status: ImageAssetStatus,
    generation: number,
    signature: string
  ): void => {
    if (
      generation !== probeGeneration ||
      probeStatus !== "complete" ||
      probeSignature !== signature
    ) {
      return;
    }

    imageStatusByAsset = { ...imageStatusByAsset, [key]: status };
  };

  $effect(() => {
    const assets = galleryAssets;
    const signature = galleryAssetSignature;

    if (!open || assets.length === 0) {
      probeStatus = "idle";
      probeSignature = "";
      headStatusByAsset = {};
      imageStatusByAsset = {};
      return;
    }

    const controller = new AbortController();
    const generation = untrack(() => probeGeneration) + 1;
    probeGeneration = generation;

    probeStatus = "loading";
    probeSignature = "";
    headStatusByAsset = {};
    imageStatusByAsset = {};

    void Promise.all(
      assets.map(async (asset) => {
        try {
          const response = await fetch(asset.url, { method: "HEAD", signal: controller.signal });
          return { key: asset.key, available: response.ok };
        } catch {
          return { key: asset.key, available: false };
        }
      })
    ).then((results) => {
      if (controller.signal.aborted || generation !== probeGeneration) {
        return;
      }

      headStatusByAsset = Object.fromEntries(results.map(({ key, available }) => [key, available]));
      probeSignature = signature;
      probeStatus = "complete";
    });

    return () => {
      controller.abort();
      if (probeGeneration === generation) {
        probeGeneration += 1;
      }
    };
  });

  $effect(() => {
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  class="modal"
  aria-labelledby="card-gallery-title"
  onclose={() => {
    open = false;
  }}
>
  <div
    class="modal-box flex max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-6xl flex-col overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-[calc(100%-2rem)]"
  >
    <header
      class="flex shrink-0 items-start justify-between gap-4 border-b border-base-content/10 p-4 sm:px-6"
    >
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{title}</p>
        <h2 id="card-gallery-title" class="mt-1 truncate text-lg font-semibold sm:text-xl">
          {card.title}
        </h2>
        <p class="mt-1 text-sm text-base-content/65">{description}</p>
      </div>
      <form method="dialog" class="shrink-0">
        <button
          type="submit"
          class="btn btn-circle btn-ghost btn-sm min-h-10! w-10!"
          aria-label={closeLabel}
          title={closeLabel}
        >
          <Icon icon="mdi:close" class="size-5" aria-hidden="true" />
        </button>
      </form>
    </header>

    <div class="min-h-0 overflow-y-auto p-3 sm:p-5">
      {#if !card.assetBundleName}
        <div
          class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-base-content/15 bg-base-200/40 px-6 text-center text-sm text-base-content/65"
        >
          <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
          <span class="font-medium">{unavailableLabel}</span>
        </div>
      {:else if open}
        {#if probeStatus === "loading" || !isCurrentProbeComplete}
          <div
            class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-base-content/15 bg-base-200/40 px-6 text-center text-sm text-base-content/65"
          >
            <span class="loading loading-spinner loading-md text-base-content/50"></span>
            <span class="font-medium">{loadingLabel}</span>
          </div>
        {:else if allAssetsUnavailable}
          <div
            class="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-base-content/15 bg-base-200/40 px-6 text-center text-sm text-base-content/65"
          >
            <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
            <span class="font-medium">{unavailableLabel}</span>
          </div>
        {:else}
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {#each visibleAssets as asset (asset.key)}
              {@const assetStatus = imageStatusByAsset[asset.key] ?? "loading"}
              {@const imageGeneration = probeGeneration}
              {@const imageProbeSignature = probeSignature}
              {#if assetStatus !== "unavailable"}
                <article
                  class="overflow-hidden rounded-2xl border border-base-content/10 bg-base-200/30 shadow-sm"
                >
                  <div
                    class={`relative flex aspect-16/10 items-center justify-center overflow-hidden bg-base-200/60 ${asset.kind === "full" ? "" : "p-3 sm:p-4"}`}
                  >
                    {#if assetStatus === "loading"}
                      <div
                        class="absolute inset-0 flex items-center justify-center"
                        aria-hidden="true"
                      >
                        <span class="loading loading-spinner loading-sm text-base-content/50"
                        ></span>
                      </div>
                    {/if}
                    <img
                      src={asset.url}
                      alt={`${card.title} — ${asset.label} — ${asset.stateLabel}`}
                      loading="lazy"
                      decoding="async"
                      class={`size-full transition-opacity duration-200 ${asset.kind === "full" ? "object-cover" : "object-contain"} ${assetStatus === "available" ? "opacity-100" : "opacity-0"}`}
                      onload={() =>
                        setImageStatus(
                          asset.key,
                          "available",
                          imageGeneration,
                          imageProbeSignature
                        )}
                      onerror={() =>
                        setImageStatus(
                          asset.key,
                          "unavailable",
                          imageGeneration,
                          imageProbeSignature
                        )}
                    />
                  </div>
                  <div
                    class="flex items-center justify-between gap-2 border-t border-base-content/10 px-3 py-2.5"
                  >
                    <span class="min-w-0 truncate text-sm font-medium">{asset.label}</span>
                    <span
                      class="badge badge-sm shrink-0 border-primary/25 bg-primary/10 text-primary"
                    >
                      {asset.stateLabel}
                    </span>
                  </div>
                </article>
              {/if}
            {/each}
          </div>
        {/if}
        {#if hasLoadingAssets && !allAssetsUnavailable}
          <p class="mt-4 text-center text-xs text-base-content/50">{loadingLabel}</p>
        {/if}
      {/if}
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
