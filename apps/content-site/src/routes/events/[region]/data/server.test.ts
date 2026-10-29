import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEventsByRegionList: vi.fn(),
  getMasterApiBaseUrl: vi.fn(() => "https://master.example.test")
}));

vi.mock("@platform/sekai-master-api-sdk", () => ({
  getEventsByRegionList: mocks.getEventsByRegionList
}));
vi.mock("#lib/server/config.js", () => ({ getMasterApiBaseUrl: mocks.getMasterApiBaseUrl }));

import { GET } from "./+server";

const request = (search = "") =>
  ({
    params: { region: "en" },
    url: new URL(`https://content.example.test/events/en/data${search}`)
  }) as never;

describe("event list data route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns parsed event data and forwards normalized filters to the SDK", async () => {
    mocks.getEventsByRegionList.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 42,
            name: "Wonder event",
            eventType: "marathon",
            unit: "none",
            assetbundleName: "event_042",
            startAt: "2026-01-01T00:00:00Z",
            endAt: 1767312000
          }
        ],
        pagination: { page: 2, page_size: 20, total: 23, total_pages: 2, has_next: false }
      },
      response: new Response(null, {
        headers: {
          "content-length": "123",
          "content-type": "application/json",
          "x-request-id": "r1"
        }
      })
    });

    const response = await GET(
      request(
        "?page=2&sort_by=id&sort_order=asc&name=%20Wonder%20&event_type=marathon&unit=mixed&spoiler=true"
      )
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      items: [
        {
          id: "42",
          title: "Wonder event",
          eventType: "marathon",
          unit: "mixed",
          assetBundleName: "event_042",
          startAt: "2026-01-01T00:00:00Z",
          endAt: 1767312000
        }
      ],
      pagination: { page: 2, pageSize: 20, hasNext: false, total: 23, totalPages: 2 }
    });
    expect(mocks.getEventsByRegionList).toHaveBeenCalledWith({
      baseUrl: "https://master.example.test",
      path: { region: "en" },
      query: {
        page: 2,
        page_size: 20,
        spoiler: true,
        sort_by: "id",
        sort_order: "asc",
        name: "Wonder",
        event_type: "marathon",
        unit: "none"
      }
    });
  });

  it("returns a server error response when the SDK reports an error", async () => {
    mocks.getEventsByRegionList.mockResolvedValueOnce({
      error: new Error("upstream unavailable"),
      response: new Response(null, { status: 503 })
    });

    const response = await GET(request());

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: true });
  });

  it("returns a server error response when the SDK request rejects", async () => {
    mocks.getEventsByRegionList.mockRejectedValueOnce(new Error("network unavailable"));

    const response = await GET(request("?page=0"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: true });
  });
});
