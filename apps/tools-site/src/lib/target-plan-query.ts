import { MUSIC_META_DIFFICULTIES, type MusicMetaDifficulty } from "#lib/music-recommender.js";
import {
  PLANNER_MAX_PLAYS,
  PLANNER_MAX_TARGET,
  type PlannerObjective,
  type PlannerSongRef
} from "#lib/target-planner.js";

/**
 * Parses the target-plan controls of the music recommender route. The same rules run on the
 * server (from the URL) and in the form (before submitting), so both reject the same input.
 */

export const PLAN_QUERY_PARAMETER_NAMES = [
  "target",
  "objective",
  "maxPlays",
  "repeats",
  "difficulties",
  "required"
] as const;

export const DEFAULT_PLAN_OBJECTIVE: PlannerObjective = "fewestPlays";
export const DEFAULT_PLAN_MAX_PLAYS = "100";

/** The form's values as typed, echoed back so an invalid entry is never silently replaced. */
export type PlanFormInputs = {
  target: string;
  objective: PlannerObjective;
  maxPlays: string;
  allowRepeats: boolean;
  /** Empty means every difficulty. */
  difficulties: MusicMetaDifficulty[];
  requiredSongs: string;
};

export type PlanRequest = {
  target: number;
  objective: PlannerObjective;
  maxPlays: number;
  allowRepeats: boolean;
  allowedDifficulties: MusicMetaDifficulty[] | null;
  requiredSongs: PlannerSongRef[];
};

export type ParsedPlanQuery =
  | { status: "idle"; inputs: PlanFormInputs }
  | {
      status: "invalid";
      inputs: PlanFormInputs;
      missingFields: string[];
      invalidFields: string[];
    }
  | { status: "ready"; inputs: PlanFormInputs; request: PlanRequest };

const OBJECTIVES: readonly PlannerObjective[] = ["fewestPlays", "leastOvershoot"];

export const makeDefaultPlanInputs = (): PlanFormInputs => ({
  target: "",
  objective: DEFAULT_PLAN_OBJECTIVE,
  maxPlays: DEFAULT_PLAN_MAX_PLAYS,
  allowRepeats: true,
  difficulties: [],
  requiredSongs: ""
});

const isDifficulty = (value: string): value is MusicMetaDifficulty =>
  (MUSIC_META_DIFFICULTIES as readonly string[]).includes(value);

const isObjective = (value: string | null): value is PlannerObjective =>
  value !== null && (OBJECTIVES as readonly string[]).includes(value);

/** A plain base-10 whole number within 1..max; signs, decimals, and exponents are refused. */
const readWholeNumber = (value: string, max: number): number | null => {
  const text = value.trim();
  if (!/^\d+$/.test(text)) return null;
  const parsed = Number(text);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max ? parsed : null;
};

type Issues = { missingFields: string[]; invalidFields: string[] };

const readSingle = (searchParams: URLSearchParams, key: string, issues: Issues): string | null => {
  const values = searchParams.getAll(key);
  if (values.length > 1) issues.invalidFields.push(key);
  return values[0] ?? null;
};

const readDifficulties = (
  value: string | null,
  issues: Issues
): { list: MusicMetaDifficulty[]; selected: MusicMetaDifficulty[] | null } => {
  if (value === null || value.trim() === "") return { list: [], selected: null };
  const list: MusicMetaDifficulty[] = [];
  value.split(",").forEach((entry, index) => {
    const name = entry.trim();
    if (!isDifficulty(name) || list.includes(name)) {
      issues.invalidFields.push(`difficulties[${index}]`);
      return;
    }
    list.push(name);
  });
  return { list, selected: list };
};

