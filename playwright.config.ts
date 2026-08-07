import { defineConfig, devices } from "@playwright/test";

const mockServerUrl = "http://127.0.0.1:4173";

export default defineConfig({
  testDir: "./apps/content-site/tests/visual",
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      scale: "css"
    }
  },
  globalSetup: "./apps/content-site/tests/visual/mock-server.ts",
  use: {
    baseURL: "http://127.0.0.1:4105",
    colorScheme: "light",
    locale: "en-US",
    deviceScaleFactor: 1,
    javaScriptEnabled: true
  },
  projects: [
    {
      name: "chromium-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 900 } }
    },
    {
      name: "chromium-1024",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 900 } }
    },
    {
      name: "chromium-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }
    },
    {
      name: "chromium-1440",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    }
  ],
  webServer: {
    command:
      "pnpm --filter @apps/content-site exec svelte-kit sync && pnpm --filter @apps/content-site exec vite dev --port 4105",
    url: "http://127.0.0.1:4105",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      SEKAI_MASTER_API_BASE_URL: mockServerUrl,
      SEKAI_API_BASE_URL: mockServerUrl,
      PUBLIC_REMOTE_ASSET_BASE_URL: mockServerUrl,
      PUBLIC_SEKAI_I18N_BASE_URL: mockServerUrl
    }
  }
});
