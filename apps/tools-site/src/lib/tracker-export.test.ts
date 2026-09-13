import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  createTrackerExportCsv,
  createTrackerExportRows,
  createTrackerExportSheetRows,
  createTrackerExportWorkbookBlob,
  createTrackerExportWorkbookBuffer,
  escapeCsvCell,
  mergeTrackerExportRows,
  TRACKER_EXPORT_COLUMNS,
  TRACKER_EXPORT_SOURCES
} from "./tracker-export";

describe("tracker export rows", () => {
  it("normalizes current, history, and World Link rows in input order", () => {
    const rows = mergeTrackerExportRows(
      [
        {
          section: "event",
          source: TRACKER_EXPORT_SOURCES.currentEvent,
          rank: 1,
          player: "Current player",
          userId: "current-id",
          score: 1200,
          speedPerHour: 100,
          reward: "gold",
          capturedAt: "2026-01-01T00:00:00.000Z"
        }
      ],
      [
        {
          section: "event",
          source: TRACKER_EXPORT_SOURCES.historySnapshot,
          rank: 10,
          player: "History player",
          userId: "history-id",
          score: 900,
          speedPerHour: 75,
          reward: "silver",
          capturedAt: "2025-12-31T23:00:00.000Z"
        }
      ],
      [
        {
          section: "chapter",
          source: TRACKER_EXPORT_SOURCES.worldLinkChapter,
          rank: 100,
          player: "Chapter player",
          userId: "chapter-id",
          score: 500,
          speedPerHour: 50,
          reward: { type: "badge", amount: 1 },
          capturedAt: "2026-01-01T01:00:00.000Z"
        }
      ]
    );

    expect(rows).toEqual([
      {
        section: "event",
        source: "current-event",
        rank: 1,
        player: "Current player",
        userId: "current-id",
        score: 1200,
        speedPerHour: 100,
        reward: "gold",
        capturedAt: "2026-01-01T00:00:00.000Z"
      },
      {
        section: "event",
        source: "history-snapshot",
        rank: 10,
        player: "History player",
        userId: "history-id",
        score: 900,
        speedPerHour: 75,
        reward: "silver",
        capturedAt: "2025-12-31T23:00:00.000Z"
      },
      {
        section: "chapter",
        source: "world-link-chapter",
        rank: 100,
        player: "Chapter player",
        userId: "chapter-id",
        score: 500,
        speedPerHour: 50,
        reward: '{"type":"badge","amount":1}',
        capturedAt: "2026-01-01T01:00:00.000Z"
      }
    ]);
  });

  it("turns missing and non-finite optional values into nulls", () => {
    expect(
      createTrackerExportRows([
        { section: "event", source: TRACKER_EXPORT_SOURCES.currentEvent, score: Number.NaN }
      ])
    ).toEqual([
      {
        section: "event",
        source: "current-event",
        rank: null,
        player: null,
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

  it("keeps the stable column order and maps fields by key", () => {
    const csv = createTrackerExportCsv([
      {
        section: "event",
        source: TRACKER_EXPORT_SOURCES.currentEvent,
        rank: 1,
        player: 'Player, "A"\nline',
        userId: "user-1",
        score: 200,
        speedPerHour: 20,
        reward: "reward",
        capturedAt: "2026-01-01T00:00:00.000Z"
      }
    ]);

    expect(csv).toBe(
      [
        "section,source,rank,player,userId,score,speedPerHour,reward,capturedAt",
        'event,current-event,1,"Player, ""A""\nline",user-1,200,20,reward,2026-01-01T00:00:00.000Z'
      ].join("\r\n")
    );
  });

  it("allows caller-provided column labels", () => {
    const columns = [
      { key: "source", label: "source_code" },
      { key: "rank", label: "rank_number" }
    ] as const;

    expect(
      createTrackerExportSheetRows(
        [{ section: "chapter", source: TRACKER_EXPORT_SOURCES.worldLinkChapter, rank: 10 }],
        columns
      )
    ).toEqual([
      ["source_code", "rank_number"],
      ["world-link-chapter", 10]
    ]);
  });
});

describe("tracker export XLSX", () => {
  const rows = [
    {
      section: "event",
      source: TRACKER_EXPORT_SOURCES.historySnapshot,
      rank: 10,
      player: "History player",
      userId: "history-id",
      score: 900,
      speedPerHour: 75,
      reward: "silver",
      capturedAt: "2025-12-31T23:00:00.000Z"
    }
  ];

  it("writes stable sheet rows to a workbook buffer", async () => {
    const buffer = await createTrackerExportWorkbookBuffer(rows, { sheetName: "history" });
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets.history;

    expect(buffer).toBeInstanceOf(ArrayBuffer);
    expect(workbook.SheetNames).toEqual(["history"]);
    expect(sheet).toBeDefined();
    expect(sheet ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) : []).toEqual([
      TRACKER_EXPORT_COLUMNS.map(({ label }) => label),
      [
        "event",
        "history-snapshot",
        10,
        "History player",
        "history-id",
        900,
        75,
        "silver",
        "2025-12-31T23:00:00.000Z"
      ]
    ]);
  });

  it("provides a browser-downloadable workbook Blob", async () => {
    const blob = await createTrackerExportWorkbookBlob(rows);

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(blob.size).toBeGreaterThan(0);
  });
});
