/**
 * Local preview catalog for the Live2D model selector.
 *
 * No verified model catalog exists yet, so these entries are typed
 * placeholders that exercise the selector flow. They never fetch or imply
 * real model data: every entry resolves to the existing stub viewer route,
 * and display strings stay externalized through i18n source keys.
 */
import { isModelRouteId } from "./model-route";

/** Placeholder catalog entry. Display strings are i18n keys, not literals. */
export interface Live2dPreviewModelEntry {
  /** Path-safe model ID, matched case-sensitively like the route param. */
  id: string;
  titleKey: string;
  descriptionKey: string;
}

/** Localized view model handed to the selector component by the route. */
export interface Live2dModelOption {
  id: string;
  title: string;
  description: string;
}

export type ResolvedModelSelection =
  | { status: "known"; modelId: string }
  | { status: "path-safe"; modelId: string }
  | { status: "invalid" };

export const previewLive2dModelEntries: readonly Live2dPreviewModelEntry[] = [
  {
    id: "sample-model",
    titleKey: "live2d.modelSelector.model.sample.title",
    descriptionKey: "live2d.modelSelector.model.sample.description"
  },
  {
    id: "preview-model-01",
    titleKey: "live2d.modelSelector.model.preview01.title",
    descriptionKey: "live2d.modelSelector.model.preview01.description"
  },
  {
    id: "preview-model-02",
    titleKey: "live2d.modelSelector.model.preview02.title",
    descriptionKey: "live2d.modelSelector.model.preview02.description"
  }
];

/**
 * Classifies a raw draft model ID for the selector's input seam. Empty or
 * unsafe values are invalid; known entries match case-sensitively; any other
 * path-safe value stays navigable because the viewer route validates and
 * renders its own unavailable-contract stub state.
 */
export const resolveModelSelection = (
  rawValue: string,
  models: readonly { id: string }[]
): ResolvedModelSelection => {
  const modelId = rawValue.trim();
  if (!isModelRouteId(modelId)) return { status: "invalid" };

  const isKnown = models.some((model) => model.id === modelId);
  return isKnown ? { status: "known", modelId } : { status: "path-safe", modelId };
};
