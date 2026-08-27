import { defineConfig } from "vitest/config";

const libPath = new URL("./src/lib", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [{ find: "$lib", replacement: libPath }]
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
