import writeExcelFile, { type SheetData } from "write-excel-file/browser";

export const TRACKER_EXPORT_SECTIONS = {
  event: "event",
  chapter: "chapter"
} as const;

export type TrackerExportSection =
  (typeof TRACKER_EXPORT_SECTIONS)[keyof typeof TRACKER_EXPORT_SECTIONS];

export const TRACKER_EXPORT_SOURCES = {
  currentEvent: "current-event",
  historySnapshot: "history-snapshot",
  worldLinkChapter: "world-link-chapter"
} as const;

export type TrackerExportSource =
  (typeof TRACKER_EXPORT_SOURCES)[keyof typeof TRACKER_EXPORT_SOURCES];

export type TrackerExportCellValue = string | number | boolean | null;

/** A normalized, report-oriented row that can be written to CSV or XLSX. */
export type TrackerExportRow = Readonly<{
  scope: string | null;
  rank: number | null;
  player: string | null;
  userId: string | null;
  score: number | null;
  speedPerHour: number | null;
  reward: TrackerExportCellValue;
  capturedAt: string | null;
}>;

export type TrackerExportRowInput = Readonly<{
  /** Human-readable context such as "Current event" or "Chapter 2". */
  scope?: string | null;
  rank?: number | null;
  player?: string | null;
  userId?: string | null;
  score?: number | null;
  speedPerHour?: number | null;
  reward?: unknown;
  capturedAt?: string | null;

  /**
   * Deprecated source metadata accepted while callers migrate to `scope`.
   * These fields are never included in the default report columns.
   */
  section?: string | null;
  source?: string | null;
}>;

export type TrackerExportColumnKey = keyof TrackerExportRow;

export type TrackerExportColumn = Readonly<{
  key: TrackerExportColumnKey;
  label: string;
}>;

/** Human-readable report columns used by CSV and every XLSX worksheet. */
export const TRACKER_EXPORT_COLUMNS = [
  { key: "scope", label: "Scope" },
  { key: "rank", label: "Rank" },
  { key: "player", label: "Player" },
  { key: "userId", label: "User ID" },
  { key: "score", label: "Score" },
  { key: "speedPerHour", label: "Score / hour" },
  { key: "reward", label: "Reward" },
  { key: "capturedAt", label: "Captured at" }
] as const satisfies readonly TrackerExportColumn[];

export type TrackerExportSheetRow = TrackerExportCellValue[];

/** A logical report group. `label` is used as the sheet-name fallback. */
export type TrackerExportGroup = Readonly<{
  rows: readonly TrackerExportRowInput[];
  sheetName?: string;
  label?: string;
}>;

export type TrackerExportReport = Readonly<{
  groups: readonly TrackerExportGroup[];
}>;

export type TrackerExportTableInput =
  readonly TrackerExportRowInput[] | readonly TrackerExportGroup[] | TrackerExportReport;

const DEFAULT_SHEET_NAME = "tracker";

const LEGACY_SCOPE_LABELS: Readonly<Record<string, string>> = {
  [TRACKER_EXPORT_SOURCES.currentEvent]: "Current event",
  [TRACKER_EXPORT_SOURCES.historySnapshot]: "History snapshot",
  [TRACKER_EXPORT_SOURCES.worldLinkChapter]: "World Link chapter"
};

const normalizeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeString = (value: unknown): string | null =>
  typeof value === "string" ? value : null;

/** Converts an arbitrary reward value into one scalar that CSV/XLSX can store. */
export const serializeTrackerExportValue = (value: unknown): TrackerExportCellValue => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "object") return null;

  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? serialized : null;
  } catch {
    return null;
  }
};

const getLegacyScope = (source: string | null | undefined): string | null =>
  source === undefined || source === null ? null : (LEGACY_SCOPE_LABELS[source] ?? null);

/** Normalizes source-specific rows into the clean report row shape. */
export const createTrackerExportRows = (
  rows: readonly TrackerExportRowInput[]
): TrackerExportRow[] =>
  rows.map((row) => ({
    scope: normalizeString(row.scope) ?? getLegacyScope(row.source),
    rank: normalizeNumber(row.rank),
    player: normalizeString(row.player),
    userId: normalizeString(row.userId),
    score: normalizeNumber(row.score),
    speedPerHour: normalizeNumber(row.speedPerHour),
    reward: serializeTrackerExportValue(row.reward),
    capturedAt: normalizeString(row.capturedAt)
  }));

/** Concatenates row groups while preserving the caller's order. */
export const mergeTrackerExportRows = (
  ...rowGroups: (readonly TrackerExportRowInput[])[]
): TrackerExportRow[] => rowGroups.flatMap((rows) => createTrackerExportRows(rows));

