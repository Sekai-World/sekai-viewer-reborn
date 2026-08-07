import { defineConfig } from "vitest/config";

export default defineConfig({
  root: new URL("../..", import.meta.url).pathname,
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    include: ["packages/i18n-runtime/src/**/*.test.ts"],
    coverage: {
      include: ["packages/i18n-runtime/src/index.ts"],
      reportsDirectory: "packages/i18n-runtime/coverage",
      reporter: ["lcov"]
    }
  }
});
