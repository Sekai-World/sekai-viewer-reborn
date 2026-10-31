import { defineConfig, devices } from "@playwright/test";

const mockServerUrl = "http://127.0.0.1:4174";
const sitePort = 4106;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  globalSetup: "./tests/e2e/mock-server.ts",
  use: {
    baseURL: `http://127.0.0.1:${sitePort}`,
    colorScheme: "light",
    locale: "en-US",
    javaScriptEnabled: true
  },
  projects: [
    {
      name: "chromium-390",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 } }
    },
    {
      name: "chromium-1280",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }
    }
  ],
  webServer: {
    command: `pnpm exec vite build && node build`,
    url: `http://127.0.0.1:${sitePort}`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      HOST: "127.0.0.1",
      PORT: String(sitePort),
      SEKAI_MASTER_API_BASE_URL: mockServerUrl,
      SEKAI_API_BASE_URL: mockServerUrl,
      PUBLIC_REMOTE_ASSET_BASE_URL: mockServerUrl,
      PUBLIC_SEKAI_I18N_BASE_URL: mockServerUrl
    }
  }
});
