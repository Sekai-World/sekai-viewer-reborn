import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import ViewerShell from "./viewer-shell.svelte";

const renderShell = (props: Record<string, unknown> = {}) =>
  render(ViewerShell, {
    drawerId: "test-drawer",
    navTitle: "Test Nav",
    ...props
  });

describe("ViewerShell", () => {
  it("renders a compact version badge with a 'v' prefix in the navbar", () => {
    renderShell({ siteVersion: "0.0.1" });

    const version = screen.getByTitle("Site version");
    expect(version.textContent).toContain("v0.0.1");
    // accessible label is announced separately from the compact value
    expect(version.textContent).toContain("Site version:");
  });

  it("keeps an existing 'v' prefix without doubling it", () => {
    renderShell({ siteVersion: "v1.2.3" });

    const version = screen.getByTitle("Site version");
    expect(version.textContent).toContain("v1.2.3");
    expect(version.textContent).not.toContain("vv1.2.3");
  });

  it("does not render the version badge when siteVersion is omitted", () => {
    renderShell({});

    expect(screen.queryByTitle("Site version")).toBeNull();
  });

  it("renders navBadge alongside the site version without dropping either", () => {
    renderShell({ siteVersion: "0.4.2", navBadge: "Profile" });

    expect(screen.getByTitle("Site version").textContent).toContain("v0.4.2");
    expect(screen.getByText("Profile")).toBeTruthy();
  });

  it("invokes navActions alongside the site version without dropping either", () => {
    let navActionsInvoked = false;
    renderShell({
      siteVersion: "0.4.2",
      navActions: () => {
        navActionsInvoked = true;
        return "Settings";
      }
    });

    expect(navActionsInvoked).toBe(true);
    expect(screen.getByTitle("Site version").textContent).toContain("v0.4.2");
  });
});
