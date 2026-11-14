// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ChibiAnimationPicker from "./ChibiAnimationPicker.svelte";

const labels = {
  title: "Animation",
  filterLabel: "Filter animations",
  filterPlaceholder: "Filter animations",
  noMatches: "No animations match this filter.",
  count: "{count} animations"
};
const animations = ["m_pose_default", "m_walk", "w_walk"];

const renderPicker = (props: Partial<{ selected: string; disabled: boolean }> = {}) => {
  const onSelect = vi.fn();
  render(ChibiAnimationPicker, {
    props: { animations, selected: "m_pose_default", labels, onSelect, ...props }
  });
  return { onSelect };
};

describe("ChibiAnimationPicker", () => {
  afterEach(cleanup);

  it("lists the animations and marks the selected one", () => {
    renderPicker();

    expect(screen.getByText("3 animations")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "m_pose_default" }).getAttribute("aria-pressed")
    ).toBe("true");
    expect(screen.getByRole("button", { name: "m_walk" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  it("reports the chosen animation", async () => {
    const { onSelect } = renderPicker();

    await fireEvent.click(screen.getByRole("button", { name: "w_walk" }));

    expect(onSelect).toHaveBeenCalledExactlyOnceWith("w_walk");
  });

  it("filters by a case-insensitive substring", async () => {
    renderPicker();

    await fireEvent.input(screen.getByRole("searchbox", { name: "Filter animations" }), {
      target: { value: " WALK " }
    });

    expect(screen.queryByRole("button", { name: "m_pose_default" })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(screen.getByText("2 animations")).toBeTruthy();
  });

  it("says so when nothing matches", async () => {
    renderPicker();

    await fireEvent.input(screen.getByRole("searchbox", { name: "Filter animations" }), {
      target: { value: "zzz" }
    });

    expect(screen.getByRole("status").textContent).toBe("No animations match this filter.");
  });

  it("disables the filter and the list while the model is not ready", () => {
    renderPicker({ disabled: true });

    expect(screen.getByRole("searchbox", { name: "Filter animations" })).toHaveProperty(
      "disabled",
      true
    );
    expect(screen.getByRole("button", { name: "m_walk" })).toHaveProperty("disabled", true);
  });
});
