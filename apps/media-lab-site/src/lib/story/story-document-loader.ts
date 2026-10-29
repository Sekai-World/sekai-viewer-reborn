import type {
  MediaAssetKind,
  MediaAssetReference,
  StoryDocument,
  StoryDocumentReference,
  StoryModelReference
} from "#lib/live2d/story-document.js";
import {
  backgroundImagePath,
  bgmPath,
  createStoryAssetResolver,
  storyRegionBuckets,
  type StoryAssetResolver
} from "./story-urls";
import { collectStoryMediaAssets } from "./story-media";
import { processScenarioDataForPlayer } from "./scenario-process";
import { parseScenarioData } from "./scenario-validation";
import type { StoryVoiceCharacter } from "./scenario-rows";

export interface StoryDocumentLoadProgress {
  loadedBytes: number;
  totalBytes: number | null;
}

export interface LoadStoryDocumentOptions {
  signal: AbortSignal;
  fetch?: typeof fetch;
  onProgress?: (progress: StoryDocumentLoadProgress) => void;
  onWarning?: (reason: string) => void;
}

export type StoryDocumentLoadErrorCode =
  "scenario-network" | "scenario-http" | "scenario-invalid" | "media-resolution";

/** A safe operation code for host UI; detailed failure causes remain internal. */
export class StoryDocumentLoadError extends Error {
  constructor(
    readonly code: StoryDocumentLoadErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "StoryDocumentLoadError";
  }
}

const invalidScenarioError = (cause: unknown): StoryDocumentLoadError =>
  new StoryDocumentLoadError(
    "scenario-invalid",
    "The scenario data is unavailable or malformed. Retry the load later.",
    { cause }
  );

const abortError = (signal: AbortSignal): Error => {
  const error = new Error("Story document loading was cancelled", { cause: signal.reason });
  error.name = "AbortError";
  return error;
};

const throwIfAborted = (signal: AbortSignal): void => {
  if (signal.aborted) throw abortError(signal);
};

const responseLength = (response: Response): number | null => {
  const header = response.headers.get("content-length");
  if (!header) return null;
  const length = Number(header);
  return Number.isFinite(length) && length > 0 ? length : null;
};

