// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import commonMessages from "@platform/i18n-source/tools-site/common.json";

const page = vi.hoisted(() => ({
  status: 500,
  url: new URL("http://localhost/"),
  error: null as App.Error | null,
  data: {} as Record<string, unknown>
}));

vi.mock("$app/state", () => ({ page }));

import ErrorPage from "./+error.svelte";

const showError = (
  status: number,
  path: string,
  error: Omit<App.Error, "status">,
  data: Record<string, unknown> = {}
): void => {
  page.status = status;
  page.url = new URL(path, "http://localhost");
  page.error = { status, ...error };
  page.data = data;
  render(ErrorPage);
};

afterEach(() => {
  cleanup();
});

describe("tools-site route error page", () => {
  it("explains an expected 404 with a way home and no retry", () => {
    showError(404, "/tracker/xx", { message: "Region not found" });

    expect(
      screen.getByRole("heading", { level: 1, name: commonMessages["errorPage.notFoundTitle"] })
    ).toBeTruthy();
    expect(screen.getByText(commonMessages["errorPage.notFoundDescription"])).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: commonMessages["errorPage.homeAction"] })
        .getAttribute("href")
    ).toBe("/");
    expect(
      screen.queryByRole("link", { name: commonMessages["errorPage.retryAction"] })
    ).toBeNull();
  });

  it("offers a full-reload retry of the same URL for an unexpected error", () => {
    showError(500, "/tracker/jp?eventId=12", {
      message: "Internal Error",
      errorId: "8a7f9c1e-1111-4222-8333-944445555666"
    });

    expect(
      screen.getByRole("heading", { level: 1, name: commonMessages["errorPage.title"] })
    ).toBeTruthy();
    const retry = screen.getByRole("link", { name: commonMessages["errorPage.retryAction"] });
    expect(retry.getAttribute("href")).toBe("/tracker/jp?eventId=12");
    expect(retry.hasAttribute("data-sveltekit-reload")).toBe(true);
    expect(screen.getByRole("link", { name: commonMessages["errorPage.homeAction"] })).toBeTruthy();
  });

  it("never renders the raw error message, correlation id, or stack", () => {
    showError(500, "/music-recommender", {
      message: "Error: upstream exploded\n    at load (/app/build/server/chunks/page.js:1:1)",
      errorId: "8a7f9c1e-1111-4222-8333-944445555666"
    });

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("upstream exploded");
    expect(text).not.toContain("page.js");
    expect(text).not.toContain("8a7f9c1e");
  });

  it("uses the layout locale dictionary when the root layout data is available", () => {
    showError(
      404,
      "/missing",
      { message: "Not Found" },
      {
        uiLocale: "ja-JP",
        i18nMessages: { "errorPage.notFoundTitle": "ページが見つかりません" }
      }
    );

    expect(screen.getByRole("heading", { level: 1, name: "ページが見つかりません" })).toBeTruthy();
    // Keys missing from the remote dictionary fall back to the bundled source.
    expect(screen.getByRole("link", { name: commonMessages["errorPage.homeAction"] })).toBeTruthy();
  });
});
