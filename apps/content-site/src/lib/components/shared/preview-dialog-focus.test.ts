import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loopDialogTabFocus, rescueDialogFocus } from "./preview-dialog-focus";

let dialog: HTMLDialogElement;
let first: HTMLButtonElement;
let middle: HTMLButtonElement;
let last: HTMLButtonElement;

beforeEach(() => {
  document.body.innerHTML = `
    <dialog open>
      <div class="modal-box" tabindex="-1">
        <button id="first"></button>
        <button id="middle"></button>
        <button id="disabled" disabled></button>
        <button id="last"></button>
      </div>
    </dialog>`;
  dialog = document.querySelector("dialog")!;
  first = dialog.querySelector("#first")!;
  middle = dialog.querySelector("#middle")!;
  last = dialog.querySelector("#last")!;
  // jsdom has no layout, so give every element the box a rendered element has.
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("rescueDialogFocus", () => {
  it("moves focus from the body, the dialog, or its box to the first action", () => {
    rescueDialogFocus(dialog);
    expect(document.activeElement).toBe(first);

    first.blur();
    dialog.querySelector<HTMLElement>(".modal-box")?.focus();
    rescueDialogFocus(dialog);
    expect(document.activeElement).toBe(first);
  });

  it("leaves a control the user reached alone", () => {
    middle.focus();

    rescueDialogFocus(dialog);

    expect(document.activeElement).toBe(middle);
  });

  it("does nothing while the dialog is closed", () => {
    dialog.removeAttribute("open");

    rescueDialogFocus(dialog);

    expect(document.activeElement).toBe(document.body);
  });
});

describe("loopDialogTabFocus", () => {
  const press = (init: KeyboardEventInit): KeyboardEvent => {
    const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
    document.activeElement?.dispatchEvent(event);
    return event;
  };

  it("wraps Tab and Shift+Tab at the boundaries, skipping disabled controls", () => {
    const stop = loopDialogTabFocus(dialog, () => true);

    last.focus();
    expect(press({ key: "Tab" }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    expect(press({ key: "Tab", shiftKey: true }).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    stop();
  });

  it("keeps native Tab order inside the boundaries", () => {
    const stop = loopDialogTabFocus(dialog, () => true);

    middle.focus();

    expect(press({ key: "Tab" }).defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(middle);

    stop();
  });

  it("ignores other keys, modified Tab, an inactive preview, and a closed dialog", () => {
    let active = true;
    const stop = loopDialogTabFocus(dialog, () => active);
    last.focus();

    expect(press({ key: "Enter" }).defaultPrevented).toBe(false);
    expect(press({ key: "Tab", ctrlKey: true }).defaultPrevented).toBe(false);

    active = false;
    expect(press({ key: "Tab" }).defaultPrevented).toBe(false);

    active = true;
    dialog.removeAttribute("open");
    expect(press({ key: "Tab" }).defaultPrevented).toBe(false);

    stop();
  });

  it("stops when asked", () => {
    loopDialogTabFocus(dialog, () => true)();
    last.focus();

    expect(press({ key: "Tab" }).defaultPrevented).toBe(false);
  });
});