/** Songs are written as `songId:difficulty`, separated by commas. */
const readRequiredSongs = (value: string | null, issues: Issues): PlannerSongRef[] => {
  if (value === null || value.trim() === "") return [];
  const songs: PlannerSongRef[] = [];
  const seen = new Set<string>();
  value.split(",").forEach((entry, index) => {
    const match = /^(\d+):([a-z]+)$/.exec(entry.trim());
    const musicId = match === null ? null : readWholeNumber(match[1], Number.MAX_SAFE_INTEGER);
    const difficulty = match?.[2];
    if (musicId === null || difficulty === undefined || !isDifficulty(difficulty)) {
      issues.invalidFields.push(`required[${index}]`);
      return;
    }
    const key = `${musicId}:${difficulty}`;
    if (seen.has(key)) {
      issues.invalidFields.push(`required[${index}]`);
      return;
    }
    seen.add(key);
    songs.push({ musicId, difficulty });
  });
  return songs;
};

const compareText = (left: string, right: string): number => left.localeCompare(right, "en");

type FieldReading<T> = { text: string | null; value: T | null };

/** A control that must be present: absent is a missing field, unparsable is an invalid one. */
const readRequiredField = <T>(
  searchParams: URLSearchParams,
  key: string,
  issues: Issues,
  parse: (text: string) => T | null
): FieldReading<T> => {
  const text = readSingle(searchParams, key, issues);
  if (text === null) {
    issues.missingFields.push(key);
    return { text, value: null };
  }
  const value = parse(text);
  if (value === null) issues.invalidFields.push(key);
  return { text, value };
};

const parseObjective = (text: string): PlannerObjective | null => (isObjective(text) ? text : null);

const parseBoolean = (text: string): boolean | null => {
  if (text === "true") return true;
  if (text === "false") return false;
  return null;
};

export const parseTargetPlanQuery = (searchParams: URLSearchParams): ParsedPlanQuery => {
  const defaults = makeDefaultPlanInputs();
  if (!PLAN_QUERY_PARAMETER_NAMES.some((name) => searchParams.has(name))) {
    return { status: "idle", inputs: defaults };
  }

  const issues: Issues = { missingFields: [], invalidFields: [] };
  const target = readRequiredField(searchParams, "target", issues, (text) =>
    readWholeNumber(text, PLANNER_MAX_TARGET)
  );
  const objective = readRequiredField(searchParams, "objective", issues, parseObjective);
  const maxPlays = readRequiredField(searchParams, "maxPlays", issues, (text) =>
    readWholeNumber(text, PLANNER_MAX_PLAYS)
  );
  const repeats = readRequiredField(searchParams, "repeats", issues, parseBoolean);
  const difficulties = readDifficulties(readSingle(searchParams, "difficulties", issues), issues);
  const requiredText = readSingle(searchParams, "required", issues);
  const requiredSongs = readRequiredSongs(requiredText, issues);

  const inputs: PlanFormInputs = {
    target: target.text ?? defaults.target,
    objective: objective.value ?? defaults.objective,
    maxPlays: maxPlays.text ?? defaults.maxPlays,
    allowRepeats: repeats.value ?? defaults.allowRepeats,
    difficulties: difficulties.list,
    requiredSongs: requiredText ?? defaults.requiredSongs
  };

  // A missing or unparsable control always records an issue, so no issue means every value is set.
  if (issues.missingFields.length > 0 || issues.invalidFields.length > 0) {
    return {
      status: "invalid",
      inputs,
      missingFields: [...issues.missingFields].sort(compareText),
      invalidFields: [...issues.invalidFields].sort(compareText)
    };
  }

  return {
    status: "ready",
    inputs,
    request: {
      target: target.value as number,
      objective: objective.value as PlannerObjective,
      maxPlays: maxPlays.value as number,
      allowRepeats: repeats.value as boolean,
      allowedDifficulties: difficulties.selected,
      requiredSongs
    }
  };
};

/** Builds the query parameters for a form submission; empty optional values are left out. */
export const buildPlanQuery = (values: PlanFormInputs): Record<string, string> => {
  const params: Record<string, string> = {
    target: values.target.trim(),
    objective: values.objective,
    maxPlays: values.maxPlays.trim(),
    repeats: String(values.allowRepeats),
    difficulties: values.difficulties.join(","),
    required: values.requiredSongs.trim()
  };
  return params;
};
