import { render, screen, waitFor } from "@testing-library/svelte";
import { beforeEach, describe, expect, it } from "vitest";
import GlobalNotificationBanner from "./global-notification-banner.svelte";
import type { GlobalNotice } from "./global-notification-banner.types";

const notice: GlobalNotice = {
  id: "scheduled-maintenance",
  version: 1,
  severity: "warning",
  title: "Scheduled maintenance",
  message: "The archive will be briefly unavailable tonight.",
  action: {
    label: "Read the details",
    href: "https://status.example.test/maintenance",
    target: "_blank"
  }
};

describe("GlobalNotificationBanner", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders the configured notice with severity semantics and an action link", () => {
    render(GlobalNotificationBanner, {
      notices: [notice],
      announcementsLabel: "Announcements",
      externalLinkLabel: "Opens in a new window"
    });

    const banner = screen.getByRole("status", { name: "Scheduled maintenance" });
    expect(banner.getAttribute("aria-live")).toBe("polite");
    expect(banner.textContent).not.toContain("Warning");
    expect(screen.getByRole("region", { name: "Announcements" })).toBeTruthy();
    const actionLink = screen.getByRole("link", {
      name: "Read the details (Opens in a new window)"
    });
    expect(actionLink.getAttribute("target")).toBe("_blank");
    expect(actionLink.getAttribute("rel")).toBe("noreferrer");
    expect(actionLink.querySelector("svg")).toBeTruthy();
    expect(actionLink.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("removes visible severity labels while keeping each severity marker", () => {
    const { container } = render(GlobalNotificationBanner, {
      notices: (["info", "success", "warning", "error"] as const).map((severity) => ({
        ...notice,
        id: `notice-${severity}`,
        severity,
        title: `${severity} notice`,
        message: `Message for ${severity}`,
        action: undefined
      })),
      severityLabels: {
        info: "Information",
        success: "Completed",
        warning: "Attention",
        error: "Problem"
      }
    });

    for (const label of ["Info", "Success", "Warning", "Error", "Information", "Completed", "Attention", "Problem"]) {
      expect(screen.queryByText(label, { exact: true })).toBeNull();
    }

    for (const severity of ["info", "success", "warning", "error"] as const) {
      const marker = container.querySelector(`.global-notice-${severity} .global-notice-marker`);
      expect(marker).not.toBeNull();
      expect(marker?.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("keeps the API action label unchanged for same-window actions", () => {
    render(GlobalNotificationBanner, {
      notices: [
        {
          ...notice,
          action: { label: "Open archive", href: "/archive", target: "_self" }
        }
      ],
      externalLinkLabel: "Opens in a new window"
    });

    const actionLink = screen.getByRole("link", { name: "Open archive" });
    expect(actionLink.textContent).toContain("Open archive");
    expect(actionLink.querySelector("svg")).toBeNull();
  });

  it("uses assertive alert semantics for error notices", () => {
    render(GlobalNotificationBanner, {
      notices: [{ ...notice, severity: "error" }]
    });

    expect(
      screen.getByRole("alert", { name: "Scheduled maintenance" }).getAttribute("aria-live")
    ).toBe("assertive");
  });

  it("persists dismissal by notice id and version", async () => {
    const { unmount } = render(GlobalNotificationBanner, {
      notices: [notice],
      storageKey: "test-notices",
      dismissLabel: "Hide"
    });

    await screen.getByRole("button", { name: "Hide: Scheduled maintenance" }).click();
    expect(screen.queryByRole("status", { name: "Scheduled maintenance" })).toBeNull();
    expect(JSON.parse(localStorage.getItem("test-notices") ?? "[]")).toEqual([
      JSON.stringify([notice.id, String(notice.version)])
    ]);

    unmount();
    render(GlobalNotificationBanner, {
      notices: [notice],
      storageKey: "test-notices"
    });

    await waitFor(() => {
      expect(screen.queryByText("Scheduled maintenance")).toBeNull();
    });
  });

  it("shows a new version of a previously dismissed notice", async () => {
    localStorage.setItem(
      "test-notices",
      JSON.stringify([JSON.stringify([notice.id, String(notice.version)])])
    );

    render(GlobalNotificationBanner, {
      notices: [{ ...notice, version: 2 }],
      storageKey: "test-notices"
    });

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "Scheduled maintenance" })).toBeTruthy();
    });
  });
});