const readResponseText = async (
  response: Response,
  signal: AbortSignal,
  onProgress?: (progress: StoryDocumentLoadProgress) => void
): Promise<string> => {
  const totalBytes = responseLength(response);
  onProgress?.({ loadedBytes: 0, totalBytes });

  if (!response.body) {
    const text = await response.text();
    throwIfAborted(signal);
    const loadedBytes = new TextEncoder().encode(text).byteLength;
    onProgress?.({ loadedBytes, totalBytes: totalBytes ?? loadedBytes });
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const chunks: string[] = [];
  let loadedBytes = 0;

  try {
    while (true) {
      throwIfAborted(signal);
      const { value, done } = await reader.read();
      if (done) break;
      loadedBytes += value.byteLength;
      chunks.push(decoder.decode(value, { stream: true }));
      onProgress?.({ loadedBytes, totalBytes });
    }
    chunks.push(decoder.decode());
    throwIfAborted(signal);
    if (totalBytes !== null) onProgress?.({ loadedBytes, totalBytes });
    return chunks.join("");
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    if (signal.aborted) throw abortError(signal);
    throw error;
  } finally {
    reader.releaseLock();
  }
};

const fetchScenarioResponse = async (
  url: string,
  fetchFn: typeof fetch,
  signal: AbortSignal
): Promise<Response> => {
  let response: Response;
  try {
    response = await fetchFn(url, { signal });
  } catch (error) {
    if (signal.aborted) throw abortError(signal);
    throw new StoryDocumentLoadError(
      "scenario-network",
      "The scenario could not be reached. Retry the load when the connection is available.",
      { cause: error }
    );
  }
  if (!response.ok) {
    throw new StoryDocumentLoadError(
      "scenario-http",
      `The scenario request failed with status ${response.status}.`
    );
  }
  return response;
};

const parseScenarioResponse = async (
  response: Response,
  signal: AbortSignal,
  onProgress?: (progress: StoryDocumentLoadProgress) => void
): Promise<ReturnType<typeof parseScenarioData>> => {
  try {
    const text = await readResponseText(response, signal, onProgress);
    return parseScenarioData(JSON.parse(text) as unknown);
  } catch (error) {
    if (signal.aborted) throw abortError(signal);
    if (error instanceof StoryDocumentLoadError) throw error;
    throw invalidScenarioError(error);
  }
};

const mediaKindOf = (type: string): MediaAssetKind | null => {
  switch (type) {
    case "background-image":
      return "background";
    case "bgm":
      return "bgm";
    case "sound-effect":
      return "se";
    case "talk":
      return "voice";
    case "video":
      return "movie";
    default:
      return null;
  }
};

const collectModels = (
  document: StoryDocumentReference,
  scenarioData: StoryDocument["scenarioData"]
): StoryModelReference[] => {
  const voiceCharacters = new Map<number, StoryVoiceCharacter>(
    document.voiceCharacters.map(({ character2dId, assetName, unit }) => [
      character2dId,
      { assetName, unit }
    ])
  );
  const candidates = [
    ...scenarioData.AppearCharacters.map(({ Character2dId, CostumeType }) => ({
      character2dId: Character2dId,
      assetName: CostumeType
    })),
    ...scenarioData.FirstLayout.map(({ Character2dId, CostumeType }) => ({
      character2dId: Character2dId,
      assetName: CostumeType
    })),
    ...scenarioData.LayoutData.map(({ Character2dId, CostumeType }) => ({
      character2dId: Character2dId,
      assetName: CostumeType
    }))
  ];
  const result: StoryModelReference[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (!candidate.assetName) continue;
    const key = `${candidate.character2dId}:${candidate.assetName}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const character = voiceCharacters.get(candidate.character2dId);
    result.push({
      character2dId: candidate.character2dId,
      assetName: candidate.assetName,
      ...(character?.unit ? { unit: character.unit } : {})
    });
  }

  return result;
};

const resolveMediaUrl = (
  kind: MediaAssetKind,
  path: string,
  resolver: StoryAssetResolver
): string => {
  switch (kind) {
    case "background":
      return resolver.image(path);
    case "bgm":
    case "se":
    case "voice":
      return resolver.audio(path);
    case "movie":
      return resolver.video(path);
  }
};

const normalizeMedia = (
  assets: Awaited<ReturnType<typeof collectStoryMediaAssets>>,
  resolver: StoryAssetResolver
): MediaAssetReference[] =>
  assets.flatMap((asset) => {
    const kind = mediaKindOf(asset.type);
    if (!kind) return [];
    return [
      {
        kind,
        identifier: asset.identifier,
        path: asset.path,
        url: resolveMediaUrl(kind, asset.path, resolver),
        ...(asset.character2dId !== undefined ? { character2dId: asset.character2dId } : {}),
        ...(asset.character2dAssetName ? { character2dAssetName: asset.character2dAssetName } : {}),
        ...(asset.character2dUnit ? { character2dUnit: asset.character2dUnit } : {})
      }
    ];
  });

const createInitialMedia = (
  scenarioData: StoryDocument["scenarioData"],
  resolver: StoryAssetResolver
): MediaAssetReference[] => {
  const initial: MediaAssetReference[] = [];
  if (scenarioData.FirstBackground) {
    const path = backgroundImagePath(scenarioData.FirstBackground);
    initial.push({
      kind: "background",
      identifier: scenarioData.FirstBackground,
      path,
      url: resolver.image(path)
    });
  }
  if (scenarioData.FirstBgm) {
    const path = bgmPath(scenarioData.FirstBgm);
    initial.push({
      kind: "bgm",
      identifier: scenarioData.FirstBgm,
      path,
      url: resolver.audio(path)
    });
  }
  return initial;
};

/** Loads and normalizes a route descriptor entirely on the browser side. */
export const loadStoryDocument = async (
  reference: StoryDocumentReference,
  options: LoadStoryDocumentOptions
): Promise<StoryDocument> => {
  const { signal, onProgress, onWarning } = options;
  const fetchFn = options.fetch ?? fetch;
  throwIfAborted(signal);

  const response = await fetchScenarioResponse(reference.scenario.url, fetchFn, signal);
  const scenarioData = await parseScenarioResponse(response, signal, onProgress);

  throwIfAborted(signal);
  const resolver = createStoryAssetResolver(() => reference.assetBase, reference.identity.region);
  let processedScenario: StoryDocument["scenarioData"];
  let initialMedia: MediaAssetReference[];
  let models: StoryModelReference[];
  try {
    processedScenario = processScenarioDataForPlayer(reference.identity, scenarioData);
    initialMedia = createInitialMedia(processedScenario, resolver);
    models = collectModels(reference, processedScenario);
  } catch (error) {
    if (signal.aborted) throw abortError(signal);
    throw invalidScenarioError(error);
  }

  const voiceCharacters = new Map<number, StoryVoiceCharacter>(
    reference.voiceCharacters.map(({ character2dId, assetName, unit }) => [
      character2dId,
      { assetName, unit }
    ])
  );

  let collectedMedia: Awaited<ReturnType<typeof collectStoryMediaAssets>>;
  try {
    collectedMedia = await collectStoryMediaAssets({
      scenarioData: processedScenario,
      isCardStory: reference.isCardStory,
      isActionSet: reference.isActionSet,
      regionBucket: storyRegionBuckets[reference.identity.region],
      regionBase: reference.assetBase,
      regionUrl: resolver.image,
      voiceCharacters,
      fetch: fetchFn,
      signal,
      onWarning: (reason) => {
        if (!signal.aborted) onWarning?.(reason);
      }
    });
  } catch (error) {
    if (signal.aborted) throw abortError(signal);
    if (error instanceof TypeError) throw invalidScenarioError(error);
    throw new StoryDocumentLoadError(
      "media-resolution",
      "Some scenario assets could not be resolved. Retry the load later.",
      { cause: error }
    );
  }

  throwIfAborted(signal);
  return {
    ...reference,
    scenarioData: processedScenario,
    text: { scenarioId: processedScenario.ScenarioId, translationSource: "none" },
    initialMedia,
    media: normalizeMedia(collectedMedia, resolver),
    models
  };
};
