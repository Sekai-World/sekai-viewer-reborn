import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

const libPath = new URL("./src/lib", import.meta.url).pathname;
const iconifyComponentStubPath = new URL(
  "./src/lib/test/iconify-component-stub.svelte",
  import.meta.url
).pathname;

export default defineConfig({
  plugins: [svelte({ prebundleSvelteLibraries: false }), svelteTesting()],
  resolve: {
    alias: [
      {
        find: "$app/environment",
        replacement: new URL("./src/lib/test/app-environment.ts", import.meta.url).pathname
      },
      {
        find: "$app/navigation",
        replacement: new URL("./src/lib/test/app-navigation.ts", import.meta.url).pathname
      },
      {
        find: "$env/dynamic/public",
        replacement: new URL("./src/lib/test/public-env.ts", import.meta.url).pathname
      },
      { find: "$lib", replacement: libPath },
      { find: /^@iconify\/svelte$/, replacement: iconifyComponentStubPath }
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
          "@testing-library/svelte-core",
          // Node's native loader re-parses this package's 1.5 MB exports map for
          // every icon file it imports; inlining keeps icon loads off that path.
          "@iconify-icons/mdi"
        ]
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
