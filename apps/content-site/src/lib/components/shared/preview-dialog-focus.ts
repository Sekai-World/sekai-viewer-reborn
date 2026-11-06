/**
 * Focus handling for a history-driven image preview dialog.
 *
 * WebKit can restore BODY during history traversal. Chromium can initially focus the
 * implicitly focusable, overflowing modal box before the image loads, then drop focus to
 * BODY when that overflow disappears. This moves those transient targets to an action,
 * never a control the user already reached.
 */
export const rescueDialogFocus = (dialog: HTMLDialogElement): void => {
  const active = document.activeElement;
  if (
    !dialog.open ||
    (active !== document.body && active !== dialog && active !== dialog.querySelector(".modal-box"))
  )
    return;
  dialog.querySelector<HTMLElement>(".modal-box summary, .modal-box button")?.focus({
    preventScroll: true
  });
};

/**
 * Native modal dialogs make the page inert, but Chromium can still send boundary Tab to
 * browser chrome (activeElement becomes BODY). This wraps only those boundaries and keeps
 * native Tab order and details/menu behavior inside. Returns the function that stops it.
 */
export const loopDialogTabFocus = (
  dialog: HTMLDialogElement,
  isActive: () => boolean
): (() => void) => {
  const loopFocus = (event: KeyboardEvent): void => {
    if (
      !isActive() ||
      !dialog.open ||
      event.defaultPrevented ||
      event.key !== "Tab" ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    )
      return;

    const controls = [
      ...dialog.querySelectorAll<HTMLElement>("summary, a[href], button, [tabindex]")
    ].filter((element) => {
      const style = getComputedStyle(element);
      return (
        element.tabIndex >= 0 &&
        !element.matches(":disabled") &&
        !element.closest("[hidden], [inert]") &&
        style.visibility !== "hidden" &&
        style.visibility !== "collapse" &&
        element.getClientRects().length > 0
      );
    });
    const first = controls[0];
    const last = controls[controls.length - 1];
    const boundary = event.shiftKey ? first : last;
    const destination = event.shiftKey ? last : first;
    if (destination && document.activeElement === boundary) {
      event.preventDefault();
      destination.focus();
    }
  };

  dialog.addEventListener("keydown", loopFocus);
  return () => dialog.removeEventListener("keydown", loopFocus);
};
