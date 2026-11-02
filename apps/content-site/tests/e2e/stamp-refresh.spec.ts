import { expect, test, type Locator, type Page } from "@playwright/test";
import contentSitePackage from "../../package.json" with { type: "json" };
import { mockServerPort, type MockFailure } from "./mock-server";

/**
 * Retry on the stamps catalogue (`refreshAll`) against the production build.
 *
 * Expected behavior:
 * - Retry re-runs the page's server load: the stamp list and the character
 *   options are fetched again for the same region and query.
 * - It is not a navigation: no document reload, no new history entry, and the
 *   URL stays the same. On a scrolled page the scroll position stays too.
 * - `refreshAll` keeps `page.state`, so a stamp preview held in history state
 *   survives a refresh and shows the refreshed data.
 *
 * Assertions on the mock's request log are kept in their own "mock:" steps;
 * every other step checks what the browser actually shows.
 */

const mockServerUrl = `http://127.0.0.1:${mockServerPort}`;
const catalogueUrl = "/stamps/jp?category=character&sort_order=asc";
const festivalStampName = "Festival Afterglow";
const characterName = "Saki Tenma";
const stampListRequest =
  "/stamps/jp/list?page=1&page_size=48&sort_by=id&sort_order=asc&category=character";
const characterListRequest =
  "/gameCharacters/jp/list?page=1&page_size=100&sort_by=seq&sort_order=asc";

type DocumentSnapshot = {
  path: string;
  historyLength: number;
  documentMarker: string | null;
  scrollY: number;
};

test.beforeEach(async ({ context, page, baseURL }) => {
  await context.addCookies([{ name: "content_site_ui_locale", value: "en", url: baseURL! }]);
  await context.addInitScript((siteVersion) => {
    localStorage.setItem("content_site_onboarding_seen", "true");
    localStorage.setItem("content_site_seen_version", siteVersion);
  }, contentSitePackage.version);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
});

/** Sets which upstream lists fail and clears the request log. */
const setUpstream = async (page: Page, failures: MockFailure[] = []): Promise<void> => {
  const query = new URLSearchParams(failures.map((failure) => ["fail", failure]));
  const response = await page.request.get(`${mockServerUrl}/__e2e/scenario?${query}`);
  expect(response.ok()).toBe(true);
};

const upstreamRequests = async (page: Page): Promise<string[]> => {
  const response = await page.request.get(`${mockServerUrl}/__e2e/requests`);
  const body = (await response.json()) as { requests: string[] };
  return body.requests;
};

/** Marks the current document so a full reload would be detected. */
const markDocument = (page: Page): Promise<void> =>
  page.evaluate(() => document.documentElement.setAttribute("data-e2e-document", "original"));

const snapshotDocument = (page: Page): Promise<DocumentSnapshot> =>
  page.evaluate(() => ({
    path: `${location.pathname}${location.search}`,
    historyLength: history.length,
    documentMarker: document.documentElement.getAttribute("data-e2e-document"),
    scrollY: Math.round(window.scrollY)
  }));

const retryButton = (page: Page): Locator => page.getByRole("button", { name: "Try again" });

/** Scrolls so the retry button sits below the sticky header at a known offset. */
const scrollRetryIntoView = (page: Page): Promise<void> =>
  retryButton(page).evaluate((button) => {
    window.scrollTo({ top: button.getBoundingClientRect().top + window.scrollY - 200 });
  });

const openFestivalPreview = async (page: Page): Promise<Locator> => {
  const trigger = page.getByRole("button", { name: festivalStampName, exact: true });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: festivalStampName });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Awarded at the festival.", { exact: true })).toBeVisible();
  return dialog;
};

test("retry after a failed catalogue load refetches it in place", async ({ page }) => {
  await setUpstream(page, ["stamps"]);
  await page.goto(catalogueUrl);
  await expect(
    page.getByText("The stamps could not be loaded. Please try again.", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: festivalStampName, exact: true })).toHaveCount(0);

  await test.step("mock: the failed load requested the stamp list once", async () => {
    expect((await upstreamRequests(page)).filter((path) => path === stampListRequest)).toHaveLength(
      1
    );
  });

  await setUpstream(page);
  await markDocument(page);
  const before = await snapshotDocument(page);
  await retryButton(page).click();

  await test.step("browser: the catalogue renders on the same document and entry", async () => {
    await expect(page.getByRole("button", { name: festivalStampName, exact: true })).toBeVisible();
    await expect(page.getByText("The stamps could not be loaded. Please try again.")).toHaveCount(
      0
    );
    // The short error state does not scroll at every width, so scroll is
    // checked in the character retry test instead.
    const after = await snapshotDocument(page);
    expect([after.path, after.historyLength, after.documentMarker]).toEqual([
      before.path,
      before.historyLength,
      before.documentMarker
    ]);
  });

  await test.step("mock: retry re-ran the page load with the same query", async () => {
    const requests = await upstreamRequests(page);
    expect(requests.filter((path) => path === stampListRequest)).toHaveLength(1);
    expect(requests.filter((path) => path === characterListRequest)).toHaveLength(1);
  });
});

