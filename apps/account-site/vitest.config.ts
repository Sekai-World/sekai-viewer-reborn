import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";
import { createSvelteKitEnvironmentAliases } from "../../test/vitest-env-aliases.mjs";

const libPath = new URL("./src/lib", import.meta.url).pathname;
const appStatePath = new URL("./src/lib/test/app-state.ts", import.meta.url).pathname;

export default defineConfig({
  plugins: [svelte({ prebundleSvelteLibraries: false }), svelteTesting()],
  resolve: {
    alias: [
      { find: "#lib", replacement: libPath },
      { find: "$app/state", replacement: appStatePath },
      ...createSvelteKitEnvironmentAliases(import.meta.url)
    ],
    conditions: ["browser", "node", "module-sync"]
  },
  ssr: {
    noExternal: ["svelte", /^svelte\//, "@testing-library/svelte", "@testing-library/svelte-core"],
    resolve: {
      conditions: ["node", "module-sync"],
      externalConditions: ["node", "module-sync"]
    }
  },
  test: {
    server: {
      deps: {
        inline: ["svelte", "@testing-library/svelte", "@testing-library/svelte-core"]
      }
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/.svelte-kit/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["lcov"],
      reportsDirectory: "coverage"
    }
  }
});
