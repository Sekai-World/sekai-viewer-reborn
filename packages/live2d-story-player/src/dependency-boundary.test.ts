import { readFile, readdir } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = resolve(packageRoot, "src");
const moduleSpecifierPattern = /\b(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g;

interface PackageExport {
  types?: string;
  import?: string;
  default?: string;
}

interface PackageManifest {
  exports: Record<string, PackageExport>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

const isForbiddenFrameworkSpecifier = (specifier: string): boolean =>
  specifier === "react" ||
  specifier.startsWith("react/") ||
  specifier === "react-dom" ||
  specifier.startsWith("react-dom/") ||
  specifier.startsWith("@mui/") ||
  specifier === "react-i18next" ||
  specifier.startsWith("react-i18next/") ||
  specifier === "svelte" ||
  specifier.startsWith("svelte/") ||
  specifier === "svelte-i18n" ||
  specifier.startsWith("svelte-i18n/") ||
  specifier.startsWith("@sveltejs/");

const isForbiddenApplicationSpecifier = (specifier: string): boolean =>
  [
    "$app/",
    "$lib/",
    "$store/",
    "$stores/",
    "@app/",
    "@apps/",
    "@store/",
    "@stores/",
    "@/",
    "app/",
    "apps/",
    "src/store/",
    "src/stores/"
  ].some((prefix) => specifier.startsWith(prefix));

const isForbiddenSpecifier = (specifier: string): boolean =>
  isForbiddenFrameworkSpecifier(specifier) || isForbiddenApplicationSpecifier(specifier);

const getSourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return getSourceFiles(path);
      return entry.isFile() && path.endsWith(".ts") ? [path] : [];
    })
  );
  return nestedFiles.flat();
};

describe("package dependency boundary", () => {
  it("keeps player source independent from application modules", async () => {
    const sourceFiles = await getSourceFiles(sourceRoot);
    const violations: string[] = [];

    for (const sourceFile of sourceFiles) {
      const source = await readFile(sourceFile, "utf8");
      const specifiers = [...source.matchAll(moduleSpecifierPattern)].map((match) => match[1]);

      for (const specifier of specifiers) {
        if (isForbiddenSpecifier(specifier)) {
          violations.push(`${relative(packageRoot, sourceFile)} -> ${specifier}`);
          continue;
        }

        if (specifier.startsWith(".")) {
          const target = resolve(dirname(sourceFile), specifier);
          const targetFromPackage = relative(packageRoot, target);
          if (targetFromPackage.startsWith("..") || isAbsolute(targetFromPackage)) {
            violations.push(`${relative(packageRoot, sourceFile)} -> ${specifier}`);
          }
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it.each([
    "react",
    "react-dom/client",
    "@mui/material",
    "@mui/icons-material",
    "react-i18next",
    "svelte/store",
    "svelte-i18n",
    "@sveltejs/kit",
    "$app/stores",
    "$lib/stores/player",
    "$stores/player",
    "@/store/player",
    "@app/stores/player",
    "@apps/content-site/stores/player",
    "apps/media-lab-site/src/stores/player",
    "src/stores/player"
  ])("rejects framework and app-store module specifier %s", (specifier) => {
    expect(isForbiddenSpecifier(specifier)).toBe(true);
  });

  it("keeps framework and app dependencies out of every package manifest group", async () => {
    const manifest = JSON.parse(
      await readFile(resolve(packageRoot, "package.json"), "utf8")
    ) as PackageManifest;
    const dependencyGroups = [
      ["dependencies", manifest.dependencies],
      ["devDependencies", manifest.devDependencies],
      ["peerDependencies", manifest.peerDependencies],
      ["optionalDependencies", manifest.optionalDependencies]
    ] as const;
    const violations = dependencyGroups.flatMap(([group, dependencies]) =>
      Object.keys(dependencies ?? {})
        .filter(isForbiddenSpecifier)
        .map((dependency) => `${group} -> ${dependency}`)
    );

    expect(violations).toEqual([]);
  });

  it("keeps the default export free of eager renderer and audio dependencies", async () => {
    const entrySource = await readFile(resolve(sourceRoot, "index.ts"), "utf8");
    const manifest = JSON.parse(
      await readFile(resolve(packageRoot, "package.json"), "utf8")
    ) as PackageManifest;

    expect(entrySource).not.toMatch(/from\s+["'](?:pixi\.js|howler)["']/);
    expect(manifest.exports["."]?.import).toBe("./src/index.ts");
    expect(manifest.exports["./pixi"]?.import).toBe("./src/adapters/pixi/index.ts");
    expect(manifest.exports["."]?.import).not.toBe(manifest.exports["./pixi"]?.import);
  });

  it("can load the default entry without importing Pixi or Howler", async () => {
    vi.doMock("pixi.js", () => {
      throw new Error("The model entry must not load Pixi");
    });
    vi.doMock("howler", () => {
      throw new Error("The model entry must not load Howler");
    });

    const player = await import("./index.js");

    expect(player.Live2DAssetType.UI).toBe("ui");
  });
});
