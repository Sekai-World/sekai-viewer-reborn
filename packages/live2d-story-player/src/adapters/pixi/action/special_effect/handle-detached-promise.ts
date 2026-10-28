import type { Live2DController } from "../../Live2DController.js";
import type { Snippet } from "../../../../model/scenario-types.js";

export default function handleDetachedPromise(
  promise: unknown,
  controller: Live2DController,
  action: Snippet,
  effectName: string,
  operationName?: string
): void {
  void Promise.resolve(promise).catch((error: unknown) => {
    const operation = operationName ? ` ${operationName}` : "";
    const message = `SpecialEffect/${effectName}${operation} failed: ${String(error)}`;
    controller.logger.warn("Live2DController", message, action, error);
  });
}
