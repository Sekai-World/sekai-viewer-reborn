<script lang="ts">
  import Icon from "@iconify/svelte";

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
    dialogImageClass = "h-auto max-h-[88vh] w-auto max-w-full object-contain"
  }: Props = $props();

  let dialog: HTMLDialogElement | null = $state(null);
  let dialogImageLoaded = $state(false);
  let dialogImageFailed = $state(false);
  type ImagePhase = "primary" | "fallback";
  let requestToken = $state<symbol>(Symbol());
  let phase = $state<ImagePhase>("primary");
  let attempt = $state(0);
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  type RetryProbe = {
    token: symbol;
    resource: string;
    imagePhase: ImagePhase;
    retryAttempt: number;
    controller: AbortController;
    timeout: ReturnType<typeof setTimeout>;
  };
  let retryProbe: RetryProbe | null = null;
  let lastSource: { primary: string; fallback: string | undefined } | null = null;

  const retryDelays = [300, 900] as const;
  const retryProbeTimeout = 1000;

  const appendRetryCacheBust = (
    source: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): string => {
    const hashIndex = source.indexOf("#");
    const sourceWithoutHash = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
    const hash = hashIndex >= 0 ? source.slice(hashIndex) : "";
    const separator = sourceWithoutHash.includes("?") ? "&" : "?";
    return `${sourceWithoutHash}${separator}__preview_retry=${imagePhase}-${retryAttempt}${hash}`;
  };

  const currentSrc = $derived(phase === "fallback" && fallbackSrc ? fallbackSrc : src);
  const requestSrc = $derived(
    attempt === 0 ? currentSrc : appendRetryCacheBust(currentSrc, phase, attempt)
  );
  const imageRequestKey = $derived([requestToken, phase, attempt]);

  const clearRetryTimer = (): void => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const clearRetryProbe = (): void => {
    if (retryProbe !== null) {
      clearTimeout(retryProbe.timeout);
      retryProbe.controller.abort();
      retryProbe = null;
    }
  };

  const clearRetryWork = (): void => {
    clearRetryTimer();
    clearRetryProbe();
  };

  const isCurrentRequest = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): boolean =>
    requestToken === token &&
    currentSrc === resource &&
    phase === imagePhase &&
    attempt === retryAttempt;

  const handleImageLoad = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (!isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
      return;
    }

    clearRetryWork();
    dialogImageLoaded = true;
    dialogImageFailed = false;
  };

  const exhaustImagePhase = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (!isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
      return;
    }

    clearRetryWork();

    if (imagePhase === "primary" && fallbackSrc && fallbackSrc !== resource) {
      phase = "fallback";
      attempt = 0;
      dialogImageLoaded = false;
      dialogImageFailed = false;
      return;
    }

    dialogImageLoaded = true;
    dialogImageFailed = true;
  };

  const isSameOriginResource = (resource: string): boolean => {
    if (typeof window === "undefined") {
      return false;
    }

    try {
      const url = new URL(resource, window.location.href);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        url.origin === window.location.origin
      );
    } catch {
      return false;
    }
  };

  const probeCanonicalResource = async (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): Promise<void> => {
    if (!isSameOriginResource(resource)) {
      return;
    }

    if (retryProbe !== null) {
      if (
        retryProbe.token === token &&
        retryProbe.resource === resource &&
        retryProbe.imagePhase === imagePhase &&
        retryProbe.retryAttempt === retryAttempt
      ) {
        return;
      }
      clearRetryProbe();
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, retryProbeTimeout);
    const activeProbe: RetryProbe = {
      token,
      resource,
      imagePhase,
      retryAttempt,
      controller,
      timeout
    };
    retryProbe = activeProbe;

    try {
      const response = await fetch(resource, {
        method: "HEAD",
        credentials: "same-origin",
        signal: controller.signal,
        cache: "no-store"
      });

      if (
        response.status === 404 &&
        retryProbe === activeProbe &&
        isCurrentRequest(token, resource, imagePhase, retryAttempt)
      ) {
        exhaustImagePhase(token, resource, imagePhase, retryAttempt);
      }
    } catch {
      // Probe failures fall through to the regular retry below.
    } finally {
      const isActiveProbe = retryProbe === activeProbe;
      clearTimeout(activeProbe.timeout);
      if (isActiveProbe) {
        retryProbe = null;
      }

      if (
        isActiveProbe &&
        (timedOut || !controller.signal.aborted) &&
        isCurrentRequest(token, resource, imagePhase, retryAttempt)
      ) {
        scheduleRetry(token, resource, imagePhase, retryAttempt);
      }
    }
  };

  const scheduleRetry = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (!isCurrentRequest(token, resource, imagePhase, retryAttempt) || retryTimer !== null) {
      return;
    }

    const nextAttempt = retryAttempt + 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
        clearRetryProbe();
        attempt = nextAttempt;
      }
    }, retryDelays[retryAttempt]);
  };

  const handleImageError = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (!isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
      return;
    }

    if (retryAttempt === 0) {
      if (!isSameOriginResource(resource)) {
        scheduleRetry(token, resource, imagePhase, retryAttempt);
        return;
      }

      if (retryProbe === null) {
        void probeCanonicalResource(token, resource, imagePhase, retryAttempt);
      }
      return;
    }

    if (retryAttempt === 1) {
      scheduleRetry(token, resource, imagePhase, retryAttempt);
      return;
    }

    exhaustImagePhase(token, resource, imagePhase, retryAttempt);
  };

  const normalizedFormatOptions = $derived(
    Array.from(new Set(formatOptions.map((format) => format.trim().toLowerCase()).filter(Boolean)))
  );
  const hasDownloadFormatOptions = $derived(normalizedFormatOptions.length > 0);
  const replaceSrcExtension = (value: string, extension: string): string =>
    value.replace(/(\.[a-z0-9]+)(?=([?#].*)?$)/i, `.${extension}`);
  const getDownloadSrc = (format: string): string => replaceSrcExtension(currentSrc, format);

  $effect.pre(() => {
    const nextSource = { primary: src, fallback: fallbackSrc };

    if (lastSource === null) {
      lastSource = nextSource;
    } else if (
      lastSource.primary !== nextSource.primary ||
      lastSource.fallback !== nextSource.fallback
    ) {
      lastSource = nextSource;
      requestToken = Symbol();
      phase = "primary";
      attempt = 0;
      dialogImageLoaded = false;
      dialogImageFailed = false;
    }

    return () => {
      clearRetryWork();
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
      {#if !dialogImageFailed}
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
      {#if !dialogImageLoaded && !dialogImageFailed}
        <div
          class="absolute inset-0 flex items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(0,0,0,0.18))]"
        >
          <span
            class="loading loading-spinner loading-lg text-base-100 drop-shadow-sm"
            aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#if dialogImageFailed}
        <div
          class="flex min-h-[40vh] w-[min(70vw,32rem)] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-base-content/15 bg-base-200/40 px-8 py-10 text-center text-base text-base-content/70"
        >
          <Icon icon="mdi:file-remove-outline" class="size-12 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <p class="font-medium">{fallbackLabel}</p>
          {/if}
        </div>
      {/if}
      {#key imageRequestKey}
        {@const requestTokenSnapshot = requestToken}
        {@const requestResource = currentSrc}
        {@const requestPhase = phase}
        {@const requestAttempt = attempt}
        <img
          src={requestSrc}
          {alt}
          class={`${dialogImageClass} transition-[opacity,transform] duration-300 ease-out ${dialogImageLoaded && !dialogImageFailed ? "scale-100 opacity-100" : "scale-[1.01] opacity-0"} ${dialogImageFailed ? "pointer-events-none sr-only" : ""}`}
          onload={() =>
            handleImageLoad(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
          onerror={() =>
            handleImageError(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
        />
      {/key}
    </div>
  </div>

  <form method="dialog" class="modal-backdrop">
    <button type="submit">{closeLabel}</button>
  </form>
</dialog>
