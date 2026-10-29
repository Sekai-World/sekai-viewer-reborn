import { defineConfig } from "vitest/config";
import { createSvelteKitEnvironmentAliases } from "../../test/vitest-env-aliases.mjs";

const libPath = new URL("./src/lib", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      { find: "#lib", replacement: libPath },
      ...createSvelteKitEnvironmentAliases(import.meta.url)
    ]
  },
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/.svelte-kit/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["lcov"],
      reportsDirectory: "coverage"
    }
  }
});
