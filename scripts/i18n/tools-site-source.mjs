import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = path.join(repoRoot, "apps/tools-site");
const sourceDir = path.join(repoRoot, "packages/i18n-source/tools-site");
const namespaces = ["common", "comparison", "server"];
const keyPatterns = [
  /(?:createI18nTranslator|tTools)\([^)]*\)\(\s*["']([^"'`]+)["']/g,
  /getServerI18nText\(\s*[^,]+,\s*["']([^"'`]+)["']/g
];

const listSourceFiles = async () => {
  const files = [];
  const visit = async (directory) => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(filePath);
      else if (/\.(svelte|ts)$/.test(entry.name)) files.push(filePath);
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
const availableKeys = new Set(
  Object.values(sourceMessages).flatMap((messages) => Object.keys(messages))
);
const usedKeys = new Set();

for (const filePath of await listSourceFiles()) {
  const content = await readFile(filePath, "utf8");
  for (const pattern of keyPatterns) {
    for (const match of content.matchAll(pattern)) usedKeys.add(match[1]);
  }
}

const missingKeys = [...usedKeys].filter((key) => !availableKeys.has(key)).sort();
if (missingKeys.length > 0) {
  console.error(
    `Missing tools-site i18n keys:\n${missingKeys.map((key) => `  - ${key}`).join("\n")}`
  );
  process.exitCode = 1;
} else {
  console.log("tools-site i18n source keys are complete.");
}
