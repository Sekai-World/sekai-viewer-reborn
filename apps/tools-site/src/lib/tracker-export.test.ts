import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  createTrackerExportCsv,
  createTrackerExportReport,
  createTrackerExportRows,
  createTrackerExportSheetRows,
  createTrackerExportWorkbookBlob,
  createTrackerExportWorkbookBuffer,
  escapeCsvCell,
  flattenTrackerExportGroups,
  sanitizeTrackerExportSheetName,
  serializeTrackerExportValue,
  TRACKER_EXPORT_COLUMNS,
  TRACKER_EXPORT_SOURCES,
  type TrackerExportGroup
} from "./tracker-export";

const currentRow = {
  scope: "Current event",
  rank: 1,
  player: "Current player",
  userId: "current-id",
  score: 1200,
  speedPerHour: 100,
  reward: "Gold",
  capturedAt: "2026-01-01T00:00:00.000Z"
} as const;

const historyRow = {
  scope: "History snapshot",
  rank: 10,
  player: "History player",
  userId: "history-id",
  score: 900,
  speedPerHour: 75,
  reward: "Silver",
  capturedAt: "2025-12-31T23:00:00.000Z"
} as const;

describe("tracker export rows", () => {
  it("normalizes report rows without exposing internal source columns", () => {
    expect(createTrackerExportRows([currentRow])).toEqual([
      {
        scope: "Current event",
        rank: 1,
        player: "Current player",
        userId: "current-id",
        score: 1200,
        speedPerHour: 100,
        reward: "Gold",
        capturedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);
  });

  it("normalizes invalid optional values while preserving scalar cells", () => {
    expect(
      createTrackerExportRows([
        {
          scope: "History snapshot",
          rank: Number.NaN,
          score: Number.POSITIVE_INFINITY,
          speedPerHour: Number.NEGATIVE_INFINITY,
          reward: Number.NaN
        }
      ])
    ).toEqual([
      {
        scope: "History snapshot",
        rank: null,
        player: null,
        userId: null,
        score: null,
        speedPerHour: null,
        reward: null,
        capturedAt: null
      }
    ]);

    expect(serializeTrackerExportValue("Gold")).toBe("Gold");
    expect(serializeTrackerExportValue(25)).toBe(25);
    expect(serializeTrackerExportValue(false)).toBe(false);
    expect(serializeTrackerExportValue({ amount: 1 })).toBe('{"amount":1}');
    expect(serializeTrackerExportValue(Symbol("invalid"))).toBeNull();
  });

  it("keeps legacy source metadata out of the report shape", () => {
    expect(
      createTrackerExportRows([
        {
          section: "chapter",
          source: TRACKER_EXPORT_SOURCES.worldLinkChapter,
          player: "Chapter player"
        }
      ])
    ).toEqual([
      {
        scope: "World Link chapter",
        rank: null,
        player: "Chapter player",
        userId: null,
        score: null,
        speedPerHour: null,
        reward: null,
        capturedAt: null
      }
    ]);
  });
});

describe("tracker export CSV", () => {
  it("escapes quotes, commas, and line breaks", () => {
    expect(escapeCsvCell('Player, "quoted"\r\nname')).toBe('"Player, ""quoted""\r\nname"');
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
  });

  it("uses friendly columns and preserves human-readable values and numbers", () => {
    const csv = createTrackerExportCsv([currentRow]);

    expect(csv).toBe(
      [
        "Scope,Rank,Player,User ID,Score,Score / hour,Reward,Captured at",
        "Current event,1,Current player,current-id,1200,100,Gold,2026-01-01T00:00:00.000Z"
      ].join("\r\n")
    );
    expect(csv).not.toContain("section");
    expect(csv).not.toContain("source");
  });

  it("flattens report groups in caller order", () => {
    const groups: readonly TrackerExportGroup[] = [
      { label: "Current rankings", rows: [currentRow] },
      { label: "History", rows: [historyRow] },
      { label: "World Link chapters", rows: [{ ...currentRow, scope: "Chapter 2" }] }
    ];
    const report = createTrackerExportReport(groups);

    expect(flattenTrackerExportGroups(report)).toEqual([
      createTrackerExportRows([currentRow])[0],
      createTrackerExportRows([historyRow])[0],
      createTrackerExportRows([{ ...currentRow, scope: "Chapter 2" }])[0]
    ]);
    expect(
      createTrackerExportCsv(report)
        .split("\r\n")
        .slice(1)
        .map((row) => row.split(",")[0])
    ).toEqual(["Current event", "History snapshot", "Chapter 2"]);
  });

  it("allows caller-provided friendly column labels", () => {
    const columns = [
      { key: "scope", label: "Context" },
      { key: "rank", label: "Place" }
    ] as const;

    expect(createTrackerExportSheetRows([currentRow], columns)).toEqual([
      ["Context", "Place"],
      ["Current event", 1]
    ]);
  });
});

describe("tracker export XLSX", () => {
  it("writes one friendly worksheet per non-empty group", async () => {
    const report = createTrackerExportReport([
      {
        sheetName: "Current/rankings",
        label: "Current rankings",
        rows: [currentRow]
      },
      {
        sheetName: "History:snapshots",
        label: "History snapshots",
        rows: [historyRow]
      },
      { sheetName: "Empty group", rows: [] }
    ]);
    const buffer = await createTrackerExportWorkbookBuffer(report);
    const workbook = XLSX.read(buffer, { type: "array" });

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(workbook.SheetNames).toEqual(["Current_rankings", "History_snapshots"]);

    const currentSheet = workbook.Sheets.Current_rankings;
    expect(currentSheet).toBeDefined();
    expect(
      currentSheet ? XLSX.utils.sheet_to_json(currentSheet, { header: 1, raw: true }) : []
    ).toEqual([
      TRACKER_EXPORT_COLUMNS.map(({ label }) => label),
      [
        "Current event",
        1,
        "Current player",
        "current-id",
        1200,
        100,
        "Gold",
        "2026-01-01T00:00:00.000Z"
      ]
    ]);

    const historySheet = workbook.Sheets.History_snapshots;
    expect(
      historySheet ? XLSX.utils.sheet_to_json(historySheet, { header: 1, raw: true })[0] : []
    ).toEqual(TRACKER_EXPORT_COLUMNS.map(({ label }) => label));
  });

  it("sanitizes and de-duplicates worksheet names", async () => {
    expect(sanitizeTrackerExportSheetName("  invalid:/?*[] name  ")).toBe("invalid______ name");
    expect(sanitizeTrackerExportSheetName("x".repeat(40))).toHaveLength(31);
    expect(sanitizeTrackerExportSheetName("   ")).toBe("tracker");

    const buffer = await createTrackerExportWorkbookBuffer([
      { sheetName: "A/B", rows: [currentRow] },
      { sheetName: "A:B", rows: [historyRow] }
    ]);
    const workbook = XLSX.read(buffer, { type: "array" });

    expect(workbook.SheetNames).toEqual(["A_B", "A_B (2)"]);
  });

  it("provides a browser-downloadable workbook Blob", async () => {
    const blob = await createTrackerExportWorkbookBlob([currentRow]);

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(0);
  });
});
