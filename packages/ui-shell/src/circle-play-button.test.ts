import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import CirclePlayButton from "./circle-play-button.svelte";

describe("CirclePlayButton", () => {
  it("labels itself with the requested state and forwards clicks", async () => {
    const onclick = vi.fn();
    const { rerender } = render(CirclePlayButton, {
      playing: false,
      label: "Play",
      onclick
    });

    await fireEvent.click(screen.getByRole("button", { name: "Play" }));
    expect(onclick).toHaveBeenCalledTimes(1);

    await rerender({ playing: true, label: "Pause", onclick });
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
  });

  it("renders the loading spinner instead of icons and honors disabled", () => {
    render(CirclePlayButton, { playing: false, loading: true, disabled: true, label: "Play" });

    const button = screen.getByRole("button", { name: "Play" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector(".loading-spinner")).not.toBeNull();
    expect(button.textContent?.trim()).toBe("");
  });
});
