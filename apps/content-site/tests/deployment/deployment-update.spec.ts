import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import contentSitePackage from "../../package.json" with { type: "json" };

const nextDeployment = "e2e-next-deployment";
const onboardingSeenStorageKey = "content_site_onboarding_seen";
const seenSiteVersionStorageKey = "content_site_seen_version";
const dismissedDeploymentStorageKey = "content_site_dismissed_deployment";
const promptTitle = "A new version of the site is available";
const curatedNoticeTitle = "A new update is available";

type VersionMode = "next" | "current" | "offline";

const markReturningVisitor = async (context: BrowserContext, seenVersion: string) => {
  await context.addInitScript(
    ({ onboardingStorageKey, siteVersionStorageKey, version }) => {
      localStorage.setItem(onboardingStorageKey, "true");
      localStorage.setItem(siteVersionStorageKey, version);
    },
    {
      onboardingStorageKey: onboardingSeenStorageKey,
      siteVersionStorageKey: seenSiteVersionStorageKey,
      version: seenVersion
    }
  );
};

/** Serves `_app/version.json` from the test so it can simulate a new deployment. */
const controlVersionFile = async (page: Page, initialMode: VersionMode) => {
  const state = { mode: initialMode, requests: 0 };
  await page.route("**/_app/version.json", async (route: Route) => {
    state.requests += 1;
    if (state.mode === "offline") {
      await route.abort("internetdisconnected");
    } else if (state.mode === "next") {
      await route.fulfill({ json: { version: nextDeployment } });
    } else {
      await route.continue();
    }
  });
  return state;
};

/** Focus is one of SvelteKit's version-check triggers; repeat it until hydration has run. */
const checkUntil = async (page: Page, condition: () => Promise<void>) => {
  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await condition();
  }).toPass({ timeout: 15_000 });
};

const prompt = (page: Page) =>
  page.getByRole("status").filter({ has: page.getByRole("heading", { name: promptTitle }) });

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
});

test("prompts an old client after a new deployment and reloads only on request", async ({
  context,
  page
}) => {
  await markReturningVisitor(context, contentSitePackage.version);
  const versionFile = await controlVersionFile(page, "next");
  await page.goto("/updates");

  await checkUntil(page, () => expect(prompt(page)).toBeVisible({ timeout: 1_000 }));
  const reload = prompt(page).getByRole("button", { name: "Reload", exact: true });
  await expect(reload).toBeVisible();
  await expect(
    prompt(page).getByRole("button", { name: "Dismiss new version notice" })
  ).toBeVisible();

  const box = await prompt(page).boundingBox();
  const viewport = page.viewportSize();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);

  // Detection alone never reloads the page.
  await page.evaluate(() => {
    (window as Window & { beforeReload?: boolean }).beforeReload = true;
  });
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect
    .poll(() =>
      page.evaluate(() => (window as Window & { beforeReload?: boolean }).beforeReload ?? false)
    )
    .toBe(true);

  versionFile.mode = "current";
  await Promise.all([page.waitForEvent("load"), reload.click()]);
  expect(
    await page.evaluate(() => (window as Window & { beforeReload?: boolean }).beforeReload)
  ).toBeUndefined();
  await expect(prompt(page)).toHaveCount(0);
});

test("stays hidden while the deployed version is unchanged", async ({ context, page }) => {
  await markReturningVisitor(context, contentSitePackage.version);
  const versionFile = await controlVersionFile(page, "current");
  await page.goto("/updates");

  await checkUntil(page, async () => expect(versionFile.requests).toBeGreaterThanOrEqual(1));
  await expect(prompt(page)).toHaveCount(0);
});

test("remembers a dismissal for the deployed version across reloads", async ({ context, page }) => {
  await markReturningVisitor(context, contentSitePackage.version);
  const versionFile = await controlVersionFile(page, "next");
  await page.goto("/updates");

  await checkUntil(page, () => expect(prompt(page)).toBeVisible({ timeout: 1_000 }));
  await prompt(page).getByRole("button", { name: "Dismiss new version notice" }).click();
  await expect(prompt(page)).toHaveCount(0);
  expect(
    await page.evaluate((key) => localStorage.getItem(key), dismissedDeploymentStorageKey)
  ).toBe(nextDeployment);

  versionFile.requests = 0;
  await page.reload();
  // SvelteKit's own check and the prompt's version read both run for the same deployment.
  await checkUntil(page, async () => expect(versionFile.requests).toBeGreaterThanOrEqual(2));
  await expect(prompt(page)).toHaveCount(0);
});

test("ignores failed checks silently and prompts once the deployment is reachable", async ({
  context,
  page
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await markReturningVisitor(context, contentSitePackage.version);
  const versionFile = await controlVersionFile(page, "offline");
  await page.goto("/updates");

  await checkUntil(page, async () => expect(versionFile.requests).toBeGreaterThanOrEqual(2));
  await expect(prompt(page)).toHaveCount(0);
  expect(pageErrors).toEqual([]);

  versionFile.mode = "next";
  await checkUntil(page, () => expect(prompt(page)).toBeVisible({ timeout: 1_000 }));
  expect(pageErrors).toEqual([]);
});

test("replaces the curated update notice instead of showing both", async ({ context, page }) => {
  await markReturningVisitor(context, "0.0.1");
  const versionFile = await controlVersionFile(page, "current");
  await page.goto("/updates");

  await expect(page.getByRole("heading", { name: curatedNoticeTitle })).toBeVisible();

  versionFile.mode = "next";
  await checkUntil(page, () => expect(prompt(page)).toBeVisible({ timeout: 1_000 }));
  await expect(page.getByRole("heading", { name: curatedNoticeTitle })).toHaveCount(0);
});
