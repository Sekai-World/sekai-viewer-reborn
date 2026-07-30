<script lang="ts">
  import Icon from "@iconify/svelte";
  import { ImagePreviewTrigger } from "@platform/ui-shell";

  let {
    src,
    fallbackSrc,
    alt = "",
    fallbackLabel = "",
    imageClass = "h-full w-full object-contain",
    buttonClass = "block w-full overflow-hidden",
    loadMode = "immediate",
    interactive = false,
    onclick
  }: {
    src: string;
    fallbackSrc?: string;
    alt?: string;
    fallbackLabel?: string;
    imageClass?: string;
    buttonClass?: string;
    loadMode?: "immediate" | "visible";
    interactive?: boolean;
    onclick?: () => void;
  } = $props();

  let previewImageLoaded = $state(false);
  let previewImageFailed = $state(false);
  let imageVisible = $state(false);
  let observedNode: HTMLDivElement | null = $state(null);
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
  let previousSourceKey: string | null = null;

  const retryDelays = [300, 900] as const;
  const retryProbeTimeoutMs = 1000;

  const appendRetryCacheBust = (
    source: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): string => {
    const hashIndex = source.indexOf("#");
    const sourceWithoutHash = hashIndex >= 0 ? source.slice(0, hashIndex) : source;
    const hash = hashIndex >= 0 ? source.slice(hashIndex) : "";
    const separator = sourceWithoutHash.includes("?") ? "&" : "?";
    return `${sourceWithoutHash}${separator}__asset_retry=${imagePhase}-${retryAttempt}${hash}`;
  };

  const currentSrc = $derived(phase === "fallback" && fallbackSrc ? fallbackSrc : src);
  const requestSrc = $derived(
    attempt === 0 ? currentSrc : appendRetryCacheBust(currentSrc, phase, attempt)
  );
  const imageRequestKey = $derived([requestToken, phase, attempt]);
  const shouldRenderImage = $derived(loadMode === "immediate" || imageVisible);

  const interactiveButtonClass = $derived(
    interactive ? `${buttonClass} cursor-zoom-in` : buttonClass
  );

  const clearRetryTimer = (): void => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const clearRetryProbe = (probe?: RetryProbe): void => {
    const activeProbe = retryProbe;
    if (activeProbe === null || (probe !== undefined && activeProbe !== probe)) {
      return;
    }

    retryProbe = null;
    clearTimeout(activeProbe.timeout);
    activeProbe.controller.abort();
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

  const scheduleRetry = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (retryTimer !== null) {
      return;
    }

    const nextAttempt = retryAttempt + 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
        attempt = nextAttempt;
      }
    }, retryDelays[retryAttempt]);
  };

  const applyPostExhaustion = (resource: string, imagePhase: ImagePhase): void => {
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

  const canProbeResource = (resource: string): boolean => {
    if (
      typeof window === "undefined" ||
      typeof fetch !== "function" ||
      typeof AbortController === "undefined"
    ) {
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

  const probeResourceBeforeRetry = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (!canProbeResource(resource)) {
      scheduleRetry(token, resource, imagePhase, retryAttempt);
      return;
    }

    const controller = new AbortController();
    const probe: RetryProbe = {
      token,
      resource,
      imagePhase,
      retryAttempt,
      controller,
      timeout: setTimeout(() => {
        if (retryProbe !== probe) {
          return;
        }

        clearRetryProbe(probe);
        if (isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
          scheduleRetry(token, resource, imagePhase, retryAttempt);
        }
      }, retryProbeTimeoutMs)
    };
    retryProbe = probe;

    void fetch(resource, {
      method: "HEAD",
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store"
    })
      .then((response) => {
        if (retryProbe !== probe || !isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
          return;
        }

        const isNotFound = response.status === 404;
        clearRetryProbe(probe);
        if (!isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
          return;
        }

        if (isNotFound) {
          applyPostExhaustion(resource, imagePhase);
        } else {
          scheduleRetry(token, resource, imagePhase, retryAttempt);
        }
      })
      .catch(() => {
        if (retryProbe !== probe) {
          return;
        }

        clearRetryProbe(probe);
        if (isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
          scheduleRetry(token, resource, imagePhase, retryAttempt);
        }
      });
  };

  const handleImageLoad = (
    token: symbol,
    resource: string,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (!isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
      return;
    }

    clearRetryTimer();
    clearRetryProbe();
    previewImageLoaded = true;
    previewImageFailed = false;
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

    if (retryAttempt < retryDelays.length) {
      if (retryTimer !== null || retryProbe !== null) {
        return;
      }

      if (retryAttempt === 0) {
        probeResourceBeforeRetry(token, resource, imagePhase, retryAttempt);
      } else {
        scheduleRetry(token, resource, imagePhase, retryAttempt);
      }
      return;
    }

    applyPostExhaustion(resource, imagePhase);
  };

  $effect.pre(() => {
    const sourceKey = `${src}\0${fallbackSrc ?? ""}\0${loadMode}`;

    if (previousSourceKey === null) {
      previousSourceKey = sourceKey;
    } else if (previousSourceKey !== sourceKey) {
      previousSourceKey = sourceKey;
      clearRetryProbe();
      requestToken = Symbol();
      phase = "primary";
      attempt = 0;
      previewImageLoaded = false;
      previewImageFailed = false;
      imageVisible = loadMode === "immediate";
    }

    return () => {
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      clearRetryProbe();
    };
  });

  $effect(() => {
    if (loadMode !== "visible" || imageVisible || !observedNode) {
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      imageVisible = true;
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          imageVisible = true;
          observer.disconnect();
        }
      },
      { threshold: 0.01 }
    );

    observer.observe(observedNode);

    return () => {
      observer.disconnect();
    };
  });
</script>

{#if interactive}
  <ImagePreviewTrigger
    {src}
    {fallbackSrc}
    {alt}
    {fallbackLabel}
    ariaLabel={alt || fallbackLabel}
    buttonClass={interactiveButtonClass}
    {imageClass}
    {onclick}
  />
{:else}
  <div class={buttonClass}>
    <div class="relative size-full overflow-hidden" bind:this={observedNode}>
      {#if !shouldRenderImage || (!previewImageLoaded && !previewImageFailed)}
        <div
          class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
        >
          <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
          ></span>
        </div>
      {/if}
      {#if previewImageFailed}
        <div
          class="flex size-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
        >
          <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
          {#if fallbackLabel}
            <span class="font-medium">{fallbackLabel}</span>
          {/if}
        </div>
      {/if}
      {#if shouldRenderImage}
        {#key imageRequestKey}
          {@const requestTokenSnapshot = requestToken}
          {@const requestResource = currentSrc}
          {@const requestPhase = phase}
          {@const requestAttempt = attempt}
          <img
            src={requestSrc}
            {alt}
            loading="eager"
            decoding="async"
            class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${previewImageLoaded && !previewImageFailed ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"} ${previewImageFailed ? "pointer-events-none sr-only" : ""}`}
            onload={() =>
              handleImageLoad(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
            onerror={() =>
              handleImageError(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
          />
        {/key}
      {/if}
    </div>
  </div>
{/if}
