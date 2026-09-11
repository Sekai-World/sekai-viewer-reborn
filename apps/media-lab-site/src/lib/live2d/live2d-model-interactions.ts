import type { Live2dModelViewer } from "./model-viewer";

type Live2dModelTransformTarget = Pick<Live2dModelViewer, "pan" | "zoom">;

interface StagePoint {
  x: number;
  y: number;
}

interface TouchGesture {
  center: StagePoint;
  distance: number;
}

const WHEEL_ZOOM_SENSITIVITY = 0.001;

const isFinitePoint = (point: StagePoint): boolean =>
  Number.isFinite(point.x) && Number.isFinite(point.y);

const getStagePoint = (stage: HTMLElement, clientX: number, clientY: number): StagePoint => {
  const bounds = stage.getBoundingClientRect();
  return { x: clientX - bounds.left, y: clientY - bounds.top };
};

const getTouchGesture = (event: TouchEvent): TouchGesture | null => {
  if (event.touches.length < 2) return null;

  const first = event.touches[0];
  const second = event.touches[1];
  if (!first || !second) return null;

  const firstPoint = { x: first.clientX, y: first.clientY };
  const secondPoint = { x: second.clientX, y: second.clientY };
  const center = {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2
  };
  const distance = Math.hypot(secondPoint.x - firstPoint.x, secondPoint.y - firstPoint.y);
  if (!isFinitePoint(firstPoint) || !isFinitePoint(secondPoint) || !isFinitePoint(center)) {
    return null;
  }

  return { center, distance };
};

const releasePointerCapture = (stage: HTMLElement, pointerId: number): void => {
  if (typeof stage.releasePointerCapture !== "function") return;
  try {
    stage.releasePointerCapture(pointerId);
  } catch {
    // The pointer may already have been released by the browser.
  }
};

/** Attaches model viewport gestures without changing the stage's page-scroll behavior. */
export const attachLive2dModelInteractions = (
  stage: HTMLElement,
  target: Live2dModelTransformTarget
): (() => void) => {
  let mousePointerId: number | null = null;
  let mousePoint: StagePoint | null = null;
  let touchGesture: TouchGesture | null = null;

  const onWheel = (event: WheelEvent): void => {
    if (!Number.isFinite(event.deltaY) || event.deltaY === 0) return;

    const factor = Math.exp(-event.deltaY * WHEEL_ZOOM_SENSITIVITY);
    if (!Number.isFinite(factor) || factor <= 0) return;

    event.preventDefault();
    const focalPoint = getStagePoint(stage, event.clientX, event.clientY);
    if (isFinitePoint(focalPoint)) void target.zoom(factor, focalPoint.x, focalPoint.y);
  };

  const onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !event.isPrimary) return;

    const point = getStagePoint(stage, event.clientX, event.clientY);
    if (!isFinitePoint(point)) return;

    mousePointerId = event.pointerId;
    mousePoint = point;
    if (typeof stage.setPointerCapture === "function") {
      try {
        stage.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional in non-browser test environments.
      }
    }
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (
      event.pointerType !== "mouse" ||
      mousePointerId !== event.pointerId ||
      mousePoint === null
    ) {
      return;
    }
    if (typeof event.buttons === "number" && (event.buttons & 1) === 0) {
      stopMouseDrag(event);
      return;
    }

    const nextPoint = getStagePoint(stage, event.clientX, event.clientY);
    if (!isFinitePoint(nextPoint)) return;

    const deltaX = nextPoint.x - mousePoint.x;
    const deltaY = nextPoint.y - mousePoint.y;
    mousePoint = nextPoint;
    if (deltaX === 0 && deltaY === 0) return;

    event.preventDefault();
    void target.pan(deltaX, deltaY);
  };

  const stopMouseDrag = (event: PointerEvent): void => {
    if (mousePointerId !== event.pointerId) return;
    releasePointerCapture(stage, event.pointerId);
    mousePointerId = null;
    mousePoint = null;
  };

  const onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length < 2) {
      touchGesture = null;
      return;
    }

    event.preventDefault();
    touchGesture = getTouchGesture(event);
  };

  const onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length < 2) {
      touchGesture = null;
      return;
    }

    event.preventDefault();
    const nextGesture = getTouchGesture(event);
    if (!nextGesture) return;

    const previousGesture = touchGesture ?? nextGesture;
    const deltaX = nextGesture.center.x - previousGesture.center.x;
    const deltaY = nextGesture.center.y - previousGesture.center.y;
    if (deltaX !== 0 || deltaY !== 0) void target.pan(deltaX, deltaY);

    if (previousGesture.distance > 0 && nextGesture.distance > 0) {
      const factor = nextGesture.distance / previousGesture.distance;
      if (Number.isFinite(factor) && factor > 0 && factor !== 1) {
        const focalPoint = getStagePoint(stage, nextGesture.center.x, nextGesture.center.y);
        if (isFinitePoint(focalPoint)) {
          void target.zoom(factor, focalPoint.x, focalPoint.y);
        }
      }
    }

    touchGesture = nextGesture;
  };

  const onTouchEnd = (event: TouchEvent): void => {
    touchGesture = getTouchGesture(event);
  };

  const pointerListenerOptions = { capture: true };

  stage.addEventListener("wheel", onWheel, { passive: false });
  stage.addEventListener("pointerdown", onPointerDown, pointerListenerOptions);
  stage.addEventListener("pointermove", onPointerMove, pointerListenerOptions);
  stage.addEventListener("pointerup", stopMouseDrag, pointerListenerOptions);
  stage.addEventListener("pointercancel", stopMouseDrag, pointerListenerOptions);
  stage.addEventListener("lostpointercapture", stopMouseDrag, pointerListenerOptions);
  stage.addEventListener("touchstart", onTouchStart, { passive: false });
  stage.addEventListener("touchmove", onTouchMove, { passive: false });
  stage.addEventListener("touchend", onTouchEnd);
  stage.addEventListener("touchcancel", onTouchEnd);

  return () => {
    if (mousePointerId !== null) releasePointerCapture(stage, mousePointerId);
    mousePointerId = null;
    mousePoint = null;
    touchGesture = null;
    stage.removeEventListener("wheel", onWheel);
    stage.removeEventListener("pointerdown", onPointerDown, pointerListenerOptions);
    stage.removeEventListener("pointermove", onPointerMove, pointerListenerOptions);
    stage.removeEventListener("pointerup", stopMouseDrag, pointerListenerOptions);
    stage.removeEventListener("pointercancel", stopMouseDrag, pointerListenerOptions);
    stage.removeEventListener("lostpointercapture", stopMouseDrag, pointerListenerOptions);
    stage.removeEventListener("touchstart", onTouchStart);
    stage.removeEventListener("touchmove", onTouchMove);
    stage.removeEventListener("touchend", onTouchEnd);
    stage.removeEventListener("touchcancel", onTouchEnd);
  };
};
