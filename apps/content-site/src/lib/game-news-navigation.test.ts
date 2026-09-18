import { describe, expect, it, vi } from "vitest";
import { openGameNewsTarget } from "./game-news-navigation";

describe("openGameNewsTarget", () => {
  it("opens external targets in a new tab", () => {
    const openInternal = vi.fn();
    const openExternal = vi.spyOn(window, "open").mockImplementation(() => null);

    openGameNewsTarget(
      { kind: "external", url: "https://news.example.test/article/1" },
      openInternal
    );

    expect(openExternal).toHaveBeenCalledWith(
      "https://news.example.test/article/1",
      "_blank",
      "noopener,noreferrer"
    );
    expect(openInternal).not.toHaveBeenCalled();
  });

  it("delegates internal targets to the modal opener", () => {
    const openInternal = vi.fn();
    const openExternal = vi.spyOn(window, "open").mockImplementation(() => null);

    openGameNewsTarget(
      {
        kind: "internal",
        url: "https://production-web.sekai.colorfulpalette.org/information/index.html"
      },
      openInternal
    );

    expect(openInternal).toHaveBeenCalledWith(
      "https://production-web.sekai.colorfulpalette.org/information/index.html"
    );
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("does not open rejected targets", () => {
    const openInternal = vi.fn();
    const openExternal = vi.spyOn(window, "open").mockImplementation(() => null);

    openGameNewsTarget({ kind: "none", reason: "invalid-path" }, openInternal);

    expect(openInternal).not.toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
