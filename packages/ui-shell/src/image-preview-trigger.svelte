<script lang="ts">
  import Icon from "@iconify/svelte";
  import type { Snippet } from "svelte";

  type Props = {
    src: string;
    fallbackSrc?: string;
    alt?: string;
    fallbackLabel?: string;
    ariaLabel?: string;
    buttonClass?: string;
    imageClass?: string;
    disabled?: boolean;
    onclick?: () => void;
    children?: Snippet;
  };

  let {
    src,
    fallbackSrc,
    alt = "",
    fallbackLabel = "",
    ariaLabel = "",
    buttonClass = "block w-full cursor-zoom-in",
    imageClass = "h-auto max-h-full w-full object-contain",
    disabled = false,
    onclick,
    children
  }: Props = $props();

  let previewImageLoaded = $state(false);
  let previewImageFailed = $state(false);
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
    previewImageLoaded = true;
    previewImageFailed = false;
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
      previewImageLoaded = false;
      previewImageFailed = false;
      return;
    }

    previewImageLoaded = true;
    previewImageFailed = true;
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
        signal: controller.signal
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
      previewImageLoaded = false;
      previewImageFailed = false;
    }

    return () => {
      clearRetryWork();
    };
  });
</script>

<button
  type="button"
  class={`${buttonClass} ${disabled || previewImageFailed ? "cursor-default" : ""}`}
  {onclick}
  aria-label={previewImageFailed && fallbackLabel ? fallbackLabel : ariaLabel || alt}
  disabled={disabled || previewImageFailed}
>
  {#if children}
    {@render children()}
  {:else if !previewImageFailed}
    <div class="group relative size-full overflow-hidden">
      {#if !previewImageLoaded}
        <div
          class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
        >
          <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
          ></span>
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
          class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${previewImageLoaded ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"}`}
          onload={() =>
            handleImageLoad(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
          onerror={() =>
            handleImageError(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
        />
      {/key}
      {#if previewImageLoaded}
        <!-- magnifying glass overlay — bottom-right -->
        <span
          class="pointer-events-none absolute right-3 bottom-3 flex size-10 items-center justify-center rounded-full bg-base-100/60 text-base-content/70 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100 sm:opacity-0"
          aria-hidden="true"
        >
          <Icon icon="mdi:magnify-plus-outline" class="size-5" />
        </span>
      {/if}
    </div>
  {:else}
    <div
      class="flex size-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
    >
      <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
      {#if fallbackLabel}
        <span class="font-medium">{fallbackLabel}</span>
      {/if}
    </div>
  {/if}
</button>
