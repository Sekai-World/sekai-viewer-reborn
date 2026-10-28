import { describe, expect, it, vi } from "vitest";
import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";
import BlackIn from "./BlackIn.js";
import BlackOut from "./BlackOut.js";
import BlackWipeInBottom from "./BlackWipeInBottom.js";
import BlackWipeInLeft from "./BlackWipeInLeft.js";
import BlackWipeInRight from "./BlackWipeInRight.js";
import BlackWipeInTop from "./BlackWipeInTop.js";
import BlackWipeOutBottom from "./BlackWipeOutBottom.js";
import BlackWipeOutLeft from "./BlackWipeOutLeft.js";
import BlackWipeOutRight from "./BlackWipeOutRight.js";
import BlackWipeOutTop from "./BlackWipeOutTop.js";
import FlashbackIn from "./FlashbackIn.js";
import WhiteIn from "./WhiteIn.js";
import WhiteOut from "./WhiteOut.js";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

type FadeAction = (controller: Live2DController, action: Snippet) => Promise<void>;

type DetachedOperation = {
  key: string;
  label: string;
};

type FadeCase = {
  name: string;
  run: FadeAction;
  operations: readonly string[];
  detached: readonly DetachedOperation[];
  awaited: readonly string[];
};

const fadeCases: FadeCase[] = [
  {
    name: "BlackIn",
    run: BlackIn,
    operations: ["fullcolor.draw", "fullscreen_text.hide", "fullcolor.hide"],
    detached: [
      { key: "fullcolor.draw", label: "fullcolor draw" },
      { key: "fullscreen_text.hide", label: "fullscreen text hide" }
    ],
    awaited: ["fullcolor.hide"]
  },
  {
    name: "BlackOut",
    run: BlackOut,
    operations: ["dialog.hide", "fullcolor.draw", "fullcolor.show"],
    detached: [
      { key: "dialog.hide", label: "dialog hide" },
      { key: "fullcolor.draw", label: "fullcolor draw" }
    ],
    awaited: ["fullcolor.show"]
  },
  {
    name: "BlackWipeInBottom",
    run: BlackWipeInBottom,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "BlackWipeInLeft",
    run: BlackWipeInLeft,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "BlackWipeInRight",
    run: BlackWipeInRight,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "BlackWipeInTop",
    run: BlackWipeInTop,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "BlackWipeOutBottom",
    run: BlackWipeOutBottom,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "BlackWipeOutLeft",
    run: BlackWipeOutLeft,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "BlackWipeOutRight",
    run: BlackWipeOutRight,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "BlackWipeOutTop",
    run: BlackWipeOutTop,
    operations: ["wipe.draw", "wipe.animate"],
    detached: [{ key: "wipe.draw", label: "wipe draw" }],
    awaited: ["wipe.animate"]
  },
  {
    name: "FlashbackIn",
    run: FlashbackIn,
    operations: ["flashback_filter.draw", "flashback_filter.show"],
    detached: [{ key: "flashback_filter.draw", label: "flashback filter draw" }],
    awaited: ["flashback_filter.show"]
  },
  {
    name: "WhiteIn",
    run: WhiteIn,
    operations: ["fullcolor.draw", "fullcolor.hide"],
    detached: [{ key: "fullcolor.draw", label: "fullcolor draw" }],
    awaited: ["fullcolor.hide"]
  },
  {
    name: "WhiteOut",
    run: WhiteOut,
    operations: ["dialog.hide", "fullcolor.draw", "fullcolor.show"],
    detached: [
      { key: "dialog.hide", label: "dialog hide" },
      { key: "fullcolor.draw", label: "fullcolor draw" }
    ],
    awaited: ["fullcolor.show"]
  }
];

function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function createController(pending: ReadonlyMap<string, Deferred<void>>) {
  const started: string[] = [];
  const logger = { log: vi.fn(), warn: vi.fn() };
  const events = { emit: vi.fn() };
  const operation = (name: string) => () => {
    started.push(name);
    return pending.get(name)?.promise ?? Promise.resolve();
  };
  const layers = {
    fullcolor: {
      draw: operation("fullcolor.draw"),
      hide: operation("fullcolor.hide"),
      show: operation("fullcolor.show")
    },
    fullscreen_text: { hide: operation("fullscreen_text.hide") },
    dialog: { hide: operation("dialog.hide") },
    wipe: {
      draw: operation("wipe.draw"),
      animate: operation("wipe.animate")
    },
    flashback_filter: {
      draw: operation("flashback_filter.draw"),
      show: operation("flashback_filter.show")
    }
  };
  const controller = {
    scenarioData: { SpecialEffectData: [{ Duration: 0.25 }] },
    logger,
    events,
    layers
  } as unknown as Live2DController;

  return { controller, events, layers, logger, started };
}

function pendingOperations(operations: readonly string[]) {
  return new Map(operations.map((name) => [name, deferred<void>()] as const));
}

describe("fade effects preserve detached transition timing and report failures", () => {
  it.each(fadeCases)(
    "$name starts transitions in order and supports simultaneous completion",
    async (testCase) => {
      const pending = pendingOperations(testCase.operations);
      const { controller, started } = createController(pending);
      const actionPromise = testCase.run(controller, { ReferenceIndex: 0 } as Snippet);

      expect(started).toEqual(testCase.operations);
      for (const operation of pending.values()) operation.resolve();
      await actionPromise;
    }
  );

  it.each(fadeCases)(
    "$name does not wait for detached transitions and reports their rejections",
    async (testCase) => {
      const pending = pendingOperations(testCase.operations);
      const { controller, events, logger, started } = createController(pending);
      const action = { ReferenceIndex: 0 } as Snippet;
      const actionPromise = testCase.run(controller, action);

      expect(started).toEqual(testCase.operations);
      for (const operationName of testCase.awaited) pending.get(operationName)?.resolve();
      await actionPromise;

      const detachedPromises = testCase.detached.map(({ key }) => {
        const operation = pending.get(key);
        if (!operation) throw new Error(`Missing deferred operation ${key}`);
        return operation.promise;
      });
      const failures = testCase.detached.map(({ key, label }) => {
        const error = new Error(`${key} failed`);
        pending.get(key)?.reject(error);
        return { error, label };
      });

      await Promise.allSettled(detachedPromises);
      expect(logger.warn).toHaveBeenCalledTimes(failures.length);
      expect(events.emit).not.toHaveBeenCalled();

      for (const { error, label } of failures) {
        const message = `SpecialEffect/${testCase.name} ${label} failed: ${String(error)}`;
        expect(logger.warn).toHaveBeenCalledWith("Live2DController", message, action, error);
      }
    }
  );

  it("preserves synchronous throws from detached layer calls", async () => {
    const pending = pendingOperations(["fullcolor.draw", "fullcolor.hide"]);
    const { controller, events, layers, logger } = createController(pending);
    const action = { ReferenceIndex: 0 } as Snippet;
    const failure = new Error("draw setup failed synchronously");
    layers.fullcolor.draw = () => {
      throw failure;
    };

    await expect(WhiteIn(controller, action)).rejects.toBe(failure);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
