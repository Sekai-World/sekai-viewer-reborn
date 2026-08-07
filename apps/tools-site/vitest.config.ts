import { defineConfig } from "vitest/config";

export default defineConfig({
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
