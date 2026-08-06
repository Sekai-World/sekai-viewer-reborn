import { expect, test, type Page } from "@playwright/test";

const frozenTime = new Date("2026-01-01T00:00:00.000Z").valueOf();
const viewportWidth = (projectName: string): string => projectName.replace("chromium-", "");

test.beforeEach(async ({ page }) => {
  await page.addInitScript((timestamp) => {
    const OriginalDate = Date;
    class FrozenDate extends OriginalDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(args.length ? args[0] : timestamp);
      }

      static now = (): number => timestamp;
    }

    Object.defineProperty(window, "Date", { configurable: true, value: FrozenDate });
    let animationFrameStarted = false;
    window.requestAnimationFrame = ((callback: FrameRequestCallback): number => {
      if (!animationFrameStarted) {
        animationFrameStarted = true;
        callback(0);
      }
      return 1;
    }) as typeof window.requestAnimationFrame;
  }, frozenTime);
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
});

const stabilizeVisualState = async (page: Page, section: ReturnType<Page["locator"]>): Promise<void> => {
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      html { scroll-behavior: auto !important; }
    `
  });
  await page.evaluate(() => {
    document.documentElement.dataset.lowMotion = "true";
  });
  if (await section.locator("img").count()) {
    await expect
      .poll(() => section.locator("img").evaluateAll((images) => images.every((image) => (image as HTMLImageElement).complete)))
      .toBe(true);
  }
};

test("current event pending", async ({ page, request }, testInfo) => {
  await request.get("http://127.0.0.1:4173/__visual/current-event?mode=pending");
  await page.goto("/", { waitUntil: "commit" });

  const section = page.locator('section[aria-labelledby="current-event-title"]');
  await expect(section.locator('[aria-busy="true"]')).toBeVisible();
  await page.evaluate(() => window.stop());
  await stabilizeVisualState(page, section);
  await expect(section).toHaveScreenshot(`current-event-pending-${viewportWidth(testInfo.project.name)}.png`);
});

test("current event fulfilled", async ({ page, request }, testInfo) => {
  await request.get("http://127.0.0.1:4173/__visual/current-event?mode=fulfilled");
  await page.goto("/");

  const section = page.locator('section[aria-labelledby="current-event-title"]');
  await expect(section.getByRole("heading", { name: "Visual Regression Event" })).toBeVisible();
  await expect(section.locator('[aria-busy="true"]')).toHaveCount(0);
  await stabilizeVisualState(page, section);
  await expect.poll(() => section.boundingBox()).toEqual(expect.any(Object));
  await expect(section).toHaveScreenshot(`current-event-fulfilled-${viewportWidth(testInfo.project.name)}.png`);
});
