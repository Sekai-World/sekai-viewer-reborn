import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/build/**"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/test/**", "**/tests/**", "**/*.d.ts"],
      reportsDirectory: "coverage",
      reporter: ["text", "lcov", "json-summary"]
    }
  }
});
