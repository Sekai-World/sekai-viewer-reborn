import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { siteSyncTargets, syncSiteSource } from "./sync.mjs";

const readJson = async (filePath: string): Promise<Record<string, string>> =>
  JSON.parse(await readFile(filePath, "utf8"));

describe("i18n source sync", () => {
  let workDir: string;
  let sourceDir: string;
  let targetDir: string;

  beforeEach(async () => {
    workDir = await mkdtemp(join(tmpdir(), "i18n-sync-"));
    sourceDir = join(workDir, "source");
    targetDir = join(workDir, "translations/en/tools-site");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "common.json"), JSON.stringify({ b: "B", a: "A" }));
  });

  afterEach(async () => {
    await rm(workDir, { recursive: true, force: true });
  });

  it("creates the site subdirectory and writes sorted namespaces", async () => {
    expect(await syncSiteSource({ sourceDir, targetDir })).toEqual(["common"]);

    expect(await readFile(join(targetDir, "common.json"), "utf8")).toBe(
      `${JSON.stringify({ a: "A", b: "B" }, null, 2)}\n`
    );
  });

  it("keeps removed keys unless pruning is requested", async () => {
    await mkdir(targetDir, { recursive: true });
    await writeFile(join(targetDir, "common.json"), JSON.stringify({ a: "old", stale: "S" }));

    await syncSiteSource({ sourceDir, targetDir });
    expect(await readJson(join(targetDir, "common.json"))).toEqual({ a: "A", b: "B", stale: "S" });

    await syncSiteSource({ sourceDir, targetDir, prune: true });
    expect(await readJson(join(targetDir, "common.json"))).toEqual({ a: "A", b: "B" });
  });

  it("gives every source site its own target, with only content-site at the locale root", async () => {
    const sourceSites = await readdir(resolve(process.cwd(), "../../packages/i18n-source"), {
      withFileTypes: true
    }).then((entries) => entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name));

    expect(siteSyncTargets.map(({ site }) => site).sort()).toEqual(sourceSites.sort());
    expect(siteSyncTargets.filter(({ targetSubdirectory }) => targetSubdirectory === "")).toEqual([
      { site: "content-site", targetSubdirectory: "" }
    ]);
    expect(new Set(siteSyncTargets.map(({ targetSubdirectory }) => targetSubdirectory)).size).toBe(
      siteSyncTargets.length
    );
  });
});
