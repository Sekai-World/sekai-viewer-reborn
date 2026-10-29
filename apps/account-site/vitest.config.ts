import { defineConfig } from "vitest/config";

const libPath = new URL("./src/lib", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      { find: "#lib", replacement: libPath },
      {
        find: "$app/env/private",
        replacement: new URL("./src/lib/test/private-env.ts", import.meta.url).pathname
      },
      {
        find: "$app/env/public",
        replacement: new URL("./src/lib/test/public-env.ts", import.meta.url).pathname
      }
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
