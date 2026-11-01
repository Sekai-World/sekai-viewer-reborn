import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { stampFixtures } from "../visual/stamp-fixtures";

/**
 * Local stand-in for sekai-master-api, the asset bucket and the i18n CDN, so the
 * content-site browser tests never touch the network. Tests switch failures on
 * and read the upstream request log through the `/__e2e/*` control endpoints;
 * the app itself only ever talks to the mocked API paths.
 */

export const mockServerPort = 5431;

export type MockFailure = "stamps" | "characters";

const failures = new Set<MockFailure>();
let requestLog: string[] = [];

const i18nSourceDirectory = new URL(
  "../../../../packages/i18n-source/content-site/",
  import.meta.url
);

const send = (
  response: ServerResponse,
  status: number,
  body: unknown,
  contentType = "application/json; charset=utf-8"
): void => {
  response.statusCode = status;
  response.setHeader("content-type", contentType);
  response.setHeader("access-control-allow-origin", "*");
  response.end(typeof body === "string" ? body : JSON.stringify(body));
};

const listEnvelope = (items: unknown[]) => ({
  items,
  pagination: { page: 1, page_size: 100, total: items.length, total_pages: 1, has_next: false }
});

const getStampList = (url: URL) => {
  const name = url.searchParams.get("name")?.trim().toLocaleLowerCase() ?? "";
  const category = url.searchParams.get("category");
  const matches = stampFixtures
    .filter((stamp) => !name || stamp.name.toLocaleLowerCase().includes(name))
    .filter((stamp) => !category || stamp.category === category)
    .sort((left, right) => left.id - right.id);
  if (url.searchParams.get("sort_order") === "desc") matches.reverse();
  return listEnvelope(matches);
};

const handleControl = (url: URL, response: ServerResponse): boolean => {
  if (url.pathname === "/__e2e/scenario") {
    failures.clear();
    for (const failure of url.searchParams.getAll("fail")) {
      if (failure === "stamps" || failure === "characters") failures.add(failure);
    }
    requestLog = [];
    send(response, 200, { failures: [...failures] });
    return true;
  }
  if (url.pathname === "/__e2e/requests") {
    send(response, 200, { requests: requestLog });
    return true;
  }
  return false;
};

const handleI18n = async (pathname: string, response: ServerResponse): Promise<boolean> => {
  const match = /^\/en\/([a-z-]+)\.json$/.exec(pathname);
  if (!match) return false;
  try {
    const messages = await readFile(new URL(`${match[1]}.json`, i18nSourceDirectory), "utf8");
    send(response, 200, messages);
  } catch {
    send(response, 404, { message: "Unknown namespace." });
  }
  return true;
};

const handleMasterData = (pathname: string, url: URL, response: ServerResponse): boolean => {
  if (/^\/stamps\/[a-z]+\/list$/.test(pathname)) {
    if (failures.has("stamps")) send(response, 500, { message: "Mock stamp list failure." });
    else send(response, 200, getStampList(url));
    return true;
  }
  if (/^\/gameCharacters\/[a-z]+\/list$/.test(pathname)) {
    if (failures.has("characters")) send(response, 500, { message: "Mock character failure." });
    else
      send(
        response,
        200,
        listEnvelope([
          { id: "1", firstName: "Saki", givenName: "Tenma", unit: "light_sound", seq: 1 }
        ])
      );
    return true;
  }
  if (/^\/gameCharacterUnits\/[a-z]+\/list$/.test(pathname)) {
    send(response, 200, listEnvelope([{ id: "1", gameCharacterId: "1", unit: "light_sound" }]));
    return true;
  }
  if (/^\/unitProfiles\/[a-z]+\/list$/.test(pathname)) {
    send(response, 200, { items: [{ unit: "light_sound", unitName: "Leo/need" }] });
    return true;
  }
  if (/^\/versions(\/[a-z]+)?$/.test(pathname)) {
    send(response, 200, {
      appVersion: "1.0.0",
      dataVersion: "e2e",
      assetVersion: "e2e",
      cdnVersion: "e2e"
    });
    return true;
  }
  return false;
};

const handleAsset = (pathname: string, response: ServerResponse): boolean => {
  if (!pathname.startsWith("/sekai-") && !pathname.endsWith(".webp")) return false;
  send(
    response,
    200,
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#dbeafe"/></svg>',
    "image/svg+xml"
  );
  return true;
};

const handleRequest = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${mockServerPort}`);
  if (handleControl(url, response)) return;

  const pathname = url.pathname.replace(/^\/api\/v1(?=\/)/, "");
  requestLog.push(`${pathname}${url.search}`);
  if (
    (await handleI18n(pathname, response)) ||
    handleMasterData(pathname, url, response) ||
    handleAsset(pathname, response)
  )
    return;
  // Everything else (notices, current events) is unavailable; the stamps page
  // does not depend on it.
  send(response, 404, { message: "Not mocked." });
};

export default async function globalSetup(): Promise<() => Promise<void>> {
  const server = createServer((request, response) => void handleRequest(request, response));
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(mockServerPort, "127.0.0.1", resolve);
  });
  return () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
}
