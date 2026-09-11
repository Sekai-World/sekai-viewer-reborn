// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { attachLive2dModelInteractions } from "./live2d-model-interactions";

interface PointerEventInit {
  pointerId: number;
  pointerType: string;
  button: number;
  buttons: number;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
}

interface TouchPoint {
  identifier: number;
  clientX: number;
  clientY: number;
}

const stages: HTMLDivElement[] = [];

afterEach(() => {
  for (const stage of stages.splice(0)) stage.remove();
});

const createStage = (): HTMLDivElement => {
  const stage = document.createElement("div");
  vi.spyOn(stage, "getBoundingClientRect").mockReturnValue({
    left: 10,
    top: 20,
    width: 400,
    height: 300,
    right: 410,
    bottom: 320,
    x: 10,
    y: 20,
    toJSON: () => ({})
  } as DOMRect);
  document.body.append(stage);
  stages.push(stage);
  return stage;
};

const createPointerEvent = (type: string, init: PointerEventInit): PointerEvent => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    pointerType: { value: init.pointerType },
    button: { value: init.button },
    buttons: { value: init.buttons },
    isPrimary: { value: init.isPrimary },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY }
  });
  return event;
};

const createTouchEvent = (type: string, touches: TouchPoint[]): TouchEvent => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as TouchEvent;
  Object.defineProperty(event, "touches", {
    value: touches,
    configurable: true
  });
  return event;
};

