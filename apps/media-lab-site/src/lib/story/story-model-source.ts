import type {
  ILive2DModelData,
  ILive2dModelListElement
} from "./scenario-types";
import type { ILive2DModelDataCollection } from "./player/player-types";
import type { ILive2DStoryModelSource } from "./player/player-types";
import { live2dFetch } from "./player/rate-limited-fetch";

/**
 * Client-side Live2D model data source for story playback.
 *
 * Ported from the legacy viewer's `live2dLoader`: the model list on the
 * independent Live2D bucket is the source of truth for story costumes
 * (`CostumeType` matches the catalog's `modelBase`; 668 bases as of
 * 2026-09-14, versus 239 in the associated catalog), motion/expression name
 * lists come from `{modelBase}_motion_base/BuildMotionData.json`, and motion
 * files live under `live2d/motion/{motionBase}/{motion|facial}/`. The
 * lowercase-path fallback rules of the mirror are preserved.
 *
 * Model files are loaded directly from the bucket (CORS confirmed) instead
 * of the app's same-origin relay, matching the standalone legacy reader.
 */

export interface StoryModelSourceOptions {
  /** Absolute URL builder for paths on the Live2D asset bucket. */
  live2dUrl: (path: string) => string;
}

interface Live2DBuildModelData {
  AdditionalMotionData: unknown[];
}

interface Live2DMotionsExpressions {
  motions: string[];
  expressions: string[];
}

const lowercasePath = (path: string): string => path.toLowerCase();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** HEAD-checks an endpoint, retrying with a lowercased path; "" when absent. */
const verifyLive2dEndpoint = async (
  endpoint: string,
  live2dUrl: (path: string) => string
): Promise<string> => {
  const attempt = async (value: string): Promise<number | null> => {
    try {
      const response = await live2dFetch(live2dUrl(value), { method: "HEAD" });
      return response.status;
    } catch {
      return null;
    }
  };
  const status = await attempt(endpoint);
  if (status !== null && status < 400) return live2dUrl(endpoint);
  const fallbackEndpoint = lowercasePath(endpoint);
  if (fallbackEndpoint === endpoint) return "";
  const fallbackStatus = await attempt(fallbackEndpoint);
  if (fallbackStatus !== null && fallbackStatus < 400) {
    return live2dUrl(fallbackEndpoint);
  }
  return "";
};

/** Fetches JSON, retrying with a lowercased path on a 404. */
const fetchJsonWithLowercaseFallback = async <T>(
  endpoint: string,
  live2dUrl: (path: string) => string
): Promise<T> => {
  const parse = async (value: string): Promise<T> => {
    const response = await live2dFetch(live2dUrl(value));
    if (!response.ok) {
      throw new Error(`Failed to fetch ${value}: ${response.status}`);
    }
    return (await response.json()) as T;
  };
  try {
    return await parse(endpoint);
  } catch (error) {
    const fallbackEndpoint = lowercasePath(endpoint);
    if (fallbackEndpoint === endpoint || !(error instanceof Error)) throw error;
    const message = error.message;
    if (!message.includes(": 404") && !message.includes(" 404")) throw error;
    return parse(fallbackEndpoint);
  }
};

const getExistingRelativeModelAssetPath = async (
  modelItem: ILive2dModelListElement,
  path: string,
  live2dUrl: (path: string) => string
): Promise<string> => {
  const endpoint = `live2d/model/${modelItem.modelPath}/${path}`;
  const url = await verifyLive2dEndpoint(endpoint, live2dUrl);
  if (!url) return path;
  return url.endsWith(lowercasePath(endpoint)) ? lowercasePath(path) : path;
};

const applyModelFileReferencesFallback = async (
  modelItem: ILive2dModelListElement,
  fileReferences: ILive2DModelData["FileReferences"] & {
    DisplayInfo?: string;
    Pose?: string;
  },
  live2dUrl: (path: string) => string
): Promise<void> => {
  fileReferences.Moc = await getExistingRelativeModelAssetPath(
    modelItem,
    fileReferences.Moc,
    live2dUrl
  );
  fileReferences.Physics = await getExistingRelativeModelAssetPath(
    modelItem,
    fileReferences.Physics,
    live2dUrl
  );
  fileReferences.Textures = await Promise.all(
    fileReferences.Textures.map((texture) =>
      getExistingRelativeModelAssetPath(modelItem, texture, live2dUrl)
    )
  );
};

