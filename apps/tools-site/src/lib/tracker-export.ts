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

export type TrackerExportRow = Readonly<{
  section: string;
  source: string;
  rank: number | null;
  player: string | null;
  userId: string | null;
  score: number | null;
  speedPerHour: number | null;
  reward: TrackerExportCellValue;
  capturedAt: string | null;
}>;

export type TrackerExportRowInput = Readonly<{
  section: string;
  source: string;
  rank?: number | null;
  player?: string | null;
  userId?: string | null;
  score?: number | null;
  speedPerHour?: number | null;
  reward?: unknown;
  capturedAt?: string | null;
}>;

export type TrackerExportColumnKey = keyof TrackerExportRow;

export type TrackerExportColumn = Readonly<{
  key: TrackerExportColumnKey;
  label: string;
}>;

/** Stable machine-column names. Callers can provide translated labels instead. */
export const TRACKER_EXPORT_COLUMNS = [
  { key: "section", label: "section" },
  { key: "source", label: "source" },
  { key: "rank", label: "rank" },
  { key: "player", label: "player" },
  { key: "userId", label: "userId" },
  { key: "score", label: "score" },
  { key: "speedPerHour", label: "speedPerHour" },
  { key: "reward", label: "reward" },
  { key: "capturedAt", label: "capturedAt" }
] as const satisfies readonly TrackerExportColumn[];

export type TrackerExportSheetRow = TrackerExportCellValue[];

const normalizeNumber = (value: number | null | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeString = (value: string | null | undefined): string | null =>
  typeof value === "string" ? value : null;

/** Converts an arbitrary reward value into a scalar that can be written to CSV/XLSX. */
export const serializeTrackerExportValue = (value: unknown): TrackerExportCellValue => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? null : serialized;
  } catch {
    return String(value);
  }
};

/** Normalizes source-specific rows into one JSON-serializable export shape. */
export const createTrackerExportRows = (
  rows: readonly TrackerExportRowInput[]
): TrackerExportRow[] =>
  rows.map((row) => ({
    section: row.section,
    source: row.source,
    rank: normalizeNumber(row.rank),
    player: normalizeString(row.player),
    userId: normalizeString(row.userId),
    score: normalizeNumber(row.score),
    speedPerHour: normalizeNumber(row.speedPerHour),
    reward: serializeTrackerExportValue(row.reward),
    capturedAt: normalizeString(row.capturedAt)
  }));

/** Concatenates multiple export sections while preserving each group's row order. */
export const mergeTrackerExportRows = (
  ...rowGroups: (readonly TrackerExportRowInput[])[]
): TrackerExportRow[] => rowGroups.flatMap((rows) => createTrackerExportRows(rows));

/** Creates the two-dimensional table consumed by both CSV and XLSX writers. */
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

export const createTrackerExportCsv = (
  rows: readonly TrackerExportRowInput[],
  columns: readonly TrackerExportColumn[] = TRACKER_EXPORT_COLUMNS
): string =>
  createTrackerExportSheetRows(rows, columns)
    .map((row) => row.map((value) => escapeCsvCell(value)).join(","))
    .join("\r\n");

export type TrackerExportWorkbookOptions = Readonly<{
  columns?: readonly TrackerExportColumn[];
  sheetName?: string;
}>;

export const TRACKER_EXPORT_XLSX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const DEFAULT_SHEET_NAME = "tracker";

const normalizeSheetName = (sheetName: string | undefined): string => {
  const normalized = (sheetName ?? DEFAULT_SHEET_NAME)
    .trim()
    .replaceAll(":", "_")
    .replaceAll("\\", "_")
    .replaceAll("/", "_")
    .replaceAll("?", "_")
    .replaceAll("*", "_")
    .replaceAll("[", "_")
    .replaceAll("]", "_")
    .slice(0, 31);
  return normalized || DEFAULT_SHEET_NAME;
};

const toArrayBuffer = (value: unknown): ArrayBuffer => {
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    const bytes = new Uint8Array(new ArrayBuffer(value.byteLength));
    bytes.set(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return bytes.buffer;
  }
  throw new TypeError("The XLSX writer did not return an array buffer");
};

/** Builds an XLSX workbook without importing the browser-facing library during SSR module evaluation. */
export const createTrackerExportWorkbookBuffer = async (
  rows: readonly TrackerExportRowInput[],
  options: TrackerExportWorkbookOptions = {}
): Promise<ArrayBuffer> => {
  const xlsx = await import("xlsx");
  const workbook = xlsx.utils.book_new();
  const worksheet = xlsx.utils.aoa_to_sheet(
    createTrackerExportSheetRows(rows, options.columns ?? TRACKER_EXPORT_COLUMNS)
  );
  xlsx.utils.book_append_sheet(workbook, worksheet, normalizeSheetName(options.sheetName));

  return toArrayBuffer(xlsx.write(workbook, { bookType: "xlsx", type: "array" }));
};

/** Creates a browser-downloadable XLSX Blob from the same workbook data. */
export const createTrackerExportWorkbookBlob = async (
  rows: readonly TrackerExportRowInput[],
  options: TrackerExportWorkbookOptions = {}
): Promise<Blob> => {
  const buffer = await createTrackerExportWorkbookBuffer(rows, options);
  return new Blob([buffer], { type: TRACKER_EXPORT_XLSX_MIME_TYPE });
};
