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

const handleMasterData = (pathname: string, response: ServerResponse): boolean => {
  const list = /^\/([A-Za-z0-9]+)\/(jp|en|tw|kr|cn)\/list$/.exec(pathname);
  if (!list) return false;
  const [, collection, region] = list;
  if (region === "cn") {
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
  const { pathname } = new URL(request.url ?? "/", `http://127.0.0.1:${mockServerPort}`);
  if (handleMasterData(pathname, response) || handleAsset(pathname, response)) return;
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
