export type Live2DMediaKind = "image" | "video" | "sound";

/**
 * A media file (image, video or sound) failed to load. Carries the file URL so
 * hosts can tell a missing file from a transient failure; the message keeps the
 * legacy "Failed to load <kind>: <url>" text.
 */
export class Live2DMediaLoadError extends Error {
  constructor(
    readonly kind: Live2DMediaKind,
    readonly url: string
  ) {
    super(`Failed to load ${kind}: ${url}`);
    this.name = "Live2DMediaLoadError";
  }
}
