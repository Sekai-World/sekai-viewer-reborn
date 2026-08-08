import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [svelte({ prebundleSvelteLibraries: false }), svelteTesting()],
  resolve: {
    alias: [
      { find: /^node:module$/, replacement: "module" },
    ],
    conditions: ["browser", "node", "module-sync"]
  },
  ssr: {
    noExternal: [
      "svelte",
      /^svelte\//,
      "@iconify/svelte",
      "@testing-library/svelte",
      "@testing-library/svelte-core"
    ],
    resolve: {
      conditions: ["node", "module-sync"],
      externalConditions: ["node", "module-sync"]
    }
  },
  test: {
    server: {
      deps: {
        inline: [
          "svelte",
          "@iconify/svelte",
          "@testing-library/svelte",
          "@testing-library/svelte-core"
        ]
      }
    },
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.svelte-kit/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts"],
    setupFiles: ["../../test/setup.js"],
    coverage: {
      reporter: ["lcov"]
    }
  }
});
