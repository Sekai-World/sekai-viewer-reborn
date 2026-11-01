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
    const [label, payload] = consoleError.mock.calls[0] ?? [];
    expect(label).toBe("tools-site: unexpected server error");
    expect(payload).toMatchObject({
      errorId: result?.errorId,
      status: 500,
      method: "GET",
      routeId: "/tracker/[region]"
    });
    expect(String((payload as { error: unknown }).error)).toContain("upstream failed");

    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("tools.example");
    expect(logged).not.toContain("query-secret");
    expect(logged).not.toContain("eventId=12");
    expect(logged).not.toContain("cookie-secret");
    expect(logged).not.toContain("header-secret");
  });

  it("issues a new correlation id for every unexpected error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    const first = await callHandleError({ kind: "unknown", error: "boom" });
    const second = await callHandleError({ kind: "unknown", error: "boom" });

    expect(first?.errorId).not.toBe(second?.errorId);
  });
});