/** Model base name reductions used to find the motion base metadata. */
const modelNameToMotionBaseName: [RegExp, (name: string) => string][] = [
  // eg. v2_clb01_21miku to v2_21miku
  [/^v2_clb\d{2}_/, (name) => name.replace(/v2_clb\d{2}_/, "v2_")],
  // eg. v2_20mizuki_culture_back to v2_20mizuki_back
  [/(.*)_back(\d{2})?$/, (name) => {
    const matches = name.match(/(.*)_back(\d{2})?$/);
    return matches ? `${matches[1].split("_").slice(0, 2).join("_")}_back` : name;
  }],
  // eg. 21miku01 to 21miku
  [/(.*)\d{2}$/, (name) => name.replace(/\d{2}$/, "")]
];

const getBuildMotionDataUrl = async (
  modelItem: ILive2dModelListElement,
  live2dUrl: (path: string) => string
): Promise<[string, string] | null> => {
  let modelBaseName = modelItem.modelBase;
  let modelDir = modelItem.modelPath.split("/").slice(0, -1).join("/");
  if (lowercasePath(modelDir).indexOf("v2/collabo/21_miku") !== -1) {
    modelDir = modelDir.replace("collabo", "main");
  } else if (lowercasePath(modelDir).indexOf("v2/collabo/egg") !== -1) {
    modelDir = modelDir.split("/").slice(0, -1).join("/");
  }

  const attempt = async (baseName: string): Promise<string | null> =>
    verifyLive2dEndpoint(
      `live2d/motion/${modelDir}/${baseName}_motion_base/BuildMotionData.json`,
      live2dUrl
    );

  // case 1: directly from model path + motion_base
  let url = await attempt(modelBaseName);

  // case 2: known model name reductions
  if (!url) {
    for (const [pattern, processor] of modelNameToMotionBaseName) {
      if (pattern.test(modelBaseName)) {
        modelBaseName = processor(modelBaseName);
        url = await attempt(modelBaseName);
        break;
      }
    }
  }

  // case 3: reduce the name until the base name
  while (!url && modelBaseName.split("_").length > 1) {
    modelBaseName = modelBaseName.split("_").slice(0, -1).join("_");
    url = await attempt(modelBaseName);
  }

  if (!url) return null;
  return [url, `${modelDir}/${modelBaseName}_motion_base`];
};