/** Creates a report model without changing group or row order. */
export const createTrackerExportReport = (
  groups: readonly TrackerExportGroup[]
): TrackerExportReport => ({
  groups: groups.map((group) => ({
    ...group,
    rows: createTrackerExportRows(group.rows)
  }))
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isTrackerExportGroup = (value: unknown): value is TrackerExportGroup =>
  isRecord(value) && Array.isArray(value.rows);

const isTrackerExportGroupArray = (value: unknown): value is readonly TrackerExportGroup[] =>
  Array.isArray(value) && value.every(isTrackerExportGroup);

const isTrackerExportReport = (value: unknown): value is TrackerExportReport =>
  isRecord(value) && isTrackerExportGroupArray(value.groups);

/** Flattens report groups for CSV, preserving group order and each row's order. */
export const flattenTrackerExportGroups = (
  groupsOrReport: readonly TrackerExportGroup[] | TrackerExportReport
): TrackerExportRow[] => {
  const groups = isTrackerExportReport(groupsOrReport) ? groupsOrReport.groups : groupsOrReport;
  return groups.flatMap((group) => createTrackerExportRows(group.rows));
};

const flattenTrackerExportInput = (input: TrackerExportTableInput): TrackerExportRow[] => {
  if (isTrackerExportReport(input)) return flattenTrackerExportGroups(input);
  if (isTrackerExportGroupArray(input)) return flattenTrackerExportGroups(input);
  return createTrackerExportRows(input);
};

/** Creates the two-dimensional table consumed by the CSV and XLSX writers. */
export const createTrackerExportSheetRows = (
  rows: readonly TrackerExportRowInput[],
  columns: readonly TrackerExportColumn[] = TRACKER_EXPORT_COLUMNS
): TrackerExportSheetRow[] => {
  const normalizedRows = createTrackerExportRows(rows);
  const header: TrackerExportSheetRow = columns.map(({ label }) => label);

  return [header, ...normalizedRows.map((row) => columns.map(({ key }) => row[key]))];
};

/** Escapes one CSV cell according to RFC 4180-style quoting rules. */
export const escapeCsvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

/** Creates a friendly, flat CSV report from rows, groups, or a report model. */
export const createTrackerExportCsv = (
  input: TrackerExportTableInput,
  columns: readonly TrackerExportColumn[] = TRACKER_EXPORT_COLUMNS
): string => {
  const rows = flattenTrackerExportInput(input);
  return createTrackerExportSheetRows(rows, columns)
    .map((row) => row.map((value) => escapeCsvCell(value)).join(","))
    .join("\r\n");
};

export type TrackerExportWorkbookOptions = Readonly<{
  columns?: readonly TrackerExportColumn[];
  /** Used for the backwards-compatible raw-row overload. */
  sheetName?: string;
}>;

export const TRACKER_EXPORT_XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Makes a caller-provided worksheet name safe for Excel. */
export const sanitizeTrackerExportSheetName = (sheetName: string | null | undefined): string => {
  const normalized = (sheetName ?? "")
    .trim()
    .replaceAll(/[:\\/?*\x5B\x5D]/gu, "_")
    .slice(0, 31);
  return normalized || DEFAULT_SHEET_NAME;
};

const createUniqueSheetName = (requestedName: string, usedNames: Set<string>): string => {
  const baseName = sanitizeTrackerExportSheetName(requestedName);
  if (!usedNames.has(baseName.toLocaleLowerCase())) return baseName;

  let suffixNumber = 2;
  while (true) {
    const suffix = ` (${suffixNumber})`;
    const candidate = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
    if (!usedNames.has(candidate.toLocaleLowerCase())) return candidate;
    suffixNumber += 1;
  }
};

const getWorkbookGroups = (
  input: TrackerExportTableInput,
  options: TrackerExportWorkbookOptions
): readonly TrackerExportGroup[] => {
  if (isTrackerExportReport(input)) return input.groups;
  if (isTrackerExportGroupArray(input)) return input;
  return [{ sheetName: options.sheetName ?? DEFAULT_SHEET_NAME, rows: input }];
};

const createTrackerExportWorkbookSheets = (
  input: TrackerExportTableInput,
  options: TrackerExportWorkbookOptions
): Array<{ data: SheetData; sheet: string }> => {
  const sheets: Array<{ data: SheetData; sheet: string }> = [];
  const columns = options.columns ?? TRACKER_EXPORT_COLUMNS;
  const usedNames = new Set<string>();

  for (const group of getWorkbookGroups(input, options)) {
    const rows = createTrackerExportRows(group.rows);
    if (rows.length === 0) continue;

    const requestedName = group.sheetName?.trim() || group.label?.trim() || DEFAULT_SHEET_NAME;
    const sheetName = createUniqueSheetName(requestedName, usedNames);
    usedNames.add(sheetName.toLocaleLowerCase());
    sheets.push({
      data: createTrackerExportSheetRows(rows, columns),
      sheet: sheetName
    });
  }

  return sheets;
};

/** Builds an XLSX report, or null when no logical group contains rows. */
export const createTrackerExportWorkbookBuffer = async (
  input: TrackerExportTableInput,
  options: TrackerExportWorkbookOptions = {}
): Promise<ArrayBuffer | null> => {
  const blob = await createTrackerExportWorkbookBlob(input, options);
  return blob?.arrayBuffer() ?? null;
};

/** Creates a browser-downloadable XLSX Blob, or null when the report has no rows. */
export const createTrackerExportWorkbookBlob = async (
  input: TrackerExportTableInput,
  options: TrackerExportWorkbookOptions = {}
): Promise<Blob | null> => {
  const sheets = createTrackerExportWorkbookSheets(input, options);
  if (sheets.length === 0) return null;
  return writeExcelFile(sheets).toBlob();
};
