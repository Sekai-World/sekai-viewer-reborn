import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      reporter: ["lcov"],
      reportsDirectory: "coverage"
    }
  }
});
