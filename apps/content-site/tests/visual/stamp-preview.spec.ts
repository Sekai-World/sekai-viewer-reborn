import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import contentSitePackage from "../../package.json" with { type: "json" };

const festivalStampName = "Festival Afterglow";
const contentSiteBaseUrl = "http://127.0.0.1:4105";
const filteredCatalogueUrl = "/stamps/jp?category=character&source=shop&character=1&sort_order=asc";
const onboardingSeenStorageKey = "content_site_onboarding_seen";
const seenSiteVersionStorageKey = "content_site_seen_version";

const hideFirstRunOverlays = async (context: BrowserContext): Promise<void> => {
  await context.addInitScript(
    ({ siteVersion, onboardingStorageKey, siteVersionStorageKey }) => {
      localStorage.setItem(onboardingStorageKey, "true");
      localStorage.setItem(siteVersionStorageKey, siteVersion);
    },
    {
      siteVersion: contentSitePackage.version,
      onboardingStorageKey: onboardingSeenStorageKey,
      siteVersionStorageKey: seenSiteVersionStorageKey
    }
  );
};

test.beforeEach(async ({ context, page }) => {
  await hideFirstRunOverlays(context);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
});

const openFestivalPreview = async (page: Page) => {
  const trigger = page.getByRole("button", { name: festivalStampName, exact: true });
  await expect(trigger).toBeVisible();
  await trigger.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(trigger).toBeInViewport({ ratio: 1 });
  const scrollY = await page.evaluate(() => window.scrollY);
  await trigger.click();

  const dialog = page.getByRole("dialog", { name: festivalStampName });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Awarded at the festival.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Saki Tenma", { exact: true })).toBeVisible();

  return { dialog, scrollY, trigger };
};

const expectFilterQuery = async (page: Page): Promise<void> => {
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        pathname: url.pathname,
        category: url.searchParams.get("category"),
        source: url.searchParams.get("source"),
        character: url.searchParams.get("character"),
        sortOrder: url.searchParams.get("sort_order")
      };
    })
    .toEqual({
      pathname: "/stamps/jp",
      category: "character",
      source: "shop",
      character: "1",
      sortOrder: "asc"
    });
};

const expectStablePreviewFocus = async (page: Page): Promise<void> => {
  const download = page.getByRole("dialog", { name: festivalStampName }).getByLabel("Download", {
    exact: true
  });
  await expect(download).toBeFocused();
  // Do not mistake showModal's transient focus for the final result of history
  // traversal. WebKit can restore BODY after the dialog has already opened.
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      })
  );
  await expect(download).toBeFocused();
};

test("stamp preview follows browser Back and Forward without losing scroll or focus", async ({
  page
}) => {
  await page.goto(filteredCatalogueUrl);
  const { dialog, scrollY, trigger } = await openFestivalPreview(page);
  const viewport = page.viewportSize();
  const dialogBox = await dialog.boundingBox();

  expect(viewport).not.toBeNull();
  expect(dialogBox).not.toBeNull();
  expect(dialogBox!.x).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.y).toBeGreaterThanOrEqual(0);
  expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport!.width);
  expect(dialogBox!.y + dialogBox!.height).toBeLessThanOrEqual(viewport!.height);
  await expectFilterQuery(page);

  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expectFilterQuery(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);

  await page.goForward();
  await expect(dialog).toBeVisible();
  await expectStablePreviewFocus(page);
  await expectFilterQuery(page);
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Close" }).last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Download", { exact: true })).toBeFocused();
  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);

  await page.goForward();
  await expect(dialog).toBeVisible();
  await expectStablePreviewFocus(page);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(scrollY);
});

