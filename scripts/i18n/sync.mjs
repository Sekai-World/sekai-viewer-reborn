import { spawnSync } from "node:child_process";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");

// content-site dictionaries sit at the locale root because deployed viewers already load them
// from there. The other sites reuse namespace names such as `common`, so each gets a subdirectory.
export const siteSyncTargets = [
  { site: "content-site", targetSubdirectory: "" },
  { site: "tools-site", targetSubdirectory: "tools-site" },
  { site: "media-lab-site", targetSubdirectory: "media-lab-site" }
];

const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));

const sortRecord = (record) =>
  Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));

const listNamespaces = async (sourceDir) =>
  (await readdir(sourceDir))
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => fileName.slice(0, -".json".length))
    .sort();

/** Copies one site's English source namespaces into a translation repository directory. */
export const syncSiteSource = async ({ sourceDir, targetDir, prune = false }) => {
  const namespaces = await listNamespaces(sourceDir);
  await mkdir(targetDir, { recursive: true });

  for (const namespace of namespaces) {
    const targetPath = path.join(targetDir, `${namespace}.json`);
    const sourceMessages = await readJson(path.join(sourceDir, `${namespace}.json`));
    const targetMessages = await readJson(targetPath).catch(() => ({}));
    const messages = prune ? sourceMessages : { ...targetMessages, ...sourceMessages };
    await writeFile(targetPath, `${JSON.stringify(sortRecord(messages), null, 2)}\n`);
  }

  return namespaces;
};

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);

if (isMainModule) {
  const targetIndex = process.argv.indexOf("--target");
  const targetRoot = targetIndex >= 0 ? process.argv[targetIndex + 1] : undefined;
  const prune = process.argv.includes("--prune");

  if (!targetRoot) {
    throw new Error("Missing --target <translation-repo-path>.");
  }

  for (const { site } of siteSyncTargets) {
    const result = spawnSync(
      process.execPath,
      [path.join(scriptDir, `${site}-source.mjs`), "check"],
      { stdio: "inherit" }
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  for (const { site, targetSubdirectory } of siteSyncTargets) {
    const namespaces = await syncSiteSource({
      sourceDir: path.join(repoRoot, "packages/i18n-source", site),
      targetDir: path.resolve(targetRoot, "en", targetSubdirectory),
      prune
    });
    console.log(
      `Synced ${site}: ${namespaces.length} namespaces${prune ? " with pruning" : ""} into en/${targetSubdirectory}`
    );
  }
}
