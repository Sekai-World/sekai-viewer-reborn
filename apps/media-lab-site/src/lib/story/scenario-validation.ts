import { SnippetAction, type IScenarioData } from "./scenario-types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const isInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value);
const isString = (value: unknown): value is string => typeof value === "string";

const isRecordArray = (
  value: unknown,
  validate: (record: Record<string, unknown>) => boolean
): boolean => Array.isArray(value) && value.every((item) => isRecord(item) && validate(item));

const isCharacter = (record: Record<string, unknown>): boolean =>
  isFiniteNumber(record.Character2dId) && isString(record.CostumeType);

const isFirstLayout = (record: Record<string, unknown>): boolean =>
  isFiniteNumber(record.Character2dId) &&
  isString(record.CostumeType) &&
  isString(record.MotionName) &&
  isString(record.FacialName) &&
  isFiniteNumber(record.OffsetX) &&
  isFiniteNumber(record.PositionSide);

const isLayout = (record: Record<string, unknown>): boolean =>
  isFiniteNumber(record.Character2dId) &&
  isString(record.CostumeType) &&
  isString(record.MotionName) &&
  isString(record.FacialName);

const isTalkCharacter = (record: Record<string, unknown>): boolean =>
  isFiniteNumber(record.Character2dId);

const isMotion = (record: Record<string, unknown>): boolean =>
  isFiniteNumber(record.Character2dId) &&
  isString(record.MotionName) &&
  isString(record.FacialName) &&
  isFiniteNumber(record.TimingSyncValue);

const isVoice = (record: Record<string, unknown>): boolean => isString(record.VoiceId);

const isTalk = (record: Record<string, unknown>): boolean =>
  isRecordArray(record.TalkCharacters, isTalkCharacter) &&
  isRecordArray(record.Motions, isMotion) &&
  isRecordArray(record.Voices, isVoice);

const isSnippet = (record: Record<string, unknown>): boolean =>
  isInteger(record.Action) &&
  isInteger(record.ProgressBehavior) &&
  isInteger(record.ReferenceIndex) &&
  isFiniteNumber(record.Delay);

const isSpecialEffect = (record: Record<string, unknown>): boolean =>
  isFiniteNumber(record.EffectType) && isString(record.StringVal) && isString(record.StringValSub);

const isSound = (record: Record<string, unknown>): boolean =>
  isString(record.Bgm) && isString(record.Se);

const isLayoutMode = (record: Record<string, unknown>): boolean =>
  isFiniteNumber(record.CharacterLayoutMode);

const getReferencedArray = (
  input: Record<string, unknown>,
  action: number
): unknown[] | undefined => {
  let field: string | undefined;
  switch (action) {
    case SnippetAction.Talk:
      field = "TalkData";
      break;
    case SnippetAction.CharacterLayout:
    case SnippetAction.CharacterMotion:
      field = "LayoutData";
      break;
    case SnippetAction.SpecialEffect:
      field = "SpecialEffectData";
      break;
    case SnippetAction.Sound:
      field = "SoundData";
      break;
    case SnippetAction.CharacterLayoutMode:
      field = "ScenarioSnippetCharacterLayoutModes";
      break;
    default:
      return undefined;
  }

  const value = input[field];
  return Array.isArray(value) ? value : undefined;
};

const malformed = (field: string): never => {
  throw new Error(`Scenario document is malformed: ${field}`);
};

const SCENARIO_ARRAY_FIELDS = [
  "AppearCharacters",
  "FirstLayout",
  "Snippets",
  "TalkData",
  "LayoutData",
  "SpecialEffectData",
  "SoundData",
  "NeedBundleNames",
  "IncludeSoundDataBundleNames",
  "ScenarioSnippetCharacterLayoutModes"
] as const;

/** Validates the scenario fields used by preprocessing and playback reference collection. */
export const parseScenarioData = (input: unknown): IScenarioData => {
  if (!isRecord(input)) throw new Error("Scenario document is malformed: root");
  if (!isString(input.ScenarioId) || input.ScenarioId.length === 0) malformed("ScenarioId");
  if (
    !isString(input.FirstBgm) ||
    !isString(input.FirstBackground) ||
    !isFiniteNumber(input.FirstCharacterLayoutMode)
  ) {
    malformed("initial layout or media fields");
  }
  if (SCENARIO_ARRAY_FIELDS.some((field) => !Array.isArray(input[field]))) {
    malformed("top-level arrays");
  }

  if (!isRecordArray(input.AppearCharacters, isCharacter)) malformed("AppearCharacters");
  if (!isRecordArray(input.FirstLayout, isFirstLayout)) malformed("FirstLayout");
  if (!isRecordArray(input.LayoutData, isLayout)) malformed("LayoutData");
  if (!isRecordArray(input.Snippets, isSnippet)) malformed("Snippets");
  if (!isRecordArray(input.TalkData, isTalk)) malformed("TalkData");
  if (!isRecordArray(input.SpecialEffectData, isSpecialEffect)) {
    malformed("SpecialEffectData");
  }
  if (!isRecordArray(input.SoundData, isSound)) malformed("SoundData");
  if (!isRecordArray(input.ScenarioSnippetCharacterLayoutModes, isLayoutMode)) {
    malformed("ScenarioSnippetCharacterLayoutModes");
  }

  const snippets = input.Snippets as unknown[];
  for (const [index, value] of snippets.entries()) {
    if (!isRecord(value)) throw new Error(`Scenario document is malformed: Snippets[${index}]`);
    const action = value.Action;
    if (!isInteger(action)) {
      throw new Error(`Scenario document is malformed: Snippets[${index}].Action`);
    }
    const referenced = getReferencedArray(input, action);
    const referenceIndex = value.ReferenceIndex;
    if (
      referenced &&
      (!isInteger(referenceIndex) || referenceIndex < 0 || referenceIndex >= referenced.length)
    ) {
      malformed(`Snippets[${index}].ReferenceIndex`);
    }
  }

  return input as unknown as IScenarioData;
};