test("Escape returns focus and scroll to the source stamp", async ({ page }) => {
  await page.goto(filteredCatalogueUrl);
  const preview = await openFestivalPreview(page);

  await page.keyboard.press("Escape");
  await expect(preview.dialog).not.toBeVisible();
  await expect(preview.trigger).toBeFocused();
  await expectFilterQuery(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(preview.scrollY);
});

test("close button returns focus and scroll to the source stamp", async ({ page }) => {
  await page.goto(filteredCatalogueUrl);
  const preview = await openFestivalPreview(page);

  await preview.dialog.getByRole("button", { name: "Close" }).first().click();
  await expect(preview.dialog).not.toBeVisible();
  await expect(preview.trigger).toBeFocused();
  await expectFilterQuery(page);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(preview.scrollY);
});

test("Enter and Space open the focused stamp tile", async ({ page }) => {
  await page.goto(filteredCatalogueUrl);
  const trigger = page.getByRole("button", { name: festivalStampName, exact: true });
  await expect(trigger).toBeVisible();
  await trigger.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await trigger.focus();
  await expect(trigger).toBeFocused();

  const dialog = page.getByRole("dialog", { name: festivalStampName });
  await page.keyboard.press("Enter");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();

  await page.keyboard.press("Space");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("Tab keeps keyboard focus inside the native preview dialog", async ({ page }) => {
  await page.goto(filteredCatalogueUrl);
  const { dialog } = await openFestivalPreview(page);
  const getFocusState = () =>
    dialog.evaluate((element) => {
      const activeElement = document.activeElement;
      return {
        insideDialog: element.contains(activeElement),
        tagName: activeElement?.tagName ?? "none",
        ariaLabel: activeElement?.getAttribute("aria-label") ?? "",
        text: activeElement?.textContent?.trim().slice(0, 50) ?? ""
      };
    });
  await expect.poll(async () => (await getFocusState()).insideDialog).toBe(true);

  for (const [index, key] of ["Tab", "Tab", "Tab", "Tab", "Tab", "Tab"].entries()) {
    await page.keyboard.press(key);
    const focusState = await getFocusState();
    expect(focusState.insideDialog, `Tab ${index + 1}: ${JSON.stringify(focusState)}`).toBe(true);
    await expect(page.locator(":focus")).toBeVisible();
  }

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("Shift+Tab keeps keyboard focus inside the native preview dialog", async ({ page }) => {
  await page.goto(filteredCatalogueUrl);
  const { dialog } = await openFestivalPreview(page);
  const getFocusState = () =>
    dialog.evaluate((element) => {
      const activeElement = document.activeElement;
      return {
        insideDialog: element.contains(activeElement),
        tagName: activeElement?.tagName ?? "none",
        ariaLabel: activeElement?.getAttribute("aria-label") ?? "",
        text: activeElement?.textContent?.trim().slice(0, 50) ?? ""
      };
    });
  await expect.poll(async () => (await getFocusState()).insideDialog).toBe(true);

  const keys = ["Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab", "Shift+Tab"];
  for (const [index, key] of keys.entries()) {
    await page.keyboard.press(key);
    const focusState = await getFocusState();
    expect(focusState.insideDialog, `Shift+Tab ${index + 1}: ${JSON.stringify(focusState)}`).toBe(
      true
    );
    await expect(page.locator(":focus")).toBeVisible();
  }

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
});

test("touch opens and closes the preview in a mobile browser context", async ({
  browser,
  browserName
}, testInfo) => {
  test.skip(
    !["chromium-390", "webkit-390"].includes(testInfo.project.name),
    "Runs in the Chromium and WebKit mobile-sized projects."
  );

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    locale: "en-US",
    reducedMotion: "reduce"
  });

  try {
    await hideFirstRunOverlays(context);
    const page = await context.newPage();
    // Keep the stamp image pending through the preview's opening frame. Route
    // before navigation so WebKit cannot reuse the tile's decoded image either.
    // Without its intrinsic width, Chromium can focus the temporarily overflowing
    // modal box and drop focus to BODY when the loaded image removes overflow.
    let releaseImage = (): void => {};
    const pendingImage = new Promise<void>((resolve) => {
      releaseImage = resolve;
    });
    await page.route("**/stamp/visual-stamp-25/visual-stamp-25.webp", async (route) => {
      await pendingImage;
      await route.continue();
    });
    await page.goto(new URL(filteredCatalogueUrl, contentSiteBaseUrl).href);

    const mobileSignals = await page.evaluate(() => ({
      maxTouchPoints: navigator.maxTouchPoints,
      coarsePointer: matchMedia("(pointer: coarse)").matches,
      viewportWidth: window.innerWidth,
      screenWidth: window.screen.width
    }));
    // Desktop WebKit reports zero even with Playwright touch emulation enabled.
    if (browserName === "chromium") expect(mobileSignals.maxTouchPoints).toBeGreaterThan(0);
    expect(mobileSignals.coarsePointer).toBe(true);
    expect(mobileSignals.viewportWidth).toBe(390);
    expect(mobileSignals.screenWidth).toBe(390);

    const trigger = page.getByRole("button", { name: festivalStampName, exact: true });
    await expect(trigger).toBeVisible();
    await trigger.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const triggerBox = await trigger.boundingBox();
    expect(triggerBox).not.toBeNull();
    await page.touchscreen.tap(
      triggerBox!.x + triggerBox!.width / 2,
      triggerBox!.y + triggerBox!.height / 2
    );

    const dialog = page.getByRole("dialog", { name: festivalStampName });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Awarded at the festival.", { exact: true })).toBeVisible();
    const image = dialog.getByRole("img", { name: festivalStampName, exact: true });
    await expect(image).toHaveJSProperty("complete", false);
    await expectStablePreviewFocus(page);
    releaseImage();
    await expect(image).toHaveJSProperty("complete", true);
    // Check again after the load/layout change, not just showModal's transient
    // focus inside the scroll container. No sleeps or focus calls in the test.
    await expectStablePreviewFocus(page);
    await expect
      .poll(() => dialog.evaluate((element) => element.contains(document.activeElement)))
      .toBe(true);

    const closeButton = dialog.getByRole("button", { name: "Close" }).first();
    await expect(closeButton).toBeVisible();
    const download = dialog.getByLabel("Download", { exact: true });
    for (const control of [
      download,
      dialog.getByRole("link", { name: "Open image in new window" }),
      closeButton
    ]) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await download.tap();
    for (const format of ["WEBP", "PNG"]) {
      const option = dialog.getByRole("link", { name: `Download ${format}`, exact: true });
      await expect(option).toBeVisible();
      const box = await option.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    const closeBox = await closeButton.boundingBox();
    expect(closeBox).not.toBeNull();
    await page.touchscreen.tap(
      closeBox!.x + closeBox!.width / 2,
      closeBox!.y + closeBox!.height / 2
    );

    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeFocused();
  } finally {
    await context.close();
  }
});

test("direct entry and refresh render the server catalogue without restoring a preview", async ({
  page
}) => {
  const url = "/stamps/jp?name=Festival&category=character&source=shop&sort_order=desc";
  const response = await page.goto(url);
  expect(response).not.toBeNull();
  const serverHtml = await response!.text();

  await expect(page.getByRole("heading", { name: "Stamps" })).toBeVisible();
  await expect(page.getByRole("button", { name: festivalStampName, exact: true })).toBeVisible();
  await expect(page.locator(`dialog[aria-label="${festivalStampName}"]`)).toHaveCount(0);
  expect(serverHtml).toContain(festivalStampName);
  expect(serverHtml).not.toMatch(/<dialog[^>]*aria-label="Festival Afterglow"/);

  await page.getByRole("button", { name: festivalStampName, exact: true }).click();
  await expect(page.getByRole("dialog", { name: festivalStampName })).toBeVisible();
  const refreshResponse = await page.reload();
  expect(refreshResponse).not.toBeNull();
  const refreshedHtml = await refreshResponse!.text();

  await expect(page.getByRole("button", { name: festivalStampName, exact: true })).toBeVisible();
  await expect(page.locator(`dialog[aria-label="${festivalStampName}"]`)).toHaveCount(0);
  expect(refreshedHtml).toContain(festivalStampName);
  expect(refreshedHtml).not.toMatch(/<dialog[^>]*aria-label="Festival Afterglow"/);
  await expect
    .poll(() => {
      const currentUrl = new URL(page.url());
      return `${currentUrl.pathname}${currentUrl.search}`;
    })
    .toBe(url);
});

test("category changes keep other filters and region links navigate normally", async ({ page }) => {
  await page.goto("/stamps/jp?name=Festival&source=shop&sort_order=desc");
  await expect(page.getByRole("button", { name: festivalStampName, exact: true })).toBeVisible();

  await page
    .getByRole("group", { name: "Category" })
    .getByRole("button", { name: "Character", exact: true })
    .click();
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        category: url.searchParams.get("category"),
        name: url.searchParams.get("name"),
        source: url.searchParams.get("source"),
        sortOrder: url.searchParams.get("sort_order")
      };
    })
    .toEqual({ category: "character", name: "Festival", source: "shop", sortOrder: "desc" });
  await expect(page.getByRole("searchbox", { name: "Search stamps" })).toHaveValue("Festival");

  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect
    .poll(() => {
      const url = new URL(page.url());
      return {
        pathname: url.pathname,
        category: url.searchParams.get("category"),
        name: url.searchParams.get("name"),
        source: url.searchParams.get("source"),
        sortOrder: url.searchParams.get("sort_order")
      };
    })
    .toEqual({
      pathname: "/stamps/en",
      category: "character",
      name: "Festival",
      source: "shop",
      sortOrder: "desc"
    });
  await expect(page.getByRole("button", { name: festivalStampName, exact: true })).toBeVisible();
  await expect(page.locator(`dialog[aria-label="${festivalStampName}"]`)).toHaveCount(0);
});
