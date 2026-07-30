<script lang="ts">
  let {
    src,
    fallbackSrc = null,
    alt,
    class: className = "",
    loading = "lazy",
    decoding = "async"
  }: {
    src: string;
    fallbackSrc?: string | null;
    alt: string;
    class?: string;
    loading?: "eager" | "lazy";
    decoding?: "async" | "auto" | "sync";
  } = $props();

  type ImagePhase = "primary" | "fallback";

  const createRequestCycleNonce = (): string => {
    const crypto = globalThis.crypto;
    if (typeof crypto?.randomUUID === "function") {
      return crypto.randomUUID();
    }

    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  };

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
  let previousSource: { primary: string; fallback: string | null | undefined } | null = null;
  let requestCycleNonce = $state(createRequestCycleNonce());

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
    return `${sourceWithoutHash}${separator}__card_grid_retry=${encodeURIComponent(`${requestCycleNonce}-${imagePhase}-${retryAttempt}`)}${hash}`;
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
    }
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
    const nextSource = { primary: src, fallback: fallbackSrc };

    if (previousSource === null) {
      previousSource = nextSource;
    } else if (
      previousSource.primary !== nextSource.primary ||
      previousSource.fallback !== nextSource.fallback
    ) {
      previousSource = nextSource;
      clearRetryProbe();
      requestToken = Symbol();
      requestCycleNonce = createRequestCycleNonce();
      phase = "primary";
      attempt = 0;
    }

    return () => {
      clearRetryTimer();
      clearRetryProbe();
    };
  });
</script>

{#key imageRequestKey}
  {@const requestTokenSnapshot = requestToken}
  {@const requestResource = currentSrc}
  {@const requestPhase = phase}
  {@const requestAttempt = attempt}
  <img
    src={requestSrc}
    {alt}
    class={className}
    {loading}
    {decoding}
    onload={() =>
      handleImageLoad(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
    onerror={() =>
      handleImageError(requestTokenSnapshot, requestResource, requestPhase, requestAttempt)}
  />
{/key}
