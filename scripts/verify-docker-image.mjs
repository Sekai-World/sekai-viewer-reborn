import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { isIPv4 } from "node:net";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const supportedApps = ["content-site", "tools-site", "media-lab-site", "account-site"];
export const smokePort = 3000;

const positiveIntegerPattern = /^[1-9]\d*$/;
const privateIpv4Pattern = /^(?:10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

export function validateSmokeArguments(app, image) {
  if (!supportedApps.includes(app)) {
    throw new Error(`Expected an app from: ${supportedApps.join(", ")}`);
  }

  const prefix = `sekai-viewer-${app}:ci-`;
  const runIdentifiers =
    typeof image === "string" && image.startsWith(prefix)
      ? image.slice(prefix.length).split("-")
      : [];
  if (
    runIdentifiers.length !== 2 ||
    !runIdentifiers.every((identifier) => positiveIntegerPattern.test(identifier))
  ) {
    throw new Error("Expected a local CI image tag ending in numeric run ID and attempt");
  }

  return { app, image };
}

const isPrivateIpv4 = (address) =>
  typeof address === "string" && isIPv4(address) && privateIpv4Pattern.test(address);

export function getSmokeContainerUrl(inspection, app, networkName) {
  const state = inspection?.State;
  if (state?.Running !== true) {
    const details = [
      `status=${state?.Status ?? "unknown"}`,
      `exitCode=${state?.ExitCode ?? "unknown"}`,
      state?.Error ? `error=${state.Error}` : null
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(`${app} container is not running (${details})`);
  }

  const address = inspection.NetworkSettings?.Networks?.[networkName]?.IPAddress;
  if (!isPrivateIpv4(address)) {
    throw new Error(`${app} container has no private IPv4 address on the isolated smoke network`);
  }

  return `http://${address}:${smokePort}`;
}

let app;
let image;
let networkName;
let containerName;
let stubRequestCount = 0;
let stubServer;
let networkCreated = false;
let containerCreated = false;

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

  return captureOutput ? `${result.stdout}${result.stderr}`.trim() : "";
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
  if (!containerCreated) return "";
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
  assert.ok(
    isPrivateIpv4(gateway),
    "The smoke stub must bind only to a private Docker bridge address"
  );
  return gateway;
};

const listen = (server, host) =>
  new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, host, resolve);
  });

const inspectContainer = () =>
  JSON.parse(runDocker(["inspect", containerName], { captureOutput: true }))[0];

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
  let nextStateCheck = 0;
  let lastError;

  while (Date.now() < deadline) {
    if (Date.now() >= nextStateCheck) {
      const currentBaseUrl = getSmokeContainerUrl(inspectContainer(), app, networkName);
      assert.equal(currentBaseUrl, baseUrl, `${app} container IP changed during HTTP smoke`);
      nextStateCheck = Date.now() + 1_000;
    }

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

const isDirectExecution =
  process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectExecution) {
  const [appArgument, imageArgument] = process.argv.slice(2);
  ({ app, image } = validateSmokeArguments(appArgument, imageArgument));
  const suffix = `${process.pid}-${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  networkName = `sekai-viewer-smoke-${app}-${suffix}`;
  containerName = `sekai-viewer-smoke-${app}-${suffix}`;

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
      "--pull=never",
      "--name",
      containerName,
      "--network",
      networkName,
      "--env",
      "NODE_ENV=production",
      "--env",
      "HOST=0.0.0.0",
      "--env",
      `PORT=${smokePort}`,
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
    containerCreated = true;

    // The runner can reach a private bridge IP directly; publishing would break isolation.
    const appBaseUrl = getSmokeContainerUrl(inspectContainer(), app, networkName);
    console.log(`${app}: probing HTTP on isolated container address ${appBaseUrl}`);
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
    if (containerCreated) {
      try {
        const inspection = inspectContainer();
        console.error(`${app} container state: ${JSON.stringify(inspection.State)}`);
      } catch (inspectionError) {
        console.error(`${app} container inspection failed: ${inspectionError.message}`);
      }
    }
    const logs = readContainerLogs();
    if (logs) {
      console.error(`\n${app} container logs:\n${logs}`);
    }
    throw error;
  } finally {
    if (containerCreated) cleanupDocker(["rm", "--force", containerName]);
    await closeStubServer();
    if (networkCreated) cleanupDocker(["network", "rm", networkName]);
    cleanupDocker(["image", "rm", "--force", image]);
  }
}
