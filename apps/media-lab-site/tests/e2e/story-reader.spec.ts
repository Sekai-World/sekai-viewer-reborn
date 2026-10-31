import { expect, test, type Page } from "@playwright/test";
import { storyCases } from "./fixtures";

const textPath = (region: string, storyType: string, storyId: string): string =>
  `/story-reader/${region}/${storyType}/${storyId}`;
const playerPath = (region: string, storyType: string, storyId: string): string =>
  `/live2d/story-reader/${region}/${storyType}/${storyId}`;

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

test.describe("text reader", () => {
  for (const storyCase of storyCases) {
    test(`renders the ${storyCase.storyType} story from master data and its scenario`, async ({
      page
    }) => {
      await page.goto(textPath("jp", storyCase.storyType, storyCase.storyId));

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText(storyCase.line)).toBeVisible();
      await expect(page.getByText("Test Hero").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("tells a region that has not synced its data apart from a missing story", async ({
    page
  }) => {
    await page.goto(textPath("cn", "unit", "testunit-1-1"));
    await expect(page.getByText("This story is not available in this region yet.")).toBeVisible();
  });

  test("reports a failing data service as temporarily unavailable", async ({ page }) => {
    await page.goto(textPath("kr", "unit", "testunit-1-1"));
    await expect(page.getByText(/temporarily unavailable for this region/)).toBeVisible();
  });

  test("answers 404 for a story the region does not have", async ({ page }) => {
    const response = await page.goto(textPath("jp", "unit", "testunit-9-9"));
    expect(response?.status()).toBe(404);
  });

  test("answers 404 for a malformed route", async ({ page }) => {
    const response = await page.goto(textPath("jp", "not-a-type", "1"));
    expect(response?.status()).toBe(404);
  });

  test("reports a scenario file the asset host does not have", async ({ page }) => {
    // Character 2 resolves from master data, but its scenario file is missing.
    await page.goto(textPath("jp", "character", "2"));
    await expect(page.getByText(/scenario data for this story could not be loaded/)).toBeVisible();
  });
});

test.describe("player route", () => {
  for (const storyCase of storyCases) {
    test(`opens the ${storyCase.storyType} story in the player shell`, async ({ page }) => {
      await page.goto(playerPath("jp", storyCase.storyType, storyCase.storyId));

      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.locator("[data-player-phase]")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  test("shows the region-unavailable state instead of a stage", async ({ page }) => {
    await page.goto(playerPath("cn", "unit", "testunit-1-1"));
    await expect(page.getByText("This story is not available in this region yet.")).toBeVisible();
    await expect(page.locator("[data-player-phase]")).toHaveCount(0);
  });

  test("answers 404 for a story the region does not have", async ({ page }) => {
    const response = await page.goto(playerPath("jp", "card", "999"));
    expect(response?.status()).toBe(404);
  });
});

test.describe("route changes", () => {
  test("switches between the text reader and the player and back", async ({ page }) => {
    await page.goto(textPath("jp", "unit", "testunit-1-1"));
    const switchLink = page.getByRole("link", { name: "Live2D Player", exact: true });
    await expect(switchLink).toHaveAttribute("title", /Open this story in the Live2D Player/);
    await switchLink.click();

    await expect(page).toHaveURL(playerPath("jp", "unit", "testunit-1-1"));
    await expect(page.locator("[data-player-phase]")).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(textPath("jp", "unit", "testunit-1-1"));
    await expect(page.getByText("Unit story line for the browser test.")).toBeVisible();
  });

  test("shows the new story, not the old one, when navigating between stories", async ({
    page
  }) => {
    await page.goto(textPath("jp", "unit", "testunit-1-1"));
    await expect(page.getByText("Unit story line for the browser test.")).toBeVisible();

    await page.goto(textPath("jp", "event", "1-1"));
    await expect(page.getByText("Event story line for the browser test.")).toBeVisible();
    await expect(page.getByText("Unit story line for the browser test.")).toHaveCount(0);
  });
});
