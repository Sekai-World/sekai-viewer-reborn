import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contentSiteRoot = path.join(repoRoot, "apps/content-site");
const sourceDir = path.join(repoRoot, "packages/i18n-source/content-site");
const scannedFiles = ["src/lib", "src/routes"];
const contentSiteNamespaces = [
  "common",
  "home",
  "card",
  "event",
  "gacha",
  "music",
  "virtual-live",
  "error",
  "server"
];

const commonKeyPatterns = [
  /(?:tCommon|getInitialI18nText|getInitialLabel|translate)\(\s*(?:[^,\n]+,\s*)?["']([^"'`]+)["']/g,
  /createI18nTranslator\([^)]*\)\(\s*(?:[^,]+,\s*)?["']([^"'`]+)["']/g
];
const serverKeyPatterns = [/getServerI18nText\(\s*[^,]+,\s*["']([^"'`]+)["']/g];
const sharedCommonKeys = new Set([
  "audioDownloadCloseLabel",
  "audioDownloadLabel",
  "audioDownloadStages.cancelled",
  "audioDownloadStages.failed",
  "audioDownloadStages.fetchingAudio",
  "audioDownloadStages.fetchingCover",
  "audioDownloadStages.finalizing",
  "audioDownloadStages.preparing",
  "audioDownloadStages.ready",
  "audioDownloadStages.writingMetadata",
  "audioPauseLabel",
  "audioPlayLabel",
  "audioSeekLabel",
  "audioVolumeLabel",
  "bannerAltSuffix",
  "clearLabel",
  "closeLabel",
  "countdownEndsIn",
  "countdownStartsIn",
  "debugJsonButton",
  "eventEnded",
  "eventListCurrentEvent",
  "home",
  "idLabel",
  "imageUnavailable",
  "internalResourceCodeLabel",
  "labels.timeUnit.day",
  "labels.timeUnit.hour",
  "labels.timeUnit.minute",
  "labels.timeUnit.second",
  "listFilterApply",
  "listFilterReset",
  "listFiltersTitle",
  "listLoadMoreHintDesktop",
  "listLoadMoreHintMobile",
  "listOpenFilters",
  "listRetry",
  "listSortById",
  "listSortByReleaseAt",
  "listViewAgenda",
  "listViewGrid",
  "mixed",
  "mixedUnitLabel",
  "nameLabel",
  "noCurrentEventData",
  "spoilerContent",
  "unitLabel"
]);

const namespaceByRoutePattern = [
  { pattern: /src\/routes\/\+layout\.svelte$/, namespace: "common" },
  { pattern: /src\/routes\/\+layout\.server\.ts$/, namespace: "common" },
  { pattern: /src\/routes\/\+error\.svelte$/, namespace: "error" },
  { pattern: /src\/routes\/\+page\.svelte$/, namespace: "home" },
  { pattern: /src\/routes\/card\//, namespace: "card" },
  { pattern: /src\/routes\/cards\//, namespace: "card" },
  { pattern: /src\/routes\/music\//, namespace: "music" },
  { pattern: /src\/routes\/musics\//, namespace: "music" },
  { pattern: /src\/routes\/gacha\//, namespace: "gacha" },
  { pattern: /src\/routes\/gachas\//, namespace: "gacha" },
  { pattern: /src\/routes\/event\//, namespace: "event" },
  { pattern: /src\/routes\/events\//, namespace: "event" },
  { pattern: /src\/routes\/virtual-live\//, namespace: "virtual-live" },
  { pattern: /src\/routes\/virtual-lives\//, namespace: "virtual-live" },
  { pattern: /src\/lib\/event\.ts$/, namespace: "event" },
  { pattern: /src\/lib\/components\/CurrentEventCard\.svelte$/, namespace: "home" },
  { pattern: /src\/lib\/components\/Card/, namespace: "card" },
  { pattern: /src\/lib\/components\/card\//, namespace: "card" },
  { pattern: /src\/lib\/components\/gacha\//, namespace: "gacha" },
  { pattern: /src\/lib\/components\/Music/, namespace: "music" },
  { pattern: /src\/lib\/components\/music\//, namespace: "music" },
  { pattern: /src\/lib\/components\/Event/, namespace: "event" },
  { pattern: /src\/lib\/components\/event\//, namespace: "event" },
  { pattern: /src\/lib\/components\/virtual-live\//, namespace: "virtual-live" }
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
  const usedKeys = Object.fromEntries(
    contentSiteNamespaces.map((namespace) => [namespace, new Set()])
  );
  usedKeys.common.add("themeMode.auto");
  usedKeys.common.add("themeMode.dark");
  usedKeys.common.add("themeMode.light");
  const server = new Set();

  for (const filePath of await listSourceFiles()) {
    const content = await readFile(filePath, "utf8");
    const relativeFilePath = path.relative(contentSiteRoot, filePath).replaceAll(path.sep, "/");
    const namespace =
      namespaceByRoutePattern.find((entry) => entry.pattern.test(relativeFilePath))?.namespace ??
      "common";

    for (const pattern of commonKeyPatterns) {
      for (const match of content.matchAll(pattern)) {
        usedKeys[sharedCommonKeys.has(match[1]) ? "common" : namespace].add(match[1]);
      }
    }

    for (const pattern of serverKeyPatterns) {
      for (const match of content.matchAll(pattern)) {
        server.add(match[1]);
      }
    }
  }

  usedKeys.server = server;
  return usedKeys;
};

const findMissingKeys = (usedKeys, sourceMessages) =>
  [...usedKeys].filter((key) => !(key in sourceMessages)).sort();

const check = async () => {
  const [sourceMessagesByNamespace, usedKeys] = await Promise.all([
    Promise.all(
      contentSiteNamespaces.map(async (namespace) => [
        namespace,
        await readJson(path.join(sourceDir, `${namespace}.json`))
      ])
    ).then(Object.fromEntries),
    collectKeys()
  ]);

  const missingKeysByNamespace = Object.fromEntries(
    contentSiteNamespaces
      .map((namespace) => {
        const sourceMessages =
          namespace === "common" || namespace === "server"
            ? sourceMessagesByNamespace[namespace]
            : { ...sourceMessagesByNamespace.common, ...sourceMessagesByNamespace[namespace] };

        return [namespace, findMissingKeys(usedKeys[namespace] ?? new Set(), sourceMessages)];
      })
      .filter(([, keys]) => keys.length > 0)
  );

  if (Object.keys(missingKeysByNamespace).length > 0) {
    for (const [namespace, missingKeys] of Object.entries(missingKeysByNamespace)) {
      console.error(
        `Missing ${namespace} i18n keys:\n${missingKeys.map((key) => `  - ${key}`).join("\n")}`
      );
    }
    process.exitCode = 1;
    return;
  }

  console.log("content-site i18n source keys are complete.");
};

const sync = async (targetRoot, { prune = false } = {}) => {
  if (!targetRoot) {
    throw new Error("Missing --target <translation-repo-path>.");
  }

  const targetEnDir = path.resolve(targetRoot, "en");
  for (const namespace of contentSiteNamespaces) {
    const sourcePath = path.join(sourceDir, `${namespace}.json`);
    const targetPath = path.join(targetEnDir, `${namespace}.json`);
    const sourceMessages = await readJson(sourcePath);
    const targetMessages = await readJson(targetPath).catch(() => ({}));
    await writeJson(targetPath, prune ? sourceMessages : { ...targetMessages, ...sourceMessages });
    console.log(`Synced ${namespace}.json${prune ? " with pruning" : ""}`);
  }
};

const command = process.argv[2] ?? "check";
const targetIndex = process.argv.indexOf("--target");
const targetRoot = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;
const prune = process.argv.includes("--prune");

if (command === "check") {
  await check();
} else if (command === "sync") {
  await check();
  await sync(targetRoot, { prune });
} else {
  throw new Error(`Unknown command: ${command}`);
}
