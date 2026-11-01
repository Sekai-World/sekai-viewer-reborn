// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";

const page = vi.hoisted(() => ({
  status: 500,
  url: new URL("http://localhost/"),
  error: null as App.Error | null,
  data: {} as Record<string, unknown>
}));

vi.mock("$app/state", () => ({ page }));

import ErrorPage from "./+error.svelte";

const showError = (status: number, path: string, error: Omit<App.Error, "status">): void => {
  page.status = status;
  page.url = new URL(path, "http://localhost");
  page.error = { status, ...error };
  render(ErrorPage);
};

afterEach(() => {
  cleanup();
});

describe("account-site route error page", () => {
  it("explains an expected 404 with a way home and no retry", () => {
    showError(404, "/missing", { message: "Not Found" });

    expect(
      screen.getByRole("heading", { level: 1, name: "We couldn't find that page" })
    ).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to home" }).getAttribute("href")).toBe("/");
    expect(screen.queryByRole("link", { name: "Try again" })).toBeNull();
  });

  it("offers a full-reload retry of the same URL for an unexpected error", () => {
    showError(500, "/?region=jp", { message: "Internal Error" });

    expect(screen.getByRole("heading", { level: 1, name: "This page couldn't load" })).toBeTruthy();
    const retry = screen.getByRole("link", { name: "Try again" });
    expect(retry.getAttribute("href")).toBe("/?region=jp");
    expect(retry.hasAttribute("data-sveltekit-reload")).toBe(true);
  });

  it("never renders the raw error message or stack", () => {
    showError(500, "/", {
      message: "Error: upstream exploded\n    at load (/app/build/server/chunks/page.js:1:1)"
    });

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("upstream exploded");
    expect(text).not.toContain("page.js");
  });
});
