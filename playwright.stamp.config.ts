import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config";

// Opt-in cross-engine coverage for the stamp shallow-routing pilot. Keep the
// default visual snapshot projects Chromium-only and their baselines unchanged.
export default defineConfig({
  ...config,
  testMatch: "stamp-preview.spec.ts",
  projects: [
    ...(config.projects ?? []),
    {
      name: "firefox-1440",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } }
    },
    {
      name: "webkit-390",
      use: { ...devices["Desktop Safari"], viewport: { width: 390, height: 900 } }
    },
    {
      name: "webkit-1440",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } }
    }
  ]
});
