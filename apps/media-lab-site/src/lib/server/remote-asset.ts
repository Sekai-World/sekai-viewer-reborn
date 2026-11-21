import { SEKAI_REMOTE_ASSET_BASE_URL } from "$app/env/private";
import { stripTrailingSlashes } from "@platform/ui-shell/global-notices";
import {
  LIVE2D_ASSET_BUCKET_URL,
  LIVE2D_ASSOCIATED_CATALOG_URL
} from "#lib/live2d/associated-catalog.js";

/**
 * Optional internal asset origin for server-side fetches (e.g. an in-cluster S3
 * gateway) with the public host's `{base}/{bucket}/{key}` layout: an origin
 * with an optional path, no query or fragment. Null when unset or blank.
 * Never use it for URLs sent to the browser.
 */
export const getInternalRemoteAssetBaseUrl = (): string | null => {
  const value = SEKAI_REMOTE_ASSET_BASE_URL?.trim();
  if (!value) return null;

  const normalized = stripTrailingSlashes(value);
  return normalized.length > 0 ? normalized : null;
};

/** Moves a public asset URL onto the internal origin, keeping its bucket path. */
const toServerFetchUrl = (publicUrl: string): string => {
  const internalBase = getInternalRemoteAssetBaseUrl();
  return internalBase ? `${internalBase}${new URL(publicUrl).pathname}` : publicUrl;
};

/** The Live2D bucket URL the asset relay fetches from. */
export const getLive2dAssetUpstreamBucketUrl = (): string =>
  toServerFetchUrl(LIVE2D_ASSET_BUCKET_URL);

/** The associated catalog URL the Live2D route loaders fetch from. */
export const getLive2dCatalogUpstreamUrl = (): string =>
  toServerFetchUrl(LIVE2D_ASSOCIATED_CATALOG_URL);
