import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { buildScenario, masterRows, storyCases } from "./fixtures";

/**
 * Local stand-in for sekai-master-api and the asset bucket, so the StoryReader
 * browser tests never touch the network. Regions pick the scenario:
 *
 * - `jp`: every collection answers with the synthetic fixtures.
 * - `cn`: the region has not synced its master data (503 REGION_DATA_NOT_READY).
 * - `kr`: the data service is failing (500).
 */

export const mockServerPort = 4174;

const assetBuckets: Record<string, string> = { jp: "sekai-jp-assets" };

const scenarioByPath = new Map<string, Record<string, unknown>>(
  storyCases.map((storyCase) => [
    `/${assetBuckets.jp}/${storyCase.scenarioPath}`,
    buildScenario(storyCase.scenarioPath, storyCase.line)
  ])
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

/**
 * The Chibi catalog is JP-only, so a region cannot pick its scenario. A test
 * sets the mode through `POST /__mock/costume2ds?mode=...` and resets it after.
 */
export type Costume2dsMode = "ok" | "empty" | "error";
let costume2dsMode: Costume2dsMode = "ok";

const handleMockControl = (url: URL, response: ServerResponse): boolean => {
  if (url.pathname !== "/__mock/costume2ds") return false;
  const mode = url.searchParams.get("mode");
  if (mode === "ok" || mode === "empty" || mode === "error") {
    costume2dsMode = mode;
    send(response, 200, { mode });
  } else {
    send(response, 400, { message: "Unknown mode." });
  }
  return true;
};

const handleCharacter2dBatch = (url: URL, response: ServerResponse): boolean => {
  if (url.pathname !== "/character2ds/jp/batch") return false;
  const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number);
  const rows = masterRows.character2ds as { id: number }[];
  send(response, 200, {
    items: rows.filter((row) => ids.includes(row.id)),
    missingIds: ids.filter((id) => !rows.some((row) => row.id === id))
  });
  return true;
};

const handleMasterData = (pathname: string, response: ServerResponse): boolean => {
  const list = /^\/([A-Za-z0-9]+)\/(jp|en|tw|kr|cn)\/list$/.exec(pathname);
  if (!list) return false;
  const [, collection, region] = list;
  if (collection === "costume2ds" && costume2dsMode !== "ok") {
    if (costume2dsMode === "error") send(response, 500, { message: "Mock data service failure." });
    else send(response, 200, { items: [], pagination: { page: 1, page_size: 100 } });
  } else if (region === "cn") {
    send(response, 503, { code: "REGION_DATA_NOT_READY", message: "Region data is not ready." });
  } else if (region === "kr") {
    send(response, 500, { message: "Mock data service failure." });
  } else if (masterRows[collection]) {
    send(response, 200, {
      items: masterRows[collection],
      pagination: { page: 1, page_size: 100, has_next: false }
    });
  } else {
    send(response, 404, { message: "Unknown collection." });
  }
  return true;
};

const handleAsset = (pathname: string, response: ServerResponse): boolean => {
  if (!pathname.startsWith("/sekai-")) return false;
  const scenario = scenarioByPath.get(pathname);
  if (scenario) {
    send(response, 200, scenario);
  } else if (pathname.endsWith(".webp") || pathname.endsWith(".png")) {
    send(
      response,
      200,
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#dbeafe"/></svg>',
      "image/svg+xml"
    );
  } else {
    send(response, 404, { message: "Asset not found." });
  }
  return true;
};

const handleRequest = (request: IncomingMessage, response: ServerResponse): void => {
  const url = new URL(request.url ?? "/", `http://127.0.0.1:${mockServerPort}`);
  const { pathname } = url;
  if (
    handleMockControl(url, response) ||
    handleCharacter2dBatch(url, response) ||
    handleMasterData(pathname, response) ||
    handleAsset(pathname, response)
  ) {
    return;
  }
  // Everything else (notices, remote i18n bundles) is simply unavailable; the
  // site falls back to its bundled messages and renders without notices.
  send(response, 404, { message: "Not mocked." });
};

export default async function globalSetup(): Promise<() => Promise<void>> {
  const server = createServer(handleRequest);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(mockServerPort, "127.0.0.1", resolve);
  });
  return () =>
    new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
}
