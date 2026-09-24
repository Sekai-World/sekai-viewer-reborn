import { defineConfig } from "vitest/config";

const libPath = new URL("./src/lib", import.meta.url).pathname;
const iconifyStubPath = new URL("./src/lib/test/iconify-stub.ts", import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: [
      { find: "$lib", replacement: libPath },
      { find: /^@iconify\/svelte$/, replacement: iconifyStubPath }
    ]
  },
  test: {
    server: {
      deps: {
        // Node's native loader re-parses this package's 1.5 MB exports map for
        // every icon file it imports; inlining keeps icon loads off that path.
        inline: ["@iconify-icons/mdi"]
      }
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/.svelte-kit/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts", "../../scripts/i18n/tools-site-source.test.ts"],
    coverage: {
      reporter: ["lcov"],
      reportsDirectory: "coverage"
    }
  }
});
