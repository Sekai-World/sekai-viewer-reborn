import { createServer, type Server } from "node:http";
import type { FullConfig } from "@playwright/test";
import { stampFixtures } from "./stamp-fixtures";

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

const json = (
  response: Parameters<Server["emit"]>[1] & { end: (body?: string) => void },
  body: unknown
): void => {
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
};

const resetPendingCurrentEvent = (): void => {
  pendingCurrentEvent = new Promise<void>((resolve) => {
    releasePendingCurrentEvent = resolve;
  });
};

const getRegionFromPath = (pathname: string): string => pathname.split("/")[2] ?? "jp";

const getStampList = (url: URL) => {
  const name = url.searchParams.get("name")?.trim().toLocaleLowerCase() ?? "";
  const category = url.searchParams.get("category");
  const characterIds = new Set(
    (url.searchParams.get("character_id") ?? "")
      .split(",")
      .filter((value) => value.length > 0)
      .map(Number)
  );
  const matches = stampFixtures
    .filter((stamp) => !name || stamp.name.toLocaleLowerCase().includes(name))
    .filter((stamp) => !category || stamp.category === category)
    .filter(
      (stamp) => characterIds.size === 0 || stamp.characterIds.some((id) => characterIds.has(id))
    )
    .sort((left, right) => left.id - right.id);
  if (url.searchParams.get("sort_order") === "desc") matches.reverse();

  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.max(1, Number(url.searchParams.get("page_size")) || 48);
  const start = (page - 1) * pageSize;

  return {
    items: matches.slice(start, start + pageSize),
    pagination: {
      page,
      page_size: pageSize,
      total: matches.length,
      total_pages: Math.ceil(matches.length / pageSize),
      has_next: start + pageSize < matches.length
    }
  };
};

const createMockServer = (): Server =>
  createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
    const pathname = url.pathname.replace(/^\/api\/v1(?=\/)/, "");

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
      response.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="256"><rect width="100%" height="100%" fill="#dbeafe"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#1e3a8a" font-size="24">Visual Event</text></svg>'
      );
      return;
    }

    if (/^\/en\/(common|home|event|error|server|stamp)\.json$/.test(pathname)) {
      if (pathname === "/en/stamp.json") {
        json(response, {
          "stamp.all": "All",
          "stamp.category": "Category",
          "stamp.category.bond": "Bond",
          "stamp.category.character": "Character",
          "stamp.category.other": "Other",
          "stamp.category.text": "Text",
          "stamp.characterAll": "All characters",
          "stamp.characterChange": "Change character",
          "stamp.characterTitle": "Character",
          "stamp.empty": "No stamps match these filters.",
          "stamp.error": "The stamps could not be loaded.",
          "stamp.loadMore": "Load more",
          "stamp.loadMoreError": "More stamps could not be loaded.",
          "stamp.loading": "Loading stamps...",
          "stamp.loadingMore": "Loading more stamps...",
          "stamp.otherUnit": "Other",
          "stamp.previewCharacters": "Characters",
          "stamp.previewDownload": "Download",
          "stamp.previewName": "Name",
          "stamp.previewObtain": "How to obtain",
          "stamp.previewOpenInNewWindow": "Open image in new window",
          "stamp.results": "Results",
          "stamp.retry": "Try again",
          "stamp.search": "Search stamps",
          "stamp.searchAction": "Search",
          "stamp.secondCharacter": "Second character",
          "stamp.secondCharacterTitle": "Second character",
          "stamp.sortAscending": "Ascending",
          "stamp.sortDescending": "Descending",
          "stamp.sortOrder": "ID order",
          "stamp.source": "Source",
          "stamp.source.crystal": "Crystal shop",
          "stamp.source.exchange": "Exchange",
          "stamp.source.live": "Virtual live",
          "stamp.source.other": "Other",
          "stamp.source.rank": "Character rank",
          "stamp.source.shop": "Stamp shop"
        });
        return;
      }

      json(response, {
        closeLabel: "Close",
        home: "Home",
        imageUnavailable: "Image unavailable",
        "navigation.stamps": "Stamps",
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
      json(
        response,
        Object.fromEntries(
          ["jp", "en", "tw", "kr", "cn"].map((region) => [
            region,
            {
              appVersion: "1.0.0",
              dataVersion: "visual",
              assetVersion: "visual",
              cdnVersion: "visual"
            }
          ])
        )
      );
      return;
    }

    if (/^\/versions\/[a-z]+$/.test(pathname)) {
      json(response, {
        appVersion: "1.0.0",
        dataVersion: "visual",
        assetVersion: "visual",
        cdnVersion: "visual"
      });
      return;
    }

    if (/^\/unitProfiles\/[a-z]+\/list$/.test(pathname)) {
      json(response, { items: [{ unit: "light_sound", unitName: "Leo/need" }] });
      return;
    }

    if (/^\/stamps\/[a-z]+\/list$/.test(pathname)) {
      json(response, getStampList(url));
      return;
    }

    if (/^\/gameCharacters\/[a-z]+\/list$/.test(pathname)) {
      json(response, {
        items: [{ id: "1", firstName: "Saki", givenName: "Tenma", unit: "light_sound", seq: 1 }],
        pagination: { page: 1, page_size: 100, total: 1, total_pages: 1, has_next: false }
      });
      return;
    }

    if (/^\/gameCharacterUnits\/[a-z]+\/list$/.test(pathname)) {
      json(response, {
        items: [{ id: "1", gameCharacterId: "1", unit: "light_sound" }],
        pagination: { page: 1, page_size: 100, total: 1, total_pages: 1, has_next: false }
      });
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
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve()))
    );
  };
}
