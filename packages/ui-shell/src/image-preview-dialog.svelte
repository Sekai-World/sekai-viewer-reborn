<script lang="ts">
  import Icon from "@iconify/svelte";
  import { onDestroy, untrack } from "svelte";
  import {
    ImageRetryController,
    STATIC_ASSET_RETRY_POLICY,
    type ImageRetryPolicy
  } from "./image-retry/index";

  type Props = {
    open?: boolean;
    src: string;
    fallbackSrc?: string;
    alt?: string;
    fallbackLabel?: string;
    closeLabel?: string;
    downloadLabel?: string;
    openInNewWindowLabel?: string;
    formatOptions?: string[];
    dialogBoxClass?: string;
    dialogImageClass?: string;
    retryPolicy?: ImageRetryPolicy;
  };

  let {
    open = $bindable(false),
    src,
    fallbackSrc,
    alt = "",
    fallbackLabel = "",
    closeLabel = "Close",
    downloadLabel = "Download",
    openInNewWindowLabel = "Open in new window",
    formatOptions = [],
    dialogBoxClass = "relative flex max-w-[min(96vw,1800px)] items-center justify-center overflow-hidden rounded-2xl bg-base-100/96 p-2 md:p-4",
    dialogImageClass = "h-auto max-h-[88vh] w-auto max-w-full object-contain",
    retryPolicy = STATIC_ASSET_RETRY_POLICY
  }: Props = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  // Seed the controller for the initial render without making construction the
  // source of reactivity; the pre-effect keeps it synchronized thereafter.
  const imageRetry = untrack(() => new ImageRetryController(src, fallbackSrc, retryPolicy));

  $effect.pre(() => {
    imageRetry.setSources(src, fallbackSrc, retryPolicy);
  });

  onDestroy(() => imageRetry.dispose());

  const normalizedFormatOptions = $derived(
    Array.from(new Set(formatOptions.map((format) => format.trim().toLowerCase()).filter(Boolean)))
  );
  const hasDownloadFormatOptions = $derived(normalizedFormatOptions.length > 0);
  const replaceSrcExtension = (value: string, extension: string): string =>
    value.replace(/(\.[a-z0-9]+)(?=([?#].*)?$)/i, `.${extension}`);
  const currentSrc = $derived(imageRetry.currentSrc);
  const getDownloadSrc = (format: string): string => replaceSrcExtension(currentSrc, format);

  $effect(() => {
    if (!dialog) {
      return;
    }

    if (open) {
      if (!dialog.open) {
        dialog.showModal();
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  });
</script>

<dialog
  bind:this={dialog}
  class="modal"
  onclose={() => {
    open = false;
  }}
>
  <div class={`modal-box ${dialogBoxClass}`}>
    <div class="absolute right-3 top-3 z-10 flex items-center justify-end gap-2">
      {#if !imageRetry.imageFailed}
        {#if hasDownloadFormatOptions}
          <details class="dropdown dropdown-end">
            <summary
              class="btn btn-circle btn-sm border-base-content/10 bg-base-100/90 shadow-sm"
              aria-label={downloadLabel}
              title={downloadLabel}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                class="size-4"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"
                />
              </svg>
            </summary>
            <ul
              class="menu dropdown-content z-20 mt-2 min-w-28 rounded-box border border-base-content/10 bg-base-100/95 p-1 text-sm shadow-lg"
            >
              {#each normalizedFormatOptions as format (format)}
                <li>
                  <a
                    href={getDownloadSrc(format)}
                    download
                    aria-label={`${downloadLabel} ${format.toUpperCase()}`}
                  >
                    {format.toUpperCase()}
                  </a>
                </li>
              {/each}
            </ul>
          </details>
        {:else}
          <a
            href={currentSrc}
            download
            class="btn btn-circle btn-sm border-base-content/10 bg-base-100/90 shadow-sm"
            aria-label={downloadLabel}
            title={downloadLabel}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              class="size-4"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"
              />
            </svg>
          </a>
        {/if}
        <a
          href={currentSrc}
          target="_blank"
          rel="noreferrer"
          class="btn btn-circle btn-sm border-base-content/10 bg-base-100/90 shadow-sm"
          aria-label={openInNewWindowLabel}
          title={openInNewWindowLabel}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            class="size-4"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14 5h5v5m0-5-7 7M10 7H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3"
            />
          </svg>
        </a>
      {/if}
      <form method="dialog">
        <button
          type="submit"
          class="btn btn-circle btn-sm border-base-content/10 bg-base-100/90 shadow-sm"
          aria-label={closeLabel}
          title={closeLabel}
        >
          ✕
        </button>
      </form>
    </div>

    <div class="relative flex items-center justify-center">
      {#if !imageRetry.imageLoaded && !imageRetry.imageFailed}
        <div
          class="absolute inset-0 flex items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0.18))]"
        >
          <span
            class="loading loading-spinner loading-lg text-base-100 drop-shadow-sm"
            aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#if imageRetry.imageFailed}
        <div
          class="flex min-h-[40vh] w-[min(70vw,32rem)] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-base-content/15 bg-base-200/40 px-8 py-10 text-center text-base text-base-content/70"
        >
          <Icon icon="mdi:file-remove-outline" class="size-12 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <p class="font-medium">{fallbackLabel}</p>
          {/if}
        </div>
      {/if}
      {#key imageRetry.requestKey}
        {@const requestSnapshot = imageRetry.requestSnapshot}
        <img
          src={imageRetry.requestUrl}
          {alt}
          class={`${dialogImageClass} transition-[opacity,transform] duration-300 ease-out ${imageRetry.imageLoaded && !imageRetry.imageFailed ? "scale-100 opacity-100" : "scale-[1.01] opacity-0"} ${imageRetry.imageFailed ? "pointer-events-none sr-only" : ""}`}
          onload={() => requestSnapshot && imageRetry.handleImageLoad(requestSnapshot)}
          onerror={() => requestSnapshot && imageRetry.handleImageError(requestSnapshot)}
        />
      {/key}
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
