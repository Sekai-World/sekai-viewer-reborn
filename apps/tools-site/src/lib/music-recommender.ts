export const MUSIC_META_SOURCES = {
  "sekai-best": {
    id: "sekai-best",
    url: "https://storage.sekai.best/sekai-best-assets/music_metas.json"
  },
  moesekai: {
    id: "moesekai",
    url: "https://moe.exmeaning.com/data/music_meta/music_metas.json"
  }
} as const;

export type MusicMetaSourceId = keyof typeof MUSIC_META_SOURCES;
export type MusicMetaSource = (typeof MUSIC_META_SOURCES)[MusicMetaSourceId];

export const DEFAULT_MUSIC_META_SOURCE_ID: MusicMetaSourceId = "sekai-best";
// The audited sources contained 3,727 records; additions are allowed, but a smaller payload is treated as truncated.
export const MUSIC_META_MINIMUM_RECORD_COUNT = 3_727;
export const JP_SOLO_FORMULA_VERSION = "jp-solo-community-v1" as const;

export const MUSIC_META_DIFFICULTIES = [
  "easy",
  "normal",
  "hard",
  "expert",
  "master",
  "append"
] as const;

export type MusicMetaDifficulty = (typeof MUSIC_META_DIFFICULTIES)[number];
export type MusicMetaSkillScores = readonly [number, number, number, number, number, number];

export type MusicMeta = {
  musicId: number;
  difficulty: MusicMetaDifficulty;
  musicTime: number;
  eventRate: number;
  baseScore: number;
  skillScoreSolo: MusicMetaSkillScores;
};

export type MusicMetaFailureReasonCode =
  | "invalid-source"
  | "fetch-failed"
  | "http-error"
  | "invalid-json"
  | "invalid-schema"
  | "incomplete-data"
  | "mixed-data"
  | "freshness-metadata-missing"
  | "invalid-freshness"
  | "stale-data";

export type MusicMetaUnavailable = {
  status: "unavailable";
  source: MusicMetaSource | null;
  reasonCode: MusicMetaFailureReasonCode;
  reason: string;
  missingFields: string[];
  invalidFields: string[];
};

export type MusicMetaFreshness = {
  status: "fresh" | "stale" | "unknown";
  checkedAt: string;
  responseDate: string | null;
  responseAgeMs: number | null;
  lastModifiedAt: string | null;
};

export type MusicMetaProvenance = {
  sourceId: MusicMetaSourceId;
  sourceUrl: string;
  contentHash: `sha256:${string}`;
  recordCount: number;
  fetchedAt: string;
  freshness: MusicMetaFreshness;
};

export type MusicMetaDataset =
  | {
      status: "available";
      source: MusicMetaSource;
      items: MusicMeta[];
      provenance: MusicMetaProvenance;
    }
  | MusicMetaUnavailable;

export type MusicMetaNormalizationResult =
  | { status: "available"; items: MusicMeta[] }
  | {
      status: "unavailable";
      reasonCode: "invalid-schema" | "incomplete-data" | "mixed-data";
      reason: string;
      missingFields: string[];
      invalidFields: string[];
    };

export type JpSoloSkillAssignment = {
  coefficientIndex: number;
  effectiveSkillRate: number;
};

export type JpSoloSkillAllocation =
  | { strategy: "default"; skillEffects: readonly number[] | null }
  | { strategy: "explicit"; skillSequence: readonly JpSoloSkillAssignment[] | null };

export type JpSoloYieldInputs = {
  region: string | null;
  mode: string | null;
  deckPower: number | null;
  deckBonus: number | null;
  boostMultiplier: number | null;
  cardLength: number | null;
  skillAllocation: JpSoloSkillAllocation | null;
};

export type JpSoloYieldRequest = JpSoloYieldInputs & {
  musicId: number | null;
  difficulty: string | null;
};

export type JpSoloCalculationFailureReasonCode =
  | MusicMetaFailureReasonCode
  | "missing-inputs"
  | "invalid-inputs"
  | "unsupported-region"
  | "unsupported-mode";

export type JpSoloCalculationUnavailable = {
  status: "unavailable";
  reasonCode: JpSoloCalculationFailureReasonCode;
  reason: string;
  missingFields: string[];
  invalidFields: string[];
  provenance: MusicMetaProvenance | null;
};

