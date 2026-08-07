import { createServer, type Server } from "node:http";
import type { FullConfig } from "@playwright/test";

const port = 4173;
let currentEventMode: "pending" | "fulfilled" = "fulfilled";
let releasePendingCurrentEvent = (): void => {};
let pendingCurrentEvent = Promise.resolve();

const event = {
  id: "999",
  name: "Visual Regression Event",
  eventType: "marathon",
  unit: "light_sound",
  startAt: "2030-01-01T00:00:00.000Z",
  aggregateAt: "2030-01-03T00:00:30.000Z",
  assetbundleName: "visual-regression-event"
};

const json = (response: Parameters<Server["emit"]>[1] & { end: (body?: string) => void }, body: unknown): void => {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
};

const resetPendingCurrentEvent = (): void => {
  pendingCurrentEvent = new Promise<void>((resolve) => {
    releasePendingCurrentEvent = resolve;
  });
};

const getRegionFromPath = (pathname: string): string => pathname.split("/")[2] ?? "jp";

const createMockServer = (): Server =>
  createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const { pathname } = url;

    if (pathname === "/__visual/current-event") {
      const mode = url.searchParams.get("mode");
      if (mode === "pending") {
        currentEventMode = "pending";
        resetPendingCurrentEvent();
      } else if (mode === "fulfilled") {
        currentEventMode = "fulfilled";
        releasePendingCurrentEvent();
      }
      json(response, { mode: currentEventMode });
      return;
    }

    if (pathname.startsWith("/sekai-") || pathname.endsWith(".webp")) {
      response.setHeader("content-type", "image/svg+xml");
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="256"><rect width="100%" height="100%" fill="#dbeafe"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-size="24">Visual Event</text></svg>');
      return;
    }

    if (/^\/en\/(common|home|event|error|server)\.json$/.test(pathname)) {
      json(response, {
        homeEventDataUnavailable: "Current event data is unavailable.",
        homeEventDataRequestFailed: "Could not load current event data.",
        countdownEndsIn: "Ends in",
        countdownStartsIn: "Starts in",
        eventEnded: "Event ended",
        "labels.timeUnit.day": "Days",
        "labels.timeUnit.hour": "Hours",
        "labels.timeUnit.minute": "Minutes",
        "labels.timeUnit.second": "Seconds"
      });
      return;
    }

    if (pathname === "/versions") {
      json(response, Object.fromEntries(["jp", "en", "tw", "kr", "cn"].map((region) => [region, { appVersion: "1.0.0", dataVersion: "visual", assetVersion: "visual", cdnVersion: "visual" }])));
      return;
    }

    if (/^\/versions\/[a-z]+$/.test(pathname)) {
      json(response, { appVersion: "1.0.0", dataVersion: "visual", assetVersion: "visual", cdnVersion: "visual" });
      return;
    }

    if (/^\/unitProfiles\/[a-z]+\/list$/.test(pathname)) {
      json(response, { items: [{ unit: "light_sound", unitName: "Leo/need" }] });
      return;
    }

    if (/^\/events\/[a-z]+\/current$/.test(pathname)) {
      if (getRegionFromPath(pathname) === "jp" && currentEventMode === "pending") {
        await pendingCurrentEvent;
      }
      json(response, event);
      return;
    }

    if (/^\/(cards|musics|gachas)\/[a-z]+\/list$/.test(pathname)) {
      json(response, { items: [] });
      return;
    }

    response.statusCode = 404;
    json(response, { error: `Unexpected visual-test request: ${pathname}` });
  });

export default async function globalSetup(_config: FullConfig): Promise<() => Promise<void>> {
  const server = createMockServer();
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));

  return async () => {
    releasePendingCurrentEvent();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  };
}