const getMotionData = async (
  modelItem: ILive2dModelListElement,
  live2dUrl: (path: string) => string
): Promise<[string, Live2DMotionsExpressions]> => {
  try {
    const found = await getBuildMotionDataUrl(modelItem, live2dUrl);
    if (!found) return ["", { motions: [], expressions: [] }];
    const [motionDataUrl, motionBaseName] = found;
    if (!lowercasePath(modelItem.modelBase).startsWith("normal")) {
      const response = await live2dFetch(motionDataUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch motion data: ${response.status}`);
      }
      return [motionBaseName, (await response.json()) as Live2DMotionsExpressions];
    }
    return [motionBaseName, { motions: [], expressions: [] }];
  } catch {
    return ["", { motions: [], expressions: [] }];
  }
};

const getAdditionalMotionData = async (
  modelItem: ILive2dModelListElement,
  live2dUrl: (path: string) => string
): Promise<Live2DMotionsExpressions> => {
  try {
    return await fetchJsonWithLowercaseFallback<Live2DMotionsExpressions>(
      `live2d/model/${modelItem.modelPath}/motions/BuildMotionData.json`,
      live2dUrl
    );
  } catch {
    return { expressions: [], motions: [] };
  }
};

/**
 * Creates the story model source. One instance caches the model list across
 * the AppearCharacters of a scenario.
 */
export const createStoryModelSource = (
  options: StoryModelSourceOptions
): ILive2DStoryModelSource => {
  const live2dUrl = options.live2dUrl;

  const modelListPromise: Promise<ILive2dModelListElement[]> = (async () => {
    const response = await live2dFetch(live2dUrl("live2d/model_list.json"));
    if (!response.ok) {
      throw new Error(`Failed to fetch model list: ${response.status}`);
    }
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) {
      throw new Error("Live2D model list is malformed");
    }
    return raw.filter(isRecord) as unknown as ILive2dModelListElement[];
  })();

  const findModelItem = async (
    costume: string
  ): Promise<ILive2dModelListElement | null> => {
    const modelList = await modelListPromise;
    const exact = modelList.find((m) => m.modelBase === costume);
    if (exact) return exact;
    return (
      modelList.find(
        (m) => m.modelBase.toLowerCase() === costume.toLowerCase()
      ) ?? null
    );
  };

  const getModelData = async (
    modelItem: ILive2dModelListElement
  ): Promise<ILive2DModelData> => {
    const motionFade: [number, number] = [0.5, 0.1];
    const expressionFade: [number, number] = [0.1, 0.1];

    const model3Promise = fetchJsonWithLowercaseFallback<ILive2DModelData>(
      `live2d/model/${modelItem.modelPath}/${modelItem.modelFile}`,
      live2dUrl
    );
    const buildModelDataPromise =
      fetchJsonWithLowercaseFallback<Live2DBuildModelData>(
        `live2d/model/${modelItem.modelPath}/buildmodeldata.asset`,
        live2dUrl
      );
    const [motionBaseName, motionData] = await getMotionData(modelItem, live2dUrl);
    const [model3, modelBuildData] = await Promise.all([
      model3Promise,
      buildModelDataPromise
    ]);

    await applyModelFileReferencesFallback(
      modelItem,
      model3.FileReferences as ILive2DModelData["FileReferences"] & {
        DisplayInfo?: string;
        Pose?: string;
      },
      live2dUrl
    );

    const additionalMotionData =
      Array.isArray(modelBuildData.AdditionalMotionData) &&
      modelBuildData.AdditionalMotionData.length > 0
        ? await getAdditionalMotionData(modelItem, live2dUrl)
        : { expressions: [], motions: [] };

    const modelBaseUrl = live2dUrl(`live2d/model/${modelItem.modelPath}/`);
    model3.url = modelBaseUrl;

    const motions = await Promise.all(
      motionData.motions.map(async (elem) => ({
        Name: elem,
        File: live2dUrl(
          `live2d/motion/${motionBaseName}/motion/${elem}.motion3.json`
        ),
        FadeInTime: motionFade[0],
        FadeOutTime: motionFade[1]
      }))
    );
    for (const elem of additionalMotionData.motions) {
      motions.push({
        Name: `${elem}-additional`,
        File: await getExistingRelativeModelAssetPath(
          modelItem,
          `motions/${elem}.motion3.json`,
          live2dUrl
        ).then((path) => (path.startsWith("http") ? path : `${modelBaseUrl}${path}`)),
        FadeInTime: motionFade[0],
        FadeOutTime: motionFade[1]
      });
    }
    const expressions = await Promise.all(
      motionData.expressions.map(async (elem) => ({
        Name: elem,
        File: live2dUrl(
          `live2d/motion/${motionBaseName}/facial/${elem}.motion3.json`
        ),
        FadeInTime: expressionFade[0],
        FadeOutTime: expressionFade[1]
      }))
    );

    model3.FileReferences.Motions = {
      Motion: motions,
      Expression: expressions
    };
    return model3;
  };

  return {
    getModelDataForCostume: async (
      costume: string,
      character2dId: number
    ): Promise<ILive2DModelDataCollection | null> => {
      const modelItem = await findModelItem(costume);
      if (!modelItem) return null;
      const data = await getModelData(modelItem);
      return { costume, cid: character2dId, data };
    }
  };
};