export type JpSoloYieldAvailable = {
  status: "available";
  music: Pick<MusicMeta, "musicId" | "difficulty" | "musicTime">;
  score: number;
  eventPoints: number;
  formulaVersion: typeof JP_SOLO_FORMULA_VERSION;
  provenance: MusicMetaProvenance;
};

export type JpSoloYieldResult = JpSoloYieldAvailable | JpSoloCalculationUnavailable;

export type JpSoloRankingItem = {
  rank: number;
  music: Pick<MusicMeta, "musicId" | "difficulty" | "musicTime">;
  score: number;
  eventPoints: number;
};

export type JpSoloRankingResult =
  | {
      status: "available";
      rankBy: "score" | "eventPoints";
      items: JpSoloRankingItem[];
      formulaVersion: typeof JP_SOLO_FORMULA_VERSION;
      provenance: MusicMetaProvenance;
    }
  | JpSoloCalculationUnavailable;

type PreparedInputs = {
  deckPower: number;
  deckBonus: number;
  boostMultiplier: number;
  cardLength: number;
  skillAllocation:
    | { strategy: "default"; skillEffects: number[] }
    | { strategy: "explicit"; skillSequence: JpSoloSkillAssignment[] };
};

const difficultyOrder = new Map<MusicMetaDifficulty, number>(
  MUSIC_META_DIFFICULTIES.map((difficulty, index) => [difficulty, index])
);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const addIssue = (issues: Set<string>, field: string): void => {
  issues.add(field);
};

const normalizeDifficulty = (value: unknown): MusicMetaDifficulty | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return MUSIC_META_DIFFICULTIES.includes(normalized as MusicMetaDifficulty)
    ? (normalized as MusicMetaDifficulty)
    : null;
};

const compareMusicMeta = (left: MusicMeta, right: MusicMeta): number =>
  left.musicId - right.musicId ||
  (difficultyOrder.get(left.difficulty) ?? Number.MAX_SAFE_INTEGER) -
    (difficultyOrder.get(right.difficulty) ?? Number.MAX_SAFE_INTEGER);