test("character retry keeps the history preview and shows refreshed characters", async ({
  page
}) => {
  await setUpstream(page, ["characters"]);
  await page.goto(catalogueUrl);
  // Only the character picker failed: it alerts and offers the one retry.
  await expect(page.getByRole("alert")).toHaveText(
    "The stamps could not be loaded. Please try again."
  );
  await expect(retryButton(page)).toHaveCount(1);

  const dialog = await openFestivalPreview(page);
  await expect(dialog.getByText(characterName, { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(dialog).not.toBeVisible();

  await setUpstream(page);
  await scrollRetryIntoView(page);
  await markDocument(page);
  const before = await snapshotDocument(page);
  expect(before.scrollY).toBeGreaterThan(0);
  await retryButton(page).click();

  await test.step("browser: characters load without leaving the list entry", async () => {
    await expect(page.getByRole("button", { name: characterName }).first()).toBeVisible();
    await expect(retryButton(page)).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(dialog).not.toBeVisible();
    expect(await snapshotDocument(page)).toEqual(before);
  });

  await test.step("mock: retry refetched characters and the catalogue", async () => {
    const requests = await upstreamRequests(page);
    expect(requests.filter((path) => path === characterListRequest)).toHaveLength(1);
    expect(requests.filter((path) => path === stampListRequest)).toHaveLength(1);
  });

  await test.step("browser: Forward restores the preview with the refreshed data", async () => {
    await page.goForward();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(characterName, { exact: true })).toBeVisible();
    expect((await snapshotDocument(page)).path).toBe(catalogueUrl);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    expect((await snapshotDocument(page)).path).toBe(catalogueUrl);
  });
});

test("a refresh while the preview is open keeps page.state", async ({ page }) => {
  // The open preview is a modal dialog, so the page's retry buttons are inert
  // and no user control can start a refresh here today. Start the page's own
  // `refreshAll` retry from script to pin the contract the preview relies on:
  // a refresh must not drop `page.state` (as `invalidateAll` would).
  // Focus is not asserted: the refresh re-renders the catalogue's tiles, so
  // closing cannot return focus to the original tile element.
  await setUpstream(page, ["characters"]);
  await page.goto(catalogueUrl);
  await expect(retryButton(page)).toHaveCount(1);
  const dialog = await openFestivalPreview(page);
  await expect(dialog.getByText(characterName, { exact: true })).toHaveCount(0);

  await setUpstream(page);
  await markDocument(page);
  const before = await snapshotDocument(page);
  await retryButton(page).evaluate((button: HTMLButtonElement) => button.click());

  await test.step("browser: the preview stays open and shows refreshed data", async () => {
    // Wait for the refreshed data first, then read the native dialog state: the
    // daisyUI close transition can keep a closing dialog visible for a moment.
    const previewDialog = page.locator("[data-stamp-preview-host] dialog");
    await expect(previewDialog.getByText(characterName, { exact: true })).toBeAttached();
    await expect(previewDialog).toHaveJSProperty("open", true);
    await expect(dialog).toBeVisible();
    // The page behind the modal may shift a few pixels as the picker fills in,
    // so only the document and history entry are compared here.
    const after = await snapshotDocument(page);
    expect([after.path, after.historyLength, after.documentMarker]).toEqual([
      before.path,
      before.historyLength,
      before.documentMarker
    ]);
  });

  await test.step("mock: the refresh refetched characters", async () => {
    expect(
      (await upstreamRequests(page)).filter((path) => path === characterListRequest)
    ).toHaveLength(1);
  });

  await test.step("browser: the preview's history entry still works", async () => {
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: festivalStampName, exact: true })).toBeVisible();
    // Escape closed the preview by going Back, so Forward reopens it.
    await page.goForward();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(characterName, { exact: true })).toBeVisible();
    const after = await snapshotDocument(page);
    expect([after.path, after.historyLength, after.documentMarker]).toEqual([
      catalogueUrl,
      before.historyLength,
      "original"
    ]);
  });
});
