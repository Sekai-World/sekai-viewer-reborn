import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  collectKeys,
  listContentSiteNamespaces,
  namespaceForFile
} from "./content-site-source.mjs";

const sourceDir = resolve(process.cwd(), "../../packages/i18n-source/content-site");
const routeNamespaces = ["character", "honor", "mission", "mysekai", "stamp", "unit"];

describe("content-site i18n source namespaces", () => {
  it("checks and syncs every source dictionary", async () => {
    const sourceFiles = (await readdir(sourceDir)).filter((fileName) => fileName.endsWith(".json"));

    expect(await listContentSiteNamespaces()).toEqual(
      sourceFiles.map((fileName) => fileName.replace(/\.json$/, "")).sort()
    );
    expect(await listContentSiteNamespaces()).toEqual(expect.arrayContaining(routeNamespaces));
  });

  it("maps route and component files to their own namespace", () => {
    expect(namespaceForFile("src/routes/characters/[region]/+page.svelte")).toBe("character");
    expect(namespaceForFile("src/lib/components/honor/HonorCatalogue.svelte")).toBe("honor");
    expect(namespaceForFile("src/routes/missions/[region]/+page.svelte")).toBe("mission");
    expect(namespaceForFile("src/routes/mysekai/fixtures/[region]/+page.svelte")).toBe("mysekai");
    expect(namespaceForFile("src/lib/components/stamp/StampTile.svelte")).toBe("stamp");
    expect(namespaceForFile("src/routes/unit/[region]/[unit]/+page.svelte")).toBe("unit");
  });

  it("collects keys that only exist in each route namespace", async () => {
    const usedKeys = await collectKeys(await listContentSiteNamespaces());

    for (const namespace of routeNamespaces) {
      const sourceMessages = JSON.parse(
        await readFile(resolve(sourceDir, `${namespace}.json`), "utf8")
      );
      expect(
        [...usedKeys[namespace]].some((key) => key in sourceMessages),
        `${namespace} has no checked keys`
      ).toBe(true);
    }
    expect([...usedKeys.stamp]).toEqual(
      expect.arrayContaining(["stamp.previewDownload", "stamp.previewOpenInNewWindow"])
    );
  });
});