describe("Live2D model stage interactions", () => {
  it("zooms from the wheel position and consumes the wheel gesture", () => {
    const stage = createStage();
    const target = {
      pan: vi.fn(async () => true),
      zoom: vi.fn(async () => true)
    };
    const detach = attachLive2dModelInteractions(stage, target);

    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
      clientX: 70,
      clientY: 80
    });
    stage.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(target.zoom).toHaveBeenCalledWith(expect.closeTo(Math.exp(0.1)), 60, 60);
    expect(target.pan).not.toHaveBeenCalled();
    detach();
  });

  it("starts mouse panning only for the primary left button", () => {
    const stage = createStage();
    const target = {
      pan: vi.fn(async () => true),
      zoom: vi.fn(async () => true)
    };
    const detach = attachLive2dModelInteractions(stage, target);

    stage.dispatchEvent(
      createPointerEvent("pointerdown", {
        pointerId: 1,
        pointerType: "mouse",
        button: 2,
        buttons: 2,
        isPrimary: true,
        clientX: 20,
        clientY: 30
      })
    );
    stage.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 1,
        pointerType: "mouse",
        button: -1,
        buttons: 2,
        isPrimary: true,
        clientX: 40,
        clientY: 50
      })
    );

    stage.dispatchEvent(
      createPointerEvent("pointerdown", {
        pointerId: 2,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: 30,
        clientY: 40
      })
    );
    stage.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 2,
        pointerType: "mouse",
        button: -1,
        buttons: 1,
        isPrimary: true,
        clientX: 50,
        clientY: 65
      })
    );

    expect(target.pan).toHaveBeenCalledOnce();
    expect(target.pan).toHaveBeenCalledWith(20, 25);
    detach();
  });

  it("starts mouse panning when a child canvas stops pointerdown bubbling", () => {
    const stage = createStage();
    const canvas = document.createElement("canvas");
    stage.append(canvas);
    canvas.addEventListener("pointerdown", (event) => event.stopPropagation());
    const target = {
      pan: vi.fn(async () => true),
      zoom: vi.fn(async () => true)
    };
    const detach = attachLive2dModelInteractions(stage, target);

    canvas.dispatchEvent(
      createPointerEvent("pointerdown", {
        pointerId: 5,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: 30,
        clientY: 40
      })
    );
    canvas.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 5,
        pointerType: "mouse",
        button: -1,
        buttons: 1,
        isPrimary: true,
        clientX: 50,
        clientY: 65
      })
    );

    expect(target.pan).toHaveBeenCalledOnce();
    expect(target.pan).toHaveBeenCalledWith(20, 25);
    detach();
  });

  it("stops mouse panning when the primary button is released", () => {
    const stage = createStage();
    const target = {
      pan: vi.fn(async () => true),
      zoom: vi.fn(async () => true)
    };
    const detach = attachLive2dModelInteractions(stage, target);

    stage.dispatchEvent(
      createPointerEvent("pointerdown", {
        pointerId: 3,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: 30,
        clientY: 40
      })
    );
    stage.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 3,
        pointerType: "mouse",
        button: -1,
        buttons: 1,
        isPrimary: true,
        clientX: 40,
        clientY: 50
      })
    );
    stage.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 3,
        pointerType: "mouse",
        button: -1,
        buttons: 0,
        isPrimary: true,
        clientX: 70,
        clientY: 80
      })
    );
    stage.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 3,
        pointerType: "mouse",
        button: -1,
        buttons: 1,
        isPrimary: true,
        clientX: 90,
        clientY: 100
      })
    );

    expect(target.pan).toHaveBeenCalledOnce();
    expect(target.pan).toHaveBeenCalledWith(10, 10);
    detach();
  });

  it("stops mouse panning after pointer capture is lost", () => {
    const stage = createStage();
    const target = {
      pan: vi.fn(async () => true),
      zoom: vi.fn(async () => true)
    };
    const detach = attachLive2dModelInteractions(stage, target);

    stage.dispatchEvent(
      createPointerEvent("pointerdown", {
        pointerId: 4,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
        isPrimary: true,
        clientX: 30,
        clientY: 40
      })
    );
    stage.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 4,
        pointerType: "mouse",
        button: -1,
        buttons: 1,
        isPrimary: true,
        clientX: 40,
        clientY: 50
      })
    );
    stage.dispatchEvent(
      createPointerEvent("lostpointercapture", {
        pointerId: 4,
        pointerType: "mouse",
        button: -1,
        buttons: 0,
        isPrimary: true,
        clientX: 40,
        clientY: 50
      })
    );
    stage.dispatchEvent(
      createPointerEvent("pointermove", {
        pointerId: 4,
        pointerType: "mouse",
        button: -1,
        buttons: 1,
        isPrimary: true,
        clientX: 90,
        clientY: 100
      })
    );

    expect(target.pan).toHaveBeenCalledOnce();
    expect(target.pan).toHaveBeenCalledWith(10, 10);
    detach();
  });

  it("lets a one-finger touch continue normal page scrolling", () => {
    const stage = createStage();
    const target = {
      pan: vi.fn(async () => true),
      zoom: vi.fn(async () => true)
    };
    const detach = attachLive2dModelInteractions(stage, target);
    const start = createTouchEvent("touchstart", [{ identifier: 1, clientX: 40, clientY: 60 }]);
    const move = createTouchEvent("touchmove", [{ identifier: 1, clientX: 40, clientY: 120 }]);

    stage.dispatchEvent(start);
    stage.dispatchEvent(move);

    expect(start.defaultPrevented).toBe(false);
    expect(move.defaultPrevented).toBe(false);
    expect(target.pan).not.toHaveBeenCalled();
    expect(target.zoom).not.toHaveBeenCalled();
    detach();
  });

  it("uses two-finger movement for pan and pinch zoom", () => {
    const stage = createStage();
    const target = {
      pan: vi.fn(async () => true),
      zoom: vi.fn(async () => true)
    };
    const detach = attachLive2dModelInteractions(stage, target);

    const start = createTouchEvent("touchstart", [
      { identifier: 1, clientX: 40, clientY: 80 },
      { identifier: 2, clientX: 80, clientY: 80 }
    ]);
    const pan = createTouchEvent("touchmove", [
      { identifier: 1, clientX: 50, clientY: 80 },
      { identifier: 2, clientX: 90, clientY: 80 }
    ]);
    const pinch = createTouchEvent("touchmove", [
      { identifier: 1, clientX: 40, clientY: 80 },
      { identifier: 2, clientX: 120, clientY: 80 }
    ]);

    stage.dispatchEvent(start);
    stage.dispatchEvent(pan);
    stage.dispatchEvent(pinch);

    expect(start.defaultPrevented).toBe(true);
    expect(pan.defaultPrevented).toBe(true);
    expect(pinch.defaultPrevented).toBe(true);
    expect(target.pan).toHaveBeenNthCalledWith(1, 10, 0);
    expect(target.pan).toHaveBeenNthCalledWith(2, 10, 0);
    expect(target.zoom).toHaveBeenCalledWith(2, 70, 60);
    detach();
  });
});
