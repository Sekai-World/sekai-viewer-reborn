import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { isIPv4 } from "node:net";

const apps = ["content-site", "tools-site", "media-lab-site", "account-site"];
const [app, image] = process.argv.slice(2);

assert.ok(apps.includes(app), `Expected an app from: ${apps.join(", ")}`);
assert.match(
  image ?? "",
  new RegExp(`^sekai-viewer-${app}:ci-[A-Za-z0-9_.-]+$`),
  "Expected the unique local CI image tag"
);

const suffix = `${process.pid}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
const networkName = `sekai-viewer-smoke-${app}-${suffix}`;
const containerName = `sekai-viewer-smoke-${app}-${suffix}`;
let stubRequestCount = 0;
let stubServer;
let networkCreated = false;
let containerStarted = false;

const runDocker = (args, { captureOutput = false } = {}) => {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: captureOutput ? ["ignore", "pipe", "pipe"] : "inherit"
  });

  if (result.error) {
    throw new Error(`Could not run docker ${args[0]}: ${result.error.message}`, {
      cause: result.error
    });
  }

  if (result.status !== 0) {
    throw new Error(
      `docker ${args[0]} failed with exit code ${result.status}: ${result.stderr?.trim() ?? ""}`
    );
  }

  return captureOutput ? result.stdout.trim() : "";
};

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const closeServer = async (server) => {
  if (!server?.listening) return;
  server.closeAllConnections();
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
};

const closeStubServer = async () => {
  try {
    await closeServer(stubServer);
  } catch (error) {
    console.warn(`Could not close the local API stub: ${error.message}`);
  }
};

const cleanupDocker = (args) => {
  try {
    runDocker(args, { captureOutput: true });
  } catch (error) {
    console.warn(`Cleanup command docker ${args[0]} did not complete: ${error.message}`);
  }
};

const readContainerLogs = () => {
  if (!containerStarted) return "";
  try {
    return runDocker(["logs", containerName], { captureOutput: true });
  } catch {
    return "";
  }
};

const getNetworkGateway = () => {
  const network = JSON.parse(
    runDocker(["network", "inspect", networkName], { captureOutput: true })
  )[0];
  const gateway = network?.IPAM?.Config?.find((config) => config.Gateway)?.Gateway;
  assert.ok(gateway && isIPv4(gateway), "The isolated smoke network must have an IPv4 gateway");
  assert.match(
    gateway,
    /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/,
    "The smoke stub must bind only to a private Docker bridge address"
  );
  return gateway;
};

const listen = (server, host) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });

const getPublishedPort = () => {
  const binding = runDocker(["port", containerName, "3000/tcp"], { captureOutput: true });
  const match = binding.match(/^127\.0\.0\.1:(\d+)$/m);
  assert.ok(match, `Expected container port 3000 published only on loopback; got: ${binding}`);
  return Number(match[1]);
};

const requestRoot = (baseUrl, cookie) => {
  const headers = cookie ? { cookie } : undefined;
  return fetch(`${baseUrl}/`, {
    headers,
    redirect: "manual",
    signal: AbortSignal.timeout(5_000)
  });
};

const assertRootResponse = async (response) => {
  const body = await response.text();

  assert.equal(
    response.status,
    200,
    `${app} root SSR returned ${response.status}: ${body.slice(0, 500)}`
  );
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
    `${app} root SSR did not return HTML`
  );
  assert.match(body, /<!doctype html/i, `${app} root SSR response has no document doctype`);
  return body;
};

const waitForRoot = async (baseUrl) => {
  const deadline = Date.now() + 90_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      return await assertRootResponse(await requestRoot(baseUrl));
    } catch (error) {
      lastError = error;
      if (error.name === "AssertionError") throw error;
      await delay(250);
    }
  }

  throw new Error(`${app} container did not become ready: ${lastError?.message ?? "no response"}`);
};

try {
  runDocker(["network", "create", "--internal", networkName]);
  networkCreated = true;

  const gateway = getNetworkGateway();
  stubServer = createServer((_request, response) => {
    stubRequestCount += 1;
    response.writeHead(404, {
      "cache-control": "no-store",
      "content-type": "application/json"
    });
    response.end('{"error":"local container smoke stub"}');
  });
  await listen(stubServer, gateway);
  const stubAddress = stubServer.address();
  assert.ok(stubAddress && typeof stubAddress === "object", "Local API stub did not bind a port");
  const stubBaseUrl = `http://${gateway}:${stubAddress.port}`;

  const containerArgs = [
    "run",
    "--detach",
    "--rm",
    "--pull=never",
    "--name",
    containerName,
    "--network",
    networkName,
    "--publish",
    "127.0.0.1::3000",
    "--env",
    "NODE_ENV=production",
    "--env",
    "HOST=0.0.0.0",
    "--env",
    "PORT=3000",
    "--env",
    "BODY_SIZE_LIMIT=8388608"
  ];

  for (const name of [
    "SEKAI_API_BASE_URL",
    "SEKAI_MASTER_API_BASE_URL",
    "SEKAI_REMOTE_ASSET_BASE_URL",
    "PUBLIC_REMOTE_ASSET_BASE_URL",
    "PUBLIC_SEKAI_I18N_BASE_URL"
  ]) {
    containerArgs.push("--env", `${name}=${stubBaseUrl}`);
  }
  containerArgs.push(image);

  runDocker(containerArgs);
  containerStarted = true;

  const hostPort = getPublishedPort();
  const appBaseUrl = `http://127.0.0.1:${hostPort}`;
  const rootHtml = await waitForRoot(appBaseUrl);
  const cookieByApp = {
    "content-site": "content_site_ui_locale=en; content_site_preferred_region=jp",
    "tools-site": "tools_site_ui_locale=en",
    "media-lab-site": "media_lab_site_ui_locale=en",
    "account-site": "smoke-cookie=present"
  };
  await assertRootResponse(await requestRoot(appBaseUrl, cookieByApp[app]));

  const staticAsset = rootHtml.match(/(?:src|href)="(\/_app\/immutable\/[^"]+)"/);
  assert.ok(staticAsset, `${app} SSR did not reference a SvelteKit immutable asset`);
  const assetResponse = await fetch(new URL(staticAsset[1], appBaseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(20_000)
  });
  const assetBody = await assetResponse.arrayBuffer();
  assert.equal(
    assetResponse.status,
    200,
    `${app} immutable asset returned ${assetResponse.status}`
  );
  assert.ok(assetBody.byteLength > 0, `${app} immutable asset response was empty`);
  assert.match(
    assetResponse.headers.get("content-type") ?? "",
    /(?:javascript|ecmascript|text\/css)/i,
    `${app} immutable asset did not return JavaScript or CSS`
  );

  assert.ok(stubRequestCount > 0, `${app} did not use the local runtime API/i18n stub`);
  console.log(
    `${app}: root SSR with and without cookies, local stub HTTP (${stubRequestCount} requests), and immutable asset HTTP passed`
  );
} catch (error) {
  const logs = readContainerLogs();
  if (logs) {
    console.error(`\n${app} container logs:\n${logs}`);
  }
  throw error;
} finally {
  if (containerStarted) cleanupDocker(["rm", "--force", containerName]);
  await closeStubServer();
  if (networkCreated) cleanupDocker(["network", "rm", networkName]);
  cleanupDocker(["image", "rm", "--force", image]);
}
