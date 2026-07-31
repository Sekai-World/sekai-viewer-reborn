export type ImageRetryPhase = "primary" | "fallback";

export type ImageRetryRequestContext = Readonly<{
  phase: ImageRetryPhase;
  attempt: number;
  nonce: string;
}>;

export type ImageRetryProbeMode = "same-origin-head" | "none";

/**
 * Describes how retry URLs are rendered and whether canonical resources may be
 * classified with a same-origin HEAD request.
 */
export type ImageRetryPolicy = Readonly<{
  buildRequestUrl: (canonicalUrl: string, context: ImageRetryRequestContext) => string;
  probe: ImageRetryProbeMode;
  probeTimeoutMs: number;
}>;

const appendStaticRetryParameter = (
  canonicalUrl: string,
  { phase, attempt, nonce }: ImageRetryRequestContext
): string => {
  if (attempt === 0) {
    return canonicalUrl;
  }

  const hashIndex = canonicalUrl.indexOf("#");
  const sourceWithoutHash = hashIndex >= 0 ? canonicalUrl.slice(0, hashIndex) : canonicalUrl;
  const hash = hashIndex >= 0 ? canonicalUrl.slice(hashIndex) : "";
  const separator = sourceWithoutHash.includes("?") ? "&" : "?";
  const value = encodeURIComponent(`${nonce}-${phase}-${attempt}`);
  return `${sourceWithoutHash}${separator}__image_retry=${value}${hash}`;
};

/** Static asset policy: one internal cache-busting query parameter and HEAD classification. */
export const STATIC_ASSET_RETRY_POLICY: ImageRetryPolicy = Object.freeze({
  buildRequestUrl: appendStaticRetryParameter,
  probe: "same-origin-head",
  probeTimeoutMs: 1000
});

/** Signed GET policy: preserve the signed URL exactly and never issue a HEAD probe by default. */
export const SIGNED_GET_RETRY_POLICY: ImageRetryPolicy = Object.freeze({
  buildRequestUrl: (canonicalUrl: string): string => canonicalUrl,
  probe: "none",
  probeTimeoutMs: 1000
});
