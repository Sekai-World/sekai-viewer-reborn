<script lang="ts">
  import { asset } from "$app/paths";
  import Icon from "@iconify/svelte";

  let {
    src,
    alt,
    fallbackLabel = "",
    fallbackSrc = null,
    trained = false,
    attr = null,
    rarityType = null,
    rarityCount = 0,
    loadMode = "visible",
    showFrame = true,
    showIcons = true,
    maxSize = 160,
    containerClass = "relative overflow-hidden rounded-xl bg-base-200 aspect-square",
    imageClass = "size-full object-cover"
  }: {
    src: string | null;
    alt: string;
    fallbackLabel?: string;
    fallbackSrc?: string | null;
    trained?: boolean;
    attr?: string | null;
    rarityType?: string | null;
    rarityCount?: number;
    loadMode?: "immediate" | "visible";
    showFrame?: boolean;
    showIcons?: boolean;
    maxSize?: number | null;
    containerClass?: string;
    imageClass?: string;
  } = $props();

  let imageLoaded = $state(false);
  let imageFailed = $state(false);
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
    return `${sourceWithoutHash}${separator}__thumbnail_retry=${imagePhase}-${retryAttempt}${hash}`;
  };

  const currentSrc = $derived(phase === "fallback" && fallbackSrc ? fallbackSrc : src);
  const requestSrc = $derived(
    currentSrc === null
      ? null
      : attempt === 0
        ? currentSrc
        : appendRetryCacheBust(currentSrc, phase, attempt)
  );
  const imageRequestKey = $derived([requestToken, phase, attempt]);
  const shouldRenderImage = $derived(loadMode === "immediate" || imageVisible);
  const resolvedRarityCount = $derived(
    rarityCount > 0 ? rarityCount : rarityType === "rarity_birthday" ? 1 : 0
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
    resource: string | null,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): boolean =>
    requestToken === token &&
    currentSrc === resource &&
    phase === imagePhase &&
    attempt === retryAttempt;

  const scheduleRetry = (
    token: symbol,
    resource: string | null,
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
      imageLoaded = false;
      imageFailed = false;
      return;
    }

    imageLoaded = true;
    imageFailed = true;
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
      credentials: "same-origin"
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
    resource: string | null,
    imagePhase: ImagePhase,
    retryAttempt: number
  ): void => {
    if (!isCurrentRequest(token, resource, imagePhase, retryAttempt)) {
      return;
    }

    clearRetryTimer();
    clearRetryProbe();
    imageLoaded = true;
    imageFailed = false;
  };

  const handleImageError = (
    token: symbol,
    resource: string | null,
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

      if (resource === null) {
        return;
      }

      if (retryAttempt === 0) {
        probeResourceBeforeRetry(token, resource, imagePhase, retryAttempt);
      } else {
        scheduleRetry(token, resource, imagePhase, retryAttempt);
      }
      return;
    }

    if (resource === null) {
      return;
    }

    applyPostExhaustion(resource, imagePhase);
  };

  $effect.pre(() => {
    const sourceKey = `${src ?? ""}\0${fallbackSrc ?? ""}\0${loadMode}`;

    if (previousSourceKey === null) {
      previousSourceKey = sourceKey;
    } else if (previousSourceKey !== sourceKey) {
      previousSourceKey = sourceKey;
      clearRetryProbe();
      requestToken = Symbol();
      phase = "primary";
      attempt = 0;
      imageLoaded = false;
      imageFailed = false;
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

  const getAttrIconUrl = (size: 64 | 88 = 88): string | null =>
    attr ? asset(`/card_attr/icon_attribute_${attr}_${size}.png`) : null;

  const getRarityIconUrl = (): string | null => {
    if (rarityType === "rarity_birthday") {
      return asset("/card_rarity/rarity_birthday.png");
    }

    if (resolvedRarityCount <= 0) {
      return null;
    }

    return asset(
      trained ? "/card_rarity/rarity_star_afterTraining.png" : "/card_rarity/rarity_star_normal.png"
    );
  };

  const getFrameUrl = (): string | null => {
    if (!showFrame) {
      return null;
    }

    const frameLevel = rarityType === "rarity_birthday" ? "bd" : String(resolvedRarityCount);
    if (frameLevel === "0") {
      return null;
    }

    return asset(`/card_frame/cardFrame_S_${frameLevel}.png`);
  };
</script>

<div
  class={`relative ${containerClass}`}
  style={maxSize != null ? `max-width:${maxSize}px` : undefined}
  bind:this={observedNode}
>
  {#if !shouldRenderImage || (!imageLoaded && !imageFailed && src)}
    <div
      class="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(0,0,0,0.08),rgba(255,255,255,0.05))] animate-pulse"
    >
      <span class="loading loading-spinner loading-md text-base-content/60" aria-hidden="true"
      ></span>
    </div>
  {/if}

  {#if !currentSrc || imageFailed}
    <div
      class="flex size-full min-h-0 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-base-content/65"
    >
      <Icon icon="mdi:file-remove-outline" class="size-10 opacity-75" aria-hidden="true" />
      {#if fallbackLabel}
        <span class="font-medium">{fallbackLabel}</span>
      {/if}
    </div>
  {/if}

  {#if shouldRenderImage && currentSrc}
    {#key imageRequestKey}
      {@const requestTokenSnapshot = requestToken}
      {@const requestResource = currentSrc}
      {@const requestPhase = phase}
      {@const requestAttempt = attempt}
      <img
        src={requestSrc}
        {alt}
        loading={loadMode === "visible" ? "lazy" : "eager"}
        decoding="async"
        class={`${imageClass} transition-[opacity,transform] duration-300 ease-out ${imageLoaded && !imageFailed ? "scale-100 opacity-100" : "scale-[1.02] opacity-0"} ${imageFailed ? "pointer-events-none sr-only" : ""}`}
        onload={() =>
          handleImageLoad(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
        onerror={() =>
          handleImageError(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
      />
    {/key}
  {/if}

  {#if showFrame}
    {@const frameUrl = getFrameUrl()}
    {#if frameUrl && shouldRenderImage}
      <img
        src={frameUrl}
        alt=""
        aria-hidden="true"
        class="pointer-events-none absolute inset-0 z-10 size-full object-fill"
        loading="lazy"
        decoding="async"
      />
    {/if}
  {/if}

  {#if showIcons && shouldRenderImage}
    {@const attrIconUrl = getAttrIconUrl()}
    {@const rarityIconUrl = getRarityIconUrl()}
    <svg
      class="pointer-events-none absolute inset-0 z-20 size-full"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      {#if attrIconUrl}
        <image href={attrIconUrl} x="71" y="0" width="29" height="29" class="drop-shadow" />
      {/if}
      {#if rarityIconUrl && resolvedRarityCount > 0}
        {#each Array.from(Array(resolvedRarityCount).keys()) as index (`card-thumbnail-rarity-${trained}-${index}`)}
          <image
            href={rarityIconUrl}
            x={2 + index * 21}
            y="73"
            width="22"
            height="22"
            class="drop-shadow"
          />
        {/each}
      {/if}
    </svg>
  {/if}
</div>
