import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

interface AppE2eConfigOptions {
  /** Port the app's production build (`node build`) listens on. */
  sitePort: number;
  /** Port of the app's local mock upstream (started by its global setup). */
  mockServerPort: number;
}

/**
 * Shared Playwright config for an app's behavior-only e2e suite: Chromium at a
 * narrow and a desktop width against `vite build && node build`, with every
 * upstream URL pointed at the app's mock server in `tests/e2e/mock-server.ts`.
 * Resolve paths relative to the app directory that runs `playwright test`.
 */
export const createAppE2eConfig = ({
  sitePort,
  mockServerPort
}: AppE2eConfigOptions): PlaywrightTestConfig => {
  const mockServerUrl = `http://127.0.0.1:${mockServerPort}`;

  return defineConfig({
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
};
