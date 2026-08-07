import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = path.join(repoRoot, "apps/tools-site");
const sourceDir = path.join(repoRoot, "packages/i18n-source/tools-site");
const namespaces = ["common", "comparison", "server"];
const translatorKeyPatterns = [
  /createI18nTranslator\([^)]*\)\(\s*(?:[^,\n]+,\s*)?["']([^"'`]+)["']/g,
  /tTools\(\s*(?:[^,\n]+,\s*)?["']([^"'`]+)["']/g
];

const skipWhitespace = (content, index) => {
  while (index < content.length && " \t\n\r".includes(content[index])) index += 1;
  return index;
};

const readQuotedKey = (content, index) => {
  const quote = content[index];
  if (quote !== '"' && quote !== "'") return undefined;

  const end = content.indexOf(quote, index + 1);
  return end > index + 1 ? content.slice(index + 1, end) : undefined;
};

const collectTranslatorKeys = (content, usedKeys) => {
  for (const pattern of translatorKeyPatterns) {
    for (const match of content.matchAll(pattern)) {
      usedKeys.add(match[1]);
    }
  }
};

const collectServerKeys = (content, usedKeys) => {
  const functionName = "getServerI18nText";
  let functionIndex = content.indexOf(`${functionName}(`);
  while (functionIndex !== -1) {
    const firstArgumentStart = skipWhitespace(content, functionIndex + functionName.length + 1);
    const separator = content.indexOf(",", firstArgumentStart);
    const keyStart = skipWhitespace(content, separator + 1);

    if (separator !== -1) {
      const key = readQuotedKey(content, keyStart);
      if (key) usedKeys.add(key);
    }

    functionIndex = content.indexOf(`${functionName}(`, functionIndex + functionName.length + 1);
  }
};

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
const getNamespaceForFile = (filePath) => {
  const relativePath = path.relative(appRoot, filePath).replaceAll(path.sep, "/");
  if (relativePath.endsWith(".server.ts")) return "server";
  if (
    relativePath === "src/routes/+layout.svelte" ||
    relativePath === "src/routes/+layout.server.ts"
  ) {
    return "common";
  }
  return "comparison";
};

const usedKeysByNamespace = Object.fromEntries(
  namespaces.map((namespace) => [namespace, new Set()])
);

for (const filePath of await listSourceFiles()) {
  const content = await readFile(filePath, "utf8");
  const namespace = getNamespaceForFile(filePath);
  collectTranslatorKeys(content, usedKeysByNamespace[namespace]);
  collectServerKeys(content, usedKeysByNamespace.server);
}

const missingKeysByNamespace = Object.fromEntries(
  namespaces
    .map((namespace) => {
      const availableMessages =
        namespace === "common"
          ? sourceMessages.common
          : { ...sourceMessages.common, ...sourceMessages[namespace] };
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
} else {
  console.log("tools-site i18n source keys are complete.");
}
