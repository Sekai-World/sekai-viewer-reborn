import { defineConfig } from "@playwright/test";
import config from "./playwright.config";

// SvelteKit skips deployment checks on the dev server, so this suite builds
// content-site and runs it with `vite preview`. It reuses the visual-test mock
// server and the narrow and wide Chromium projects.
const port = 5530;
const baseURL = `http://127.0.0.1:${port}`;
const baseWebServer = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;

export default defineConfig({
  ...config,
  testDir: "./apps/content-site/tests/deployment",
  projects: (config.projects ?? []).filter(
    (project) => project.name === "chromium-390" || project.name === "chromium-1440"
  ),
  use: { ...config.use, baseURL },
  webServer: {
    ...baseWebServer,
    command:
      "pnpm --filter @apps/account-site --filter @apps/content-site --filter @apps/media-lab-site --filter @apps/tools-site exec svelte-kit sync && pnpm --dir apps/content-site exec vite build --configLoader native && pnpm --dir apps/content-site exec vite preview --configLoader native --host 127.0.0.1 --port 5530 --strictPort",
    url: baseURL,
    timeout: 300_000
  }
});
