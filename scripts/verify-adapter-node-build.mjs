import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const apps = ["content-site", "tools-site", "media-lab-site", "account-site"];
const treeShakenChunkNames = ["env.js"];
const runtimeVariables = {
  HOST: "127.0.0.1",
  PORT: "19453",
  ORIGIN: "http://127.0.0.1:19453",
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

for (const app of apps) {
  const buildDirectory = path.join(rootDirectory, "apps", app, "build");
  const serverDirectory = path.join(buildDirectory, "server");
  const serverFiles = await listFiles(serverDirectory);
  const treeShakenChunks = serverFiles.filter((file) => {
    const normalizedPath = file.replaceAll(path.sep, "/");
    return treeShakenChunkNames.some((name) => normalizedPath.includes(`/chunks/${name}-`));
  });

  assert.deepEqual(
    treeShakenChunks,
    [],
    `${app} emitted an empty adapter environment chunk: ${treeShakenChunks.join(", ")}`
  );
  assert.ok(
    serverFiles.some(
      (file) =>
        file.replaceAll(path.sep, "/").includes("/server/chunks/chunks/") && file.endsWith(".js")
    ),
    `${app} should retain file-structured chunks for other server modules`
  );

  const ssrEntryPath = serverFiles.find((file) =>
    file.replaceAll(path.sep, "/").match(/\/server\/chunks\/index\.js-[^/]+\.js$/)
  );
  assert.ok(ssrEntryPath, `${app} is missing its server SSR entry chunk`);
  const ssrEntry = await import(pathToFileURL(ssrEntryPath).href);
  assert.equal(typeof ssrEntry, "object", `${app} server SSR entry did not import`);

  const envModulePath = path.join(buildDirectory, "env.js");
  const runtimeEnv = await import(pathToFileURL(envModulePath).href);
  const previousValues = new Map(
    Object.keys(runtimeVariables).map((name) => [name, process.env[name]])
  );

  try {
    assert.equal(runtimeEnv.env_prefix, "", `${app} changed the default env prefix`);
    assert.equal(typeof runtimeEnv.env, "function", `${app} lost the env helper`);
    assert.equal(typeof runtimeEnv.timeout_env, "function", `${app} lost timeout_env`);

    for (const [name, value] of Object.entries(runtimeVariables)) {
      process.env[name] = value;
      assert.equal(runtimeEnv.env(name), value, `${app} did not read unprefixed ${name}`);
    }

    assert.equal(runtimeEnv.timeout_env("SHUTDOWN_TIMEOUT"), 23);
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }

  console.log(`${app}: adapter-node chunk, SSR import, and runtime env checks passed`);
}
