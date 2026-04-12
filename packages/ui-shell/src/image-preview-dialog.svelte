<script lang="ts">
  import Icon from "@iconify/svelte";

  type Props = {
    open?: boolean;
    src: string;
    alt?: string;
    fallbackLabel?: string;
    closeLabel?: string;
    downloadLabel?: string;
    openInNewWindowLabel?: string;
    formatOptions?: string[];
    currentFormat?: string;
    dialogBoxClass?: string;
    dialogImageClass?: string;
    onFormatChange?: (format: string) => void;
  };

  let {
    open = $bindable(false),
    src,
    alt = "",
    fallbackLabel = "",
    closeLabel = "Close",
    downloadLabel = "Download",
    openInNewWindowLabel = "Open in new window",
    formatOptions = [],
    currentFormat = "",
    dialogBoxClass = "relative flex max-w-[min(96vw,1800px)] items-center justify-center overflow-hidden bg-base-100/96 p-2 md:p-4",
    dialogImageClass = "h-auto max-h-[88vh] w-auto max-w-full object-contain",
    onFormatChange = () => {}
  }: Props = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  let dialogImageLoaded = $state(false);
  let dialogImageFailed = $state(false);

  $effect(() => {
    src;
    dialogImageLoaded = false;
    dialogImageFailed = false;
  });

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
    {#if formatOptions.length > 0 && !dialogImageFailed}
      <div class="absolute left-3 top-3 z-10 inline-flex rounded-full border border-base-content/10 bg-base-100/90 p-1 shadow-sm">
        {#each formatOptions as format (format)}
          <button
            type="button"
            class={`rounded-full px-3 py-1 text-xs font-semibold tracking-wide transition ${
              currentFormat === format
                ? "bg-primary text-primary-content shadow-sm"
                : "text-base-content/70"
            }`}
            onclick={() => {
              onFormatChange(format);
            }}
          >
            {format.toUpperCase()}
          </button>
        {/each}
      </div>
    {/if}

    <div class="absolute right-3 top-3 z-10 flex items-center justify-end gap-2">
      {#if !dialogImageFailed}
        <a
          href={src}
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
            class="h-4 w-4"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
          </svg>
        </a>
        <a
          href={src}
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
            class="h-4 w-4"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M14 5h5v5m0-5-7 7M10 7H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-3" />
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
      {#if !dialogImageLoaded && !dialogImageFailed}
        <div class="absolute inset-0 flex items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0.18))]">
          <span class="loading loading-spinner loading-lg text-base-100 drop-shadow-sm" aria-hidden="true"></span>
        </div>
      {/if}
      {#if dialogImageFailed}
        <div class="flex min-h-[40vh] w-[min(70vw,32rem)] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-base-content/15 bg-base-200/40 px-8 py-10 text-center text-base text-base-content/70">
          <Icon icon="mdi:file-remove-outline" class="h-12 w-12 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <p class="font-medium">{fallbackLabel}</p>
          {/if}
        </div>
      {/if}
      <img
        src={src}
        alt={alt}
        class={`${dialogImageClass} transition-all duration-300 ease-out ${dialogImageLoaded && !dialogImageFailed ? "scale-100 opacity-100" : "scale-[1.01] opacity-0"} ${dialogImageFailed ? "pointer-events-none sr-only" : ""}`}
        onload={() => {
          dialogImageLoaded = true;
          dialogImageFailed = false;
        }}
        onerror={() => {
          dialogImageLoaded = true;
          dialogImageFailed = true;
        }}
      />
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
