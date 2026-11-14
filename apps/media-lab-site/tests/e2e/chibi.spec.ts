import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { mockServerPort, type Costume2dsMode } from "./mock-server";

const ASSET_HOST_PATTERN = "https://storage.sekai.best/**";

const setCatalogMode = async (request: APIRequestContext, mode: Costume2dsMode): Promise<void> => {
  const response = await request.post(
    `http://127.0.0.1:${mockServerPort}/__mock/costume2ds?mode=${mode}`
  );
  expect(response.ok()).toBe(true);
};

const expectNoHorizontalOverflow = async (page: Page): Promise<void> => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
};

/**
 * Answers the model's atlas with one status and its family skeleton with an
 * empty file, so the atlas alone decides the outcome. Returns the atlas URLs.
 */
const answerAtlas = async (page: Page, status: number): Promise<string[]> => {
  const atlasUrls: string[] = [];
  await page.route(ASSET_HOST_PATTERN, (route) => {
    const url = route.request().url();
    const isAtlas = url.endsWith(".atlas.txt");
    if (isAtlas) atlasUrls.push(url);
    return route.fulfill({
      status: isAtlas ? status : 200,
      headers: { "access-control-allow-origin": "*" },
      body: ""
    });
  });
  return atlasUrls;
};

// The service worker would answer asset requests itself, past `page.route`.
test.use({ serviceWorkers: "block" });

test.describe("Chibi catalog", () => {
  test.afterEach(async ({ request }) => {
    await setCatalogMode(request, "ok");
  });

  test("groups models by character and lists the rest under Others", async ({ page }) => {
    await page.goto("/chibi");

    await expect(page.getByRole("heading", { level: 1, name: "Chibi Studio" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Characters" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page.getByRole("tab", { name: /Test Hero/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Normal" })).toBeVisible();
    await expect(page.getByRole("link", { name: "School Updated model" })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole("tab", { name: "Others" }).click();

    await expect(page.getByRole("link", { name: "Mob001" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Normal" })).toHaveCount(0);
  });

  test("moves between the group tabs with the arrow keys", async ({ page }) => {
    await page.goto("/chibi");

    await page.getByRole("tab", { name: "Characters" }).focus();
    await page.keyboard.press("ArrowRight");

    await expect(page.getByRole("tab", { name: "Others" })).toBeFocused();
    await expect(page.getByRole("link", { name: "Mob001" })).toBeVisible();
  });

  test("opens the viewer of the chosen model", async ({ page }) => {
    await answerAtlas(page, 404);
    await page.goto("/chibi");

    await page.getByRole("link", { name: "Normal" }).click();

    await expect(page).toHaveURL(/\/chibi\/sd_01hero_normal$/);
    await expect(page.getByRole("heading", { level: 1, name: "Hero Normal" })).toBeVisible();
  });

  test("explains an empty catalog", async ({ page, request }) => {
    await setCatalogMode(request, "empty");
    await page.goto("/chibi");

    await expect(page.getByText("No Chibi models are available.")).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
  });

  test("reports a failing data service and offers a retry", async ({ page, request }) => {
    await setCatalogMode(request, "error");
    await page.goto("/chibi");

    await expect(page.getByRole("alert")).toContainText("Model list unavailable");

    await setCatalogMode(request, "ok");
    await page.getByRole("link", { name: "Try again" }).click();

    await expect(page.getByRole("tab", { name: "Characters" })).toBeVisible();
  });
});

test.describe("Chibi viewer", () => {
  test("tells a model without assets apart from a failed load", async ({ page }) => {
    await answerAtlas(page, 404);
    await page.goto("/chibi/sd_01hero_normal");

    await expect(page.getByText("This model is not available")).toBeVisible();
    await expect(page.getByTestId("chibi-viewer-status")).toHaveAttribute(
      "data-status",
      "unavailable"
    );
    await expect(page.getByRole("searchbox", { name: "Filter animations" })).toBeDisabled();
    await expectNoHorizontalOverflow(page);
  });

  test("offers a retry when the assets fail to load", async ({ page }) => {
    const requestedUrls = await answerAtlas(page, 500);
    await page.goto("/chibi/sd_01hero_normal");

    await expect(page.getByRole("alert")).toContainText("This model could not be loaded");
    const requestsBeforeRetry = requestedUrls.length;

    await page.getByRole("button", { name: "Try again" }).click();

    await expect.poll(() => requestedUrls.length).toBeGreaterThan(requestsBeforeRetry);
    await expect(page.getByRole("alert")).toContainText("This model could not be loaded");
  });

  test("answers 404 for a name outside the known model families", async ({ page }) => {
    const response = await page.goto("/chibi/not_a_model");

    expect(response?.status()).toBe(404);
  });
});
