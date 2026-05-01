import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentSiteRoot = path.join(repoRoot, "apps/content-site");
const sourceDir = path.join(repoRoot, "packages/i18n-source/content-site");
const scannedFiles = [
  "src/lib",
  "src/routes"
];

const commonKeyPatterns = [
  /(?:tCommon|getInitialCommonText|getInitialLabel|translate)\(\s*["']([^"'`]+)["']/g,
  /createCommonTranslator\([^)]*\)\(\s*["']([^"'`]+)["']/g
];
const serverKeyPatterns = [
  /getServerI18nText\(\s*[^,]+,\s*["']([^"'`]+)["']/g
];

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const sortRecord = (record) =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));

const writeJson = async (filePath, record) => {
  await writeFile(filePath, `${JSON.stringify(sortRecord(record), null, 2)}\n`);
};

const listSourceFiles = async () => {
  const { readdir } = await import("node:fs/promises");
  const files = [];

  const visit = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (/\.(svelte|ts)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  };

  for (const relativeDir of scannedFiles) {
    await visit(path.join(contentSiteRoot, relativeDir));
  }

  return files;
};

const collectKeys = async () => {
  const common = new Set(["themeMode.auto", "themeMode.dark", "themeMode.light"]);
  const server = new Set();

  for (const filePath of await listSourceFiles()) {
    const content = await readFile(filePath, "utf8");

    for (const pattern of commonKeyPatterns) {
      for (const match of content.matchAll(pattern)) {
        common.add(match[1]);
      }
    }

    for (const pattern of serverKeyPatterns) {
      for (const match of content.matchAll(pattern)) {
        server.add(match[1]);
      }
    }
  }

  return { common, server };
};

const findMissingKeys = (usedKeys, sourceMessages) =>
  [...usedKeys].filter((key) => !(key in sourceMessages)).sort();

const check = async () => {
  const [commonMessages, serverMessages, usedKeys] = await Promise.all([
    readJson(path.join(sourceDir, "common.json")),
    readJson(path.join(sourceDir, "server.json")),
    collectKeys()
  ]);

  const missingCommon = findMissingKeys(usedKeys.common, commonMessages);
  const missingServer = findMissingKeys(usedKeys.server, serverMessages);

  if (missingCommon.length > 0 || missingServer.length > 0) {
    if (missingCommon.length > 0) {
      console.error(`Missing common i18n keys:\n${missingCommon.map((key) => `  - ${key}`).join("\n")}`);
    }
    if (missingServer.length > 0) {
      console.error(`Missing server i18n keys:\n${missingServer.map((key) => `  - ${key}`).join("\n")}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("content-site i18n source keys are complete.");
};

const sync = async (targetRoot) => {
  if (!targetRoot) {
    throw new Error("Missing --target <translation-repo-path>.");
  }

  const targetEnDir = path.resolve(targetRoot, "en");
  for (const namespace of ["common", "server"]) {
    const sourcePath = path.join(sourceDir, `${namespace}.json`);
    const targetPath = path.join(targetEnDir, `${namespace}.json`);
    const sourceMessages = await readJson(sourcePath);
    const targetMessages = await readJson(targetPath).catch(() => ({}));
    await writeJson(targetPath, { ...targetMessages, ...sourceMessages });
    console.log(`Synced ${namespace}.json`);
  }
};

const command = process.argv[2] ?? "check";
const targetIndex = process.argv.indexOf("--target");
const targetRoot = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;

if (command === "check") {
  await check();
} else if (command === "sync") {
  await check();
  await sync(targetRoot);
} else {
  throw new Error(`Unknown command: ${command}`);
}
