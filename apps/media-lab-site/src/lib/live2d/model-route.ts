/**
 * Route-level validation for the standalone Live2D model viewer path param.
 *
 * Deliberately independent from any model-list or metadata contract: route
 * validation must stay stable while the model player adapter work finalizes
 * how a `modelId` resolves against the remote model list.
 */
const MAX_MODEL_ID_LENGTH = 128;
const MODEL_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type ParsedModelRouteParams =
  { status: "ok"; modelId: string } | { status: "invalid-model-id" };

// Model IDs are opaque slugs pointing into the mirrored Live2D model list.
// Keep them on a conservative, path-safe charset so a route param can never
// smuggle path separators or control characters into metadata rendering.
// Case is preserved: model list entries are matched case-sensitively later.
export const isModelRouteId = (value: string): boolean =>
  value.length > 0 && value.length <= MAX_MODEL_ID_LENGTH && MODEL_ID_PATTERN.test(value);

export const parseModelRouteParams = (params: { modelId?: string }): ParsedModelRouteParams => {
  const modelId = params.modelId?.trim() ?? "";
  if (!isModelRouteId(modelId)) return { status: "invalid-model-id" };

  return { status: "ok", modelId };
};
