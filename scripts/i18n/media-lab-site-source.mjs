import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = path.join(repoRoot, "apps/media-lab-site");
const sourceDir = path.join(repoRoot, "packages/i18n-source/media-lab-site");
const namespaces = ["common", "home", "live2d", "story-reader"];
const translatorKeyPatterns = [
  /createI18nTranslator\([^)]*\)\(\s*(?:[^,\n]+,\s*)?["']([^"'`]+)["']/g,
  /\btranslate\(\s*["']([^"'`]+)["']/g
];
const dynamicRegionKeyPattern = /\btranslate\(\s*`region\.\$\{[^}]+\}`\s*\)/g;
const dynamicRegionKeys = ["region.jp", "region.en", "region.tw", "region.kr", "region.cn"];

const namespaceByRoutePattern = [
  { pattern: /src\/routes\/\+layout\.svelte$/, namespace: "common" },
  { pattern: /src\/routes\/\+layout\.server\.ts$/, namespace: "common" },
  { pattern: /src\/routes\/\+error\.svelte$/, namespace: "common" },
  { pattern: /src\/routes\/live2d\/story-reader\//, namespace: "story-reader" },
  { pattern: /src\/routes\/live2d\//, namespace: "live2d" },
  { pattern: /src\/routes\/story-reader\//, namespace: "story-reader" },
  { pattern: /src\/routes\/\+page\.svelte$/, namespace: "home" }
];

export const collectTranslatorKeys = (content, usedKeys) => {
  for (const pattern of translatorKeyPatterns) {
    for (const match of content.matchAll(pattern)) {
      usedKeys.add(match[1]);
    }
  }

  if (dynamicRegionKeyPattern.test(content)) {
    for (const key of dynamicRegionKeys) usedKeys.add(key);
  }
  dynamicRegionKeyPattern.lastIndex = 0;
};

export const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

const listSourceFiles = async () => {
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filePath);
      // Skip test modules: they exercise the translator with synthetic keys
      // that are not user-facing strings.
      else if (/\.(svelte|ts)$/.test(entry.name) && !filePath.endsWith(".test.ts"))
        files.push(filePath);
    }
  };

  await Promise.all([
    visit(path.join(appRoot, "src/lib")),
    visit(path.join(appRoot, "src/routes"))
  ]);
  return files;
};

const sourceMessages = await Promise.all(
  namespaces.map(async (namespace) => [
    namespace,
    JSON.parse(await readFile(path.join(sourceDir, `${namespace}.json`), "utf8"))
  ])
).then(Object.fromEntries);
const getNamespaceForFile = (filePath) => {
  const relativePath = path.relative(appRoot, filePath).replaceAll(path.sep, "/");
  return (
    namespaceByRoutePattern.find((entry) => entry.pattern.test(relativePath))?.namespace ?? "common"
  );
};

const usedKeysByNamespace = Object.fromEntries(
  namespaces.map((namespace) => [namespace, new Set()])
);

for (const filePath of await listSourceFiles()) {
  const content = await readFile(filePath, "utf8");
  const namespace = getNamespaceForFile(filePath);
  collectTranslatorKeys(content, usedKeysByNamespace[namespace]);
}

const missingKeysByNamespace = Object.fromEntries(
  namespaces
    .map((namespace) => {
      const availableMessages = { ...sourceMessages.common, ...sourceMessages[namespace] };
      const missingKeys = [...usedKeysByNamespace[namespace]]
        .filter((key) => !(key in availableMessages))
        .sort((left, right) => left.localeCompare(right));
      return [namespace, missingKeys];
    })
    .filter(([, keys]) => keys.length > 0)
);

if (Object.keys(missingKeysByNamespace).length > 0) {
  for (const [namespace, missingKeys] of Object.entries(missingKeysByNamespace)) {
    console.error(
      `Missing ${namespace} i18n keys:\n${missingKeys.map((key) => "  - " + key).join("\n")}`
    );
  }
  process.exitCode = 1;
} else if (isMainModule) {
  console.log("media-lab-site i18n source keys are complete.");
}
