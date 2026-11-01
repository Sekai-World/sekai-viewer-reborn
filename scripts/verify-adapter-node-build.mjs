import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createConnection } from "node:net";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const apps = ["content-site", "tools-site", "media-lab-site", "account-site"];
const runtimeVariables = {
  HOST: "127.0.0.1",
  PORT: "19453",
  BODY_SIZE_LIMIT: "8388608",
  SHUTDOWN_TIMEOUT: "23"
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    })
  );

  return nestedFiles.flat();
}

async function verifyRuntimeEnvironment(serverFiles, app) {
  const runtimeEnvEntry = serverFiles.find((file) => path.basename(file) === "adapter-env.js");
  assert.ok(runtimeEnvEntry, `${app} is missing the adapter-node environment entry`);

  const runtimeEnv = await import(pathToFileURL(runtimeEnvEntry).href);
  assert.equal(typeof runtimeEnv.env, "function", `${app} lost adapter-node env()`);
  assert.equal(typeof runtimeEnv.timeout_env, "function", `${app} lost adapter-node timeout_env()`);

  const previousValues = new Map(
    Object.keys(runtimeVariables).map((name) => [name, process.env[name]])
  );

  try {
    for (const [name, value] of Object.entries(runtimeVariables)) {
      process.env[name] = value;
      assert.equal(runtimeEnv.env(name), value, `${app} did not read runtime ${name}`);
    }

    assert.equal(
      runtimeEnv.timeout_env("SHUTDOWN_TIMEOUT"),
      Number(runtimeVariables.SHUTDOWN_TIMEOUT),
      `${app} did not parse SHUTDOWN_TIMEOUT as seconds`
    );
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

async function verifyRuntimeConfiguration(buildDirectory, serverFiles, app) {
  const adapterConfigPath = path.join(buildDirectory, "adapter-node.js");
  const adapterConfig = await import(pathToFileURL(adapterConfigPath).href);
  assert.equal(adapterConfig.env_prefix, "", `${app} changed adapter-node's default env prefix`);
  assert.equal(adapterConfig.origin, undefined, `${app} unexpectedly pinned a public origin`);

  const runtimeEntry = serverFiles.find((file) => path.basename(file).startsWith("adapter-index"));
  const handlerEntry = serverFiles.find((file) => path.basename(file).startsWith("handler"));
  assert.ok(runtimeEntry, `${app} is missing the adapter-node server entry`);
  assert.ok(handlerEntry, `${app} is missing the adapter-node request handler`);

  await verifyRuntimeEnvironment(serverFiles, app);

  // Importing the handler starts the server, and content-site refuses to start without its
  // public asset base (apps/content-site/src/env.ts).
  process.env.PUBLIC_REMOTE_ASSET_BASE_URL ??= "/storage";
  const handlerModule = await import(pathToFileURL(path.join(buildDirectory, "handler.js")).href);
  assert.equal(
    typeof handlerModule.handler,
    "function",
    `${app} request handler is not importable`
  );
}

async function verifyServerManifest(serverFiles, app) {
  const manifestPath =
    serverFiles.find((file) => path.basename(file) === "manifest.js") ??
    serverFiles.find((file) => {
      const name = path.basename(file);
      return name.startsWith("manifest.js-") || name.startsWith("manifest-");
    });
  assert.ok(manifestPath, `${app} is missing its server route manifest`);

  const manifestModule = await import(pathToFileURL(manifestPath).href);
  const routeNodeLoaders = manifestModule.manifest?.nodes;
  assert.ok(Array.isArray(routeNodeLoaders), `${app} server manifest has no route nodes`);
  assert.ok(routeNodeLoaders.length > 0, `${app} server manifest has an empty route-node list`);
  const routeNodeModules = await Promise.all(
    routeNodeLoaders.map((load, index) => {
      assert.equal(typeof load, "function", `${app} route node ${index} is not importable`);
      return load();
    })
  );
  assert.ok(
    routeNodeModules.every((routeNode) => routeNode && typeof routeNode === "object"),
    `${app} route-node imports returned an invalid module`
  );
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object", "smoke server did not bind a TCP port");
  return address.port;
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function waitForServer(child, port, app, getOutput) {
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`${app} adapter server exited before serving HTTP:\n${getOutput()}`);
    }

    const listening = await new Promise((resolve) => {
      const socket = createConnection({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (listening) {
      return fetch(`http://127.0.0.1:${port}/`, {
        headers: { cookie: "adapter-smoke=1; smoke-pair=two" },
        redirect: "manual",
        signal: AbortSignal.timeout(20_000)
      });
    }
    await delay(100);
  }

  throw new Error(`${app} adapter server did not listen on HTTP:\n${getOutput()}`);
}

async function stopChild(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const exited = new Promise((resolve) => child.once("exit", resolve));
  child.kill("SIGTERM");
  await Promise.race([exited, delay(5_000)]);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
    await exited;
  }
}

async function verifyAdapterSsrHttp(app, buildDirectory) {
  const upstream = createServer((_request, response) => {
    response.writeHead(404, { "content-type": "application/json" });
    response.end('{"error":"adapter smoke fixture"}');
  });
  let portProbe;
  let child;
  let output = "";
  const appendOutput = (chunk) => {
    output = `${output}${chunk}`.slice(-16_000);
  };

  try {
    const upstreamPort = await listen(upstream);
    portProbe = createServer();
    const port = await listen(portProbe);
    await new Promise((resolve, reject) =>
      portProbe.close((error) => (error ? reject(error) : resolve()))
    );

    const baseUrl = `http://127.0.0.1:${upstreamPort}`;
    const childEnvironment = {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      SHUTDOWN_TIMEOUT: "5",
      BODY_SIZE_LIMIT: "8388608",
      SEKAI_MASTER_API_BASE_URL: baseUrl,
      SEKAI_API_BASE_URL: baseUrl,
      SEKAI_REMOTE_ASSET_BASE_URL: baseUrl,
      PUBLIC_REMOTE_ASSET_BASE_URL: baseUrl,
      PUBLIC_SEKAI_I18N_BASE_URL: baseUrl
    };
    delete childEnvironment.SOCKET_PATH;
    delete childEnvironment.LISTEN_PID;
    delete childEnvironment.LISTEN_FDS;

    child = spawn(process.execPath, ["index.js"], {
      cwd: buildDirectory,
      env: childEnvironment,
      stdio: ["ignore", "pipe", "pipe"]
    });
    child.stdout.setEncoding("utf8").on("data", appendOutput);
    child.stderr.setEncoding("utf8").on("data", appendOutput);

    const response = await waitForServer(child, port, app, () => output);
    const body = await response.text();
    assert.equal(
      response.status,
      200,
      `${app} adapter SSR returned ${response.status}: ${body.slice(0, 500)}\n${output}`
    );
    assert.match(
      response.headers.get("content-type") ?? "",
      /^text\/html\b/i,
      `${app} adapter SSR did not return an HTML document`
    );
    assert.match(body, /<!doctype html/i, `${app} adapter SSR response has no document doctype`);
  } finally {
    await stopChild(child);
    if (portProbe?.listening) {
      await new Promise((resolve, reject) =>
        portProbe.close((error) => (error ? reject(error) : resolve()))
      );
    }
    if (upstream.listening) {
      await new Promise((resolve, reject) =>
        upstream.close((error) => (error ? reject(error) : resolve()))
      );
    }
  }
}

async function verifyContentSiteClientManifest(appDirectory) {
  const clientDirectory = path.join(appDirectory, ".svelte-kit/output/client");
  const manifestPath = path.join(clientDirectory, ".vite/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const [howlerEntry, eventDebugEntry] = ["howler", "EventDebugDialog"].map((name) => {
    const matchingEntries = Object.entries(manifest).filter(([, entry]) => entry.name === name);
    assert.equal(matchingEntries.length, 1, `content-site client manifest should retain ${name}`);
    return matchingEntries[0];
  });

  const [howlerKey, howler] = howlerEntry;
  const [eventDebugKey, eventDebugDialog] = eventDebugEntry;
  assert.equal(howler.isDynamicEntry, true, "content-site should retain Howler as a dynamic entry");

  for (const [name, entry] of [
    ["Howler", howler],
    ["EventDebugDialog", eventDebugDialog]
  ]) {
    const filePath = path.join(clientDirectory, entry.file);
    assert.ok((await stat(filePath)).size > 0, `content-site client ${name} file is empty`);
  }

  const eventDebugConsumers = Object.entries(manifest).filter(
    ([key, entry]) =>
      key.includes(".svelte-kit/generated/") &&
      key.includes("/client-optimized/nodes/") &&
      entry.imports?.includes(eventDebugKey)
  );
  assert.ok(
    eventDebugConsumers.length > 0,
    "EventDebugDialog is not retained by a client route node"
  );

  const howlerConsumers = Object.values(manifest).filter((entry) =>
    entry.dynamicImports?.includes(howlerKey)
  );
  assert.ok(howlerConsumers.length > 0, "Howler is not retained as a client dynamic import");
}

for (const app of apps) {
  const appDirectory = path.join(rootDirectory, "apps", app);
  const buildDirectory = path.join(appDirectory, "build");
  const serverDirectory = path.join(buildDirectory, "server");
  const serverFiles = await listFiles(serverDirectory);
  const emptyServerChunks = await Promise.all(
    serverFiles
      .filter((file) => file.endsWith(".js"))
      .map(async (file) => ((await stat(file)).size === 0 ? file : null))
  ).then((files) => files.filter((file) => file !== null));
  assert.deepEqual(emptyServerChunks, [], `${app} emitted empty adapter-node server chunks`);

  await verifyRuntimeConfiguration(buildDirectory, serverFiles, app);
  await verifyServerManifest(serverFiles, app);
  await verifyAdapterSsrHttp(app, buildDirectory);
  console.log(
    `${app}: non-empty output, runtime env reads, timeout parsing, route imports, and adapter SSR HTTP passed`
  );

  if (app === "content-site") {
    await verifyContentSiteClientManifest(appDirectory);
    console.log("content-site: client manifest retains Howler and EventDebugDialog entries");
  }
}
