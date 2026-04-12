import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

const currentDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    dts({
      entryRoot: "src",
      include: ["src/**/*.ts"],
      outDir: "dist"
    })
  ],
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(currentDir, "src/index.ts"),
      formats: ["es"],
      fileName: () => "index.js"
    },
    outDir: "dist",
    sourcemap: true
  }
});
