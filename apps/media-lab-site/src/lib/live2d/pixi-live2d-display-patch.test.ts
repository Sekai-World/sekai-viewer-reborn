import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const tickerErrorMarker = "[pixi-live2d-display-mulmotion] Live2D ticker update failed";

const runtimePaths = (): string[] => {
  const cjsEntry = require.resolve("@sekai-world/pixi-live2d-display-mulmotion/cubism4");
  const packageRoot = dirname(dirname(cjsEntry));
  return [join(packageRoot, "dist/cubism4.es.js"), cjsEntry];
};

const assertViewportPatch = (source: string): void => {
  expect(source).toContain("const isValidViewport = (viewport) => {");
  expect(source).toContain("ArrayBuffer.isView(viewport)");
  expect(source).toContain("viewport.length !== 4");
  expect(source).toContain('typeof value === "number" && Number.isFinite(value)');
  expect(source).toContain(
    "s_viewport = isValidViewport(viewport) ? viewport : this.gl.getParameter(this.gl.VIEWPORT);"
  );
  expect(source).toContain(
    "return this._model.drawables.renderOrders ?? this._model.renderOrders;"
  );
};

const assertTickerPatch = (source: string): void => {
  expect(source).toMatch(
    /onTickerUpdate\(\)\s*\{\s*try\s*\{\s*const deltaMS = this\.ticker\.deltaMS;\s*this\.model\.update\(deltaMS\);\s*\}\s*catch\s*\(error\)\s*\{\s*console\.error\(/s
  );
  expect(source).toContain(`console.error("${tickerErrorMarker}", error);`);
};

describe("pixi Live2D runtime patch", () => {
  it("guards Cubism WebGL state in both package entrypoints", async () => {
    const sources = await Promise.all(runtimePaths().map((path) => readFile(path, "utf8")));

    for (const source of sources) {
      assertViewportPatch(source);
      assertTickerPatch(source);
    }
  });
});
