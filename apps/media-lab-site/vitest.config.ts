import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

const libPath = new URL("./src/lib", import.meta.url).pathname;

export default defineConfig({
  plugins: [svelte({ prebundleSvelteLibraries: false }), svelteTesting()],
  resolve: {
    alias: [{ find: "$lib", replacement: libPath }],
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
          "@testing-library/svelte-core",
          // Node's native loader re-parses this package's 1.5 MB exports map for
          // every icon file it imports; inlining keeps icon loads off that path.
          "@iconify-icons/mdi"
        ]
      }
    },
    environment: "node",
    exclude: ["**/node_modules/**", "**/.svelte-kit/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts", "../../scripts/i18n/media-lab-site-source.test.ts"],
    coverage: {
      reporter: ["lcov"],
      reportsDirectory: "coverage"
    }
  }
});