/** Strictly normalizes the JP Solo score-input records without filling absent fields. */
export const normalizeMusicMetaPayload = (payload: unknown): MusicMetaNormalizationResult => {
  if (!Array.isArray(payload)) {
    return {
      status: "unavailable",
      reasonCode: "invalid-schema",
      reason: "The selected source must contain a JSON array of music metadata records.",
      missingFields: ["music_metas[]"],
      invalidFields: []
    };
  }

  const missingFields = new Set<string>();
  const invalidFields = new Set<string>();
  const items: MusicMeta[] = [];
  const records: unknown[] = payload;

  records.forEach((record, index) => {
    const recordPrefix = `music_metas[${index}]`;
    if (!isObject(record)) {
      addIssue(invalidFields, recordPrefix);
      return;
    }

    const readNumber = (key: string, strictlyPositive = false): number | null => {
      if (!(key in record)) {
        addIssue(missingFields, `${recordPrefix}.${key}`);
        return null;
      }

      const value = record[key];
      if (
        typeof value !== "number" ||
        !Number.isFinite(value) ||
        value < 0 ||
        (strictlyPositive && value === 0)
      ) {
        addIssue(invalidFields, `${recordPrefix}.${key}`);
        return null;
      }

      return value;
    };

    let musicId: number | null = null;
    if (!("music_id" in record)) {
      addIssue(missingFields, `${recordPrefix}.music_id`);
    } else if (
      typeof record.music_id !== "number" ||
      !Number.isSafeInteger(record.music_id) ||
      record.music_id <= 0
    ) {
      addIssue(invalidFields, `${recordPrefix}.music_id`);
    } else {
      musicId = record.music_id;
    }

    let difficulty: MusicMetaDifficulty | null = null;
    if (!("difficulty" in record)) {
      addIssue(missingFields, `${recordPrefix}.difficulty`);
    } else {
      difficulty = normalizeDifficulty(record.difficulty);
      if (difficulty === null) addIssue(invalidFields, `${recordPrefix}.difficulty`);
    }

    const musicTime = readNumber("music_time", true);
    const eventRate = readNumber("event_rate");
    const baseScore = readNumber("base_score");

    let skillScoreSolo: MusicMetaSkillScores | null = null;
    if (!("skill_score_solo" in record)) {
      addIssue(missingFields, `${recordPrefix}.skill_score_solo`);
    } else if (!Array.isArray(record.skill_score_solo) || record.skill_score_solo.length !== 6) {
      addIssue(invalidFields, `${recordPrefix}.skill_score_solo`);
    } else {
      const parsedSkills: number[] = [];
      const rawSkills: unknown[] = record.skill_score_solo;
      rawSkills.forEach((value, skillIndex) => {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
          addIssue(invalidFields, `${recordPrefix}.skill_score_solo[${skillIndex}]`);
        } else {
          parsedSkills.push(value);
        }
      });

      if (parsedSkills.length === 6) {
        skillScoreSolo = parsedSkills as [number, number, number, number, number, number];
      }
    }

    if (
      musicId !== null &&
      difficulty !== null &&
      musicTime !== null &&
      eventRate !== null &&
      baseScore !== null &&
      skillScoreSolo !== null
    ) {
      items.push({ musicId, difficulty, musicTime, eventRate, baseScore, skillScoreSolo });
    }
  });

  if (missingFields.size > 0 || invalidFields.size > 0) {
    return {
      status: "unavailable",
      reasonCode: "invalid-schema",
      reason:
        "One or more music metadata records are missing required fields or contain invalid values.",
      missingFields: [...missingFields].sort(),
      invalidFields: [...invalidFields].sort()
    };
  }

  const recordByKey = new Map<string, MusicMeta>();
  let hasConflictingDuplicate = false;
  items.forEach((item, index) => {
    const key = `${item.musicId}:${item.difficulty}`;
    const existing = recordByKey.get(key);
    if (!existing) {
      recordByKey.set(key, item);
      return;
    }

    const duplicateField = `music_metas[${index}].music_id/difficulty`;
    addIssue(invalidFields, duplicateField);
    if (JSON.stringify(existing) !== JSON.stringify(item)) hasConflictingDuplicate = true;
  });

  if (invalidFields.size > 0) {
    return {
      status: "unavailable",
      reasonCode: hasConflictingDuplicate ? "mixed-data" : "invalid-schema",
      reason: hasConflictingDuplicate
        ? "The selected source contains conflicting records for the same song and difficulty."
        : "The selected source contains duplicate song and difficulty records.",
      missingFields: [],
      invalidFields: [...invalidFields].sort()
    };
  }

  if (items.length < MUSIC_META_MINIMUM_RECORD_COUNT) {
    return {
      status: "unavailable",
      reasonCode: "incomplete-data",
      reason: `The selected source contains ${items.length} records; at least ${MUSIC_META_MINIMUM_RECORD_COUNT} are required for a complete catalog.`,
      missingFields: [`music_metas records (minimum ${MUSIC_META_MINIMUM_RECORD_COUNT})`],
      invalidFields: []
    };
  }

  return { status: "available", items: items.sort(compareMusicMeta) };
};

const unavailableCalculation = (
  reasonCode: JpSoloCalculationFailureReasonCode,
  reason: string,
  provenance: MusicMetaProvenance | null,
  missingFields: readonly string[] = [],
  invalidFields: readonly string[] = []
): JpSoloCalculationUnavailable => ({
  status: "unavailable",
  reasonCode,
  reason,
  missingFields: [...missingFields],
  invalidFields: [...invalidFields],
  provenance
});

const validateDataset = (
  dataset: MusicMetaDataset | null
):
  | { status: "available"; dataset: Extract<MusicMetaDataset, { status: "available" }> }
  | {
      status: "unavailable";
      failure: JpSoloCalculationUnavailable;
    } => {
  if (dataset === null) {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "missing-inputs",
        "A validated music metadata source is required.",
        null,
        ["musicMetaSource"]
      )
    };
  }

  if (dataset.status === "unavailable") {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        dataset.reasonCode,
        dataset.reason,
        null,
        dataset.missingFields,
        dataset.invalidFields
      )
    };
  }

  const expectedSource = MUSIC_META_SOURCES[dataset.source.id];
  const { provenance } = dataset;
  if (
    expectedSource === undefined ||
    expectedSource.url !== dataset.source.url ||
    provenance.sourceId !== dataset.source.id ||
    provenance.sourceUrl !== dataset.source.url ||
    provenance.recordCount !== dataset.items.length ||
    !/^sha256:[0-9a-f]{64}$/i.test(provenance.contentHash)
  ) {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "mixed-data",
        "The catalog records and their source provenance do not match.",
        provenance,
        [],
        ["source provenance"]
      )
    };
  }

  if (provenance.freshness.status !== "fresh") {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "stale-data",
        "The selected music metadata source is not confirmed fresh.",
        provenance,
        ["freshness metadata"]
      )
    };
  }

  if (dataset.items.length < MUSIC_META_MINIMUM_RECORD_COUNT) {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "incomplete-data",
        `The selected source contains fewer than ${MUSIC_META_MINIMUM_RECORD_COUNT} records.`,
        provenance,
        [`music_metas records (minimum ${MUSIC_META_MINIMUM_RECORD_COUNT})`]
      )
    };
  }

  return { status: "available", dataset };
};

