import type { HandleServerError } from "@sveltejs/kit/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleError } from "./hooks.server";

type HandleErrorInput = Parameters<HandleServerError>[0];

const secretQuery = "token=query-secret";
const secretCookie = "session=cookie-secret";
const secretHeader = "Bearer header-secret";

const createEvent = (): HandleErrorInput["event"] =>
  ({
    request: new Request(`https://tools.example/tracker/jp?eventId=12&${secretQuery}`, {
      method: "GET",
      headers: { authorization: secretHeader, cookie: secretCookie }
    }),
    url: new URL(`https://tools.example/tracker/jp?eventId=12&${secretQuery}`),
    route: { id: "/tracker/[region]" },
    params: { region: "jp" },
    cookies: { get: () => "cookie-secret" }
  }) as unknown as HandleErrorInput["event"];

const callHandleError = async (input: Omit<HandleErrorInput, "event">) =>
  handleError({ ...input, event: createEvent() } as HandleErrorInput);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("tools-site handleError", () => {
  it("keeps expected 404 errors unchanged and unlogged", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      callHandleError({ kind: "app", error: { status: 404, message: "Region not found" } })
    ).resolves.toBeUndefined();
    await expect(
      callHandleError({ kind: "framework", error: { status: 404, message: "Not Found" } })
    ).resolves.toBeUndefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("returns a generic message with a correlation id for an unexpected error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await callHandleError({
      kind: "unknown",
      error: new Error(`Missing required environment variable: SEKAI_API_BASE_URL`)
    });

    expect(result).toEqual({
      message: "Internal Error",
      errorId: expect.stringMatching(/^[0-9a-f-]{36}$/)
    });
    expect(JSON.stringify(result)).not.toContain("SEKAI_API_BASE_URL");
  });

  it("logs the correlation id, status, and route without request URL, headers, or cookies", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await callHandleError({ kind: "unknown", error: new Error("upstream failed") });

    expect(consoleError).toHaveBeenCalledTimes(1);
    const [label, payload, chain] = consoleError.mock.calls[0] ?? [];
    expect(label).toBe("tools-site: unexpected server error");
    expect(payload).toEqual({
      errorId: result?.errorId,
      status: 500,
      method: "GET",
      routeId: "/tracker/[region]"
    });
    expect(chain).toContain("Error: upstream failed\n    at ");

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("tools.example");
    expect(logged).not.toContain("query-secret");
    expect(logged).not.toContain("eventId=12");
    expect(logged).not.toContain("cookie-secret");
    expect(logged).not.toContain("header-secret");
  });

  it("logs every link of the cause chain, including a non-Error root cause", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const networkFailure = new Error("connect ECONNREFUSED 10.0.0.5:8080");
    const fetchFailure = new TypeError("fetch failed", { cause: networkFailure });
    networkFailure.cause = "socket closed";

    await callHandleError({ kind: "unknown", error: fetchFailure });

    const chain = String(consoleError.mock.calls[0]?.[2]);
    expect(chain).toContain("TypeError: fetch failed");
    expect(chain).toContain("Caused by: Error: connect ECONNREFUSED 10.0.0.5:8080");
    expect(chain).toContain("Caused by: socket closed");
  });

  it("stops at a cyclic cause chain", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    first.cause = second;

    await callHandleError({ kind: "unknown", error: first });

    const chain = String(consoleError.mock.calls[0]?.[2]);
    expect(chain.match(/Caused by:/g)).toHaveLength(1);
  });

  it("keeps remote function validation errors unchanged and unlogged", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      callHandleError({
        kind: "validation",
        error: { status: 400, message: "Bad Request" },
        issues: [{ message: "Expected a number" }]
      })
    ).resolves.toBeUndefined();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("issues a new correlation id for every unexpected error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const first = await callHandleError({ kind: "unknown", error: "boom" });
    const second = await callHandleError({ kind: "unknown", error: "boom" });

    expect(first?.errorId).not.toBe(second?.errorId);
  });
});
