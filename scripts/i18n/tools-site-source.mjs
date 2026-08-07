import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = path.join(repoRoot, "apps/tools-site");
const sourceDir = path.join(repoRoot, "packages/i18n-source/tools-site");
const namespaces = ["common", "comparison", "server"];
const translatorFactories = ["createI18nTranslator", "tTools"];

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
  for (const factory of translatorFactories) {
    let factoryIndex = content.indexOf(`${factory}(`);
    while (factoryIndex !== -1) {
      const factoryEnd = content.indexOf(")", factoryIndex + factory.length + 1);
      const invocationStart = skipWhitespace(content, factoryEnd + 1);
      const keyStart = skipWhitespace(content, invocationStart + 1);

      if (factoryEnd !== -1 && content[invocationStart] === "(") {
        const key = readQuotedKey(content, keyStart);
        if (key) usedKeys.add(key);
      }

      factoryIndex = content.indexOf(`${factory}(`, factoryIndex + factory.length + 1);
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
const availableKeys = new Set(
  Object.values(sourceMessages).flatMap((messages) => Object.keys(messages))
);
const usedKeys = new Set();

for (const filePath of await listSourceFiles()) {
  const content = await readFile(filePath, "utf8");
  collectTranslatorKeys(content, usedKeys);
  collectServerKeys(content, usedKeys);
}

const missingKeys = [...usedKeys]
  .filter((key) => !availableKeys.has(key))
  .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0));
if (missingKeys.length > 0) {
  const missingKeysList = missingKeys.map((key) => "  - " + key).join("\n");
  console.error(`Missing tools-site i18n keys:\n${missingKeysList}`);
  process.exitCode = 1;
} else {
  console.log("tools-site i18n source keys are complete.");
}
