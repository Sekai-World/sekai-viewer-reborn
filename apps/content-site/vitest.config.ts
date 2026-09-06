import { svelte } from "@sveltejs/vite-plugin-svelte";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    svelte({
      prebundleSvelteLibraries: false
    }),
    svelteTesting()
  ],
  resolve: {
    alias: [
      { find: /^node:module$/, replacement: "module" },
      {
        find: "$app/paths",
        replacement: new URL("./src/lib/test/app-paths.ts", import.meta.url).pathname
      },
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
      {
        find: "$lib",
        replacement: new URL("./src/lib", import.meta.url).pathname
      }
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
    deps: {
      optimizer: {
        client: { enabled: false }
      }
    },
    server: {
      deps: {
        inline: [
          "svelte",
          "@iconify/svelte",
          "@testing-library/svelte",
          "@testing-library/svelte-core"
        ]
      }
    },
    environment: "jsdom",
    exclude: ["**/node_modules/**", "**/.svelte-kit/**", "**/dist/**", "**/build/**"],
    include: ["src/**/*.test.ts"],
    setupFiles: ["../../test/setup.js"],
    coverage: {
      include: [
        "src/lib/i18n/runtime.ts",
        "src/lib/tools-site.ts",
        "src/lib/server/music-list.ts",
        "src/lib/server/music-detail.ts",
        "src/lib/server/gacha-detail.ts",
        "src/lib/server/unit-detail.ts",
        "src/lib/server/gacha-probability.ts",
        "src/lib/server/home-latest-data.ts",
        "src/lib/server/response-values.ts",
        "src/lib/server/secure-random.ts",
        "src/lib/domain/unit-detail.ts",
        "src/lib/domain/unit-icon.ts",
        "src/lib/styles/event-card.ts",
        "src/routes/api/gacha/[region]/[id]/pull/+server.ts",
        "src/routes/api/gacha/[region]/[id]/pull/pull-behavior.ts",
        "src/routes/api/gacha/[region]/[id]/pull/pull-pool.ts",
        "src/routes/+page.server.ts",
        "src/routes/unit/[region]/[unit]/+page.server.ts",
        "src/routes/+layout.server.ts"
      ],
      reporter: ["lcov"]
    }
  }
});