const validateInputs = (
  inputs: JpSoloYieldInputs,
  provenance: MusicMetaProvenance | null
):
  | { status: "available"; prepared: PreparedInputs }
  | {
      status: "unavailable";
      failure: JpSoloCalculationUnavailable;
    } => {
  if (typeof inputs.region !== "string" || inputs.region.trim() === "") {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "missing-inputs",
        "A region is required for this calculation.",
        provenance,
        ["region"]
      )
    };
  }
  if (inputs.region !== "jp") {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "unsupported-region",
        "JP Solo calculations are only supported for the jp region.",
        provenance
      )
    };
  }
  if (typeof inputs.mode !== "string" || inputs.mode.trim() === "") {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "missing-inputs",
        "A live mode is required for this calculation.",
        provenance,
        ["mode"]
      )
    };
  }
  if (inputs.mode !== "solo") {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        "unsupported-mode",
        "Only JP Solo score and event-point calculations are supported.",
        provenance
      )
    };
  }

  const missingFields = new Set<string>();
  const invalidFields = new Set<string>();
  const requireNumber = (
    key: "deckPower" | "deckBonus" | "boostMultiplier" | "cardLength",
    value: number | null,
    isValid: (candidate: number) => boolean
  ): number | null => {
    if (value === null || value === undefined) {
      addIssue(missingFields, key);
      return null;
    }
    if (typeof value !== "number" || !Number.isFinite(value) || !isValid(value)) {
      addIssue(invalidFields, key);
      return null;
    }
    return value;
  };

  const deckPower = requireNumber("deckPower", inputs.deckPower, (value) => value > 0);
  const deckBonus = requireNumber("deckBonus", inputs.deckBonus, (value) => value >= 0);
  const boostMultiplier = requireNumber(
    "boostMultiplier",
    inputs.boostMultiplier,
    (value) => Number.isSafeInteger(value) && value > 0
  );
  const cardLength = requireNumber(
    "cardLength",
    inputs.cardLength,
    (value) => Number.isSafeInteger(value) && value >= 1 && value <= 6
  );

  if (inputs.skillAllocation === null || inputs.skillAllocation === undefined) {
    addIssue(missingFields, "skillAllocation");
  }

  let skillAllocation: PreparedInputs["skillAllocation"] | null = null;
  if (inputs.skillAllocation?.strategy === "default") {
    const { skillEffects } = inputs.skillAllocation;
    if (skillEffects === null || skillEffects === undefined) {
      addIssue(missingFields, "skillAllocation.skillEffects");
    } else if (!Array.isArray(skillEffects)) {
      addIssue(invalidFields, "skillAllocation.skillEffects");
    } else if (cardLength !== null && skillEffects.length !== cardLength) {
      addIssue(invalidFields, "skillAllocation.skillEffects.length");
    } else if (
      skillEffects.some(
        (value: unknown) => typeof value !== "number" || !Number.isFinite(value) || value < 0
      )
    ) {
      addIssue(invalidFields, "skillAllocation.skillEffects");
    } else {
      skillAllocation = { strategy: "default", skillEffects: [...skillEffects] };
    }
  } else if (inputs.skillAllocation?.strategy === "explicit") {
    const { skillSequence } = inputs.skillAllocation;
    if (skillSequence === null || skillSequence === undefined) {
      addIssue(missingFields, "skillAllocation.skillSequence");
    } else if (!Array.isArray(skillSequence)) {
      addIssue(invalidFields, "skillAllocation.skillSequence");
    } else if (cardLength !== null && skillSequence.length !== cardLength) {
      addIssue(invalidFields, "skillAllocation.skillSequence.length");
    } else {
      const usedCoefficientIndices = new Set<number>();
      const parsedSkillSequence: JpSoloSkillAssignment[] = [];
      const rawSkillSequence: unknown[] = skillSequence;
      rawSkillSequence.forEach((entry, index) => {
        if (!isObject(entry)) {
          addIssue(invalidFields, `skillAllocation.skillSequence[${index}]`);
          return;
        }

        const coefficientIndex = entry.coefficientIndex;
        const effectiveSkillRate = entry.effectiveSkillRate;
        let validEntry = true;
        if (
          typeof coefficientIndex !== "number" ||
          !Number.isSafeInteger(coefficientIndex) ||
          coefficientIndex < 0 ||
          coefficientIndex >= 6
        ) {
          addIssue(invalidFields, `skillAllocation.skillSequence[${index}].coefficientIndex`);
          validEntry = false;
        } else if (usedCoefficientIndices.has(coefficientIndex)) {
          addIssue(invalidFields, `skillAllocation.skillSequence[${index}].coefficientIndex`);
          validEntry = false;
        } else {
          usedCoefficientIndices.add(coefficientIndex);
        }

        if (
          typeof effectiveSkillRate !== "number" ||
          !Number.isFinite(effectiveSkillRate) ||
          effectiveSkillRate < 0
        ) {
          addIssue(invalidFields, `skillAllocation.skillSequence[${index}].effectiveSkillRate`);
          validEntry = false;
        }
        if (validEntry) {
          parsedSkillSequence.push({
            coefficientIndex: coefficientIndex as number,
            effectiveSkillRate: effectiveSkillRate as number
          });
        }
      });
      if (parsedSkillSequence.length === skillSequence.length) {
        skillAllocation = {
          strategy: "explicit",
          skillSequence: parsedSkillSequence
        };
      }
    }
  } else if (inputs.skillAllocation !== null && inputs.skillAllocation !== undefined) {
    addIssue(invalidFields, "skillAllocation.strategy");
  }

  if (missingFields.size > 0 || invalidFields.size > 0) {
    return {
      status: "unavailable",
      failure: unavailableCalculation(
        missingFields.size > 0 ? "missing-inputs" : "invalid-inputs",
        missingFields.size > 0
          ? "One or more required JP Solo inputs are missing."
          : "One or more JP Solo inputs are invalid.",
        provenance,
        [...missingFields].sort(),
        [...invalidFields].sort()
      )
    };
  }

  return {
    status: "available",
    prepared: {
      deckPower: deckPower as number,
      deckBonus: deckBonus as number,
      boostMultiplier: boostMultiplier as number,
      cardLength: cardLength as number,
      skillAllocation: skillAllocation as PreparedInputs["skillAllocation"]
    }
  };
};

const calculateForMusic = (
  music: MusicMeta,
  inputs: PreparedInputs,
  provenance: MusicMetaProvenance
): JpSoloYieldAvailable | JpSoloCalculationUnavailable => {
  let skillPairs: { coefficientIndex: number; effectiveSkillRate: number }[];
  if (inputs.skillAllocation.strategy === "explicit") {
    skillPairs = inputs.skillAllocation.skillSequence;
  } else {
    const sortedSkills = inputs.skillAllocation.skillEffects
      .map((effectiveSkillRate, originalIndex) => ({ effectiveSkillRate, originalIndex }))
      .sort(
        (left, right) =>
          left.effectiveSkillRate - right.effectiveSkillRate ||
          left.originalIndex - right.originalIndex
      );
    const sortedCoefficients = music.skillScoreSolo
      .slice(0, inputs.cardLength)
      .map((coefficient, coefficientIndex) => ({ coefficient, coefficientIndex }))
      .sort(
        (left, right) =>
          left.coefficient - right.coefficient || left.coefficientIndex - right.coefficientIndex
      );
    skillPairs = sortedSkills.map((skill, index) => ({
      coefficientIndex: sortedCoefficients[index].coefficientIndex,
      effectiveSkillRate: skill.effectiveSkillRate
    }));
  }

  let skillScore = 0;
  for (const { coefficientIndex, effectiveSkillRate } of skillPairs) {
    skillScore += (music.skillScoreSolo[coefficientIndex] * effectiveSkillRate) / 100;
  }

  const score = Math.floor((music.baseScore + skillScore) * inputs.deckPower * 4);
  const eventPointBase = Math.floor(
    (100 + Math.floor(score / 20_000)) * (music.eventRate / 100) * (1 + inputs.deckBonus / 100)
  );
  const eventPoints = eventPointBase * inputs.boostMultiplier;

  if (!Number.isSafeInteger(score) || !Number.isSafeInteger(eventPoints)) {
    return unavailableCalculation(
      "invalid-inputs",
      "The JP Solo calculation exceeds the supported safe numeric range.",
      provenance,
      [],
      ["calculation result"]
    );
  }

  return {
    status: "available",
    music: { musicId: music.musicId, difficulty: music.difficulty, musicTime: music.musicTime },
    score,
    eventPoints,
    formulaVersion: JP_SOLO_FORMULA_VERSION,
    provenance
  };
};

/** Calculates one explicitly selected JP Solo song and difficulty. */
export const calculateJpSoloYield = (
  dataset: MusicMetaDataset | null,
  request: JpSoloYieldRequest
): JpSoloYieldResult => {
  const validatedDataset = validateDataset(dataset);
  if (validatedDataset.status === "unavailable") return validatedDataset.failure;

  const { provenance } = validatedDataset.dataset;
  const validatedInputs = validateInputs(request, provenance);
  if (validatedInputs.status === "unavailable") return validatedInputs.failure;

  const missingFields = new Set<string>();
  const invalidFields = new Set<string>();
  if (request.musicId === null || request.musicId === undefined) {
    addIssue(missingFields, "musicId");
  } else if (!Number.isSafeInteger(request.musicId) || request.musicId <= 0) {
    addIssue(invalidFields, "musicId");
  }

  const difficulty = normalizeDifficulty(request.difficulty);
  if (typeof request.difficulty !== "string" || request.difficulty.trim() === "") {
    addIssue(missingFields, "difficulty");
  } else if (difficulty === null) {
    addIssue(invalidFields, "difficulty");
  }

  if (missingFields.size > 0 || invalidFields.size > 0) {
    return unavailableCalculation(
      missingFields.size > 0 ? "missing-inputs" : "invalid-inputs",
      missingFields.size > 0
        ? "A song and difficulty are required for this calculation."
        : "The selected song or difficulty is invalid.",
      provenance,
      [...missingFields].sort(),
      [...invalidFields].sort()
    );
  }

  const music = validatedDataset.dataset.items.find(
    (item) => item.musicId === request.musicId && item.difficulty === difficulty
  );
  if (!music) {
    return unavailableCalculation(
      "incomplete-data",
      "The selected song and difficulty are not present in the validated source.",
      provenance,
      ["musicMeta"]
    );
  }

  return calculateForMusic(music, validatedInputs.prepared, provenance);
};

/** Ranks complete JP Solo results deterministically, independent of source record order. */
export const rankJpSoloRecommendations = (
  dataset: MusicMetaDataset | null,
  inputs: JpSoloYieldInputs,
  rankBy: "score" | "eventPoints"
): JpSoloRankingResult => {
  const validatedDataset = validateDataset(dataset);
  if (validatedDataset.status === "unavailable") return validatedDataset.failure;

  const { provenance } = validatedDataset.dataset;
  const validatedInputs = validateInputs(inputs, provenance);
  if (validatedInputs.status === "unavailable") return validatedInputs.failure;

  const calculated = validatedDataset.dataset.items.map((music) => {
    const result = calculateForMusic(music, validatedInputs.prepared, provenance);
    return result.status === "available" ? result : null;
  });
  if (calculated.some((result) => result === null)) {
    return unavailableCalculation(
      "invalid-inputs",
      "At least one music record could not be calculated safely.",
      provenance,
      [],
      ["calculation result"]
    );
  }

  const results = calculated.filter((result): result is JpSoloYieldAvailable => result !== null);
  const secondaryMetric = rankBy === "score" ? "eventPoints" : "score";
  results.sort((left, right) => {
    const primaryDifference = right[rankBy] - left[rankBy];
    const secondaryDifference = right[secondaryMetric] - left[secondaryMetric];
    return (
      primaryDifference ||
      secondaryDifference ||
      left.music.musicId - right.music.musicId ||
      (difficultyOrder.get(left.music.difficulty) ?? Number.MAX_SAFE_INTEGER) -
        (difficultyOrder.get(right.music.difficulty) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  return {
    status: "available",
    rankBy,
    items: results.map(({ music, score, eventPoints }, index) => ({
      rank: index + 1,
      music,
      score,
      eventPoints
    })),
    formulaVersion: JP_SOLO_FORMULA_VERSION,
    provenance
  };
};
