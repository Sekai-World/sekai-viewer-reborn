/** The Cubism Core runtime bundle served from the app's static assets. */
export const CUBISM_CORE_SCRIPT_URL = "/live2d/cubism-core/live2dcubismcore.min.js";

declare global {
  interface Window {
    Live2DCubismCore?: unknown;
  }
}

let cubismCoreLoadPromise: Promise<void> | null = null;

/**
 * Injects the Cubism Core runtime script once and resolves when
 * `window.Live2DCubismCore` exists. The pixi-live2d-display plugin checks the
 * runtime while its module evaluates, so callers must await this before
 * importing any module that pulls the plugin in.
 */
export const ensureCubismCore = (): Promise<void> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Live2D Cubism Core can only be loaded in a browser"));
  }

  if (window.Live2DCubismCore !== undefined) return Promise.resolve();
  if (cubismCoreLoadPromise) return cubismCoreLoadPromise;

  let script: HTMLScriptElement | null = null;
  const loadPromise = new Promise<void>((resolve, reject) => {
    script = document.createElement("script");
    script.async = true;
    script.src = CUBISM_CORE_SCRIPT_URL;
    script.onload = () => {
      if (window.Live2DCubismCore === undefined) {
        reject(
          new Error(
            `Live2D Cubism Core script loaded but did not expose window.Live2DCubismCore: ${CUBISM_CORE_SCRIPT_URL}`
          )
        );
        return;
      }
      resolve();
    };
    script.onerror = () => {
      reject(new Error(`Failed to load Live2D Cubism Core from ${CUBISM_CORE_SCRIPT_URL}`));
    };
    document.head.appendChild(script);
  });

  cubismCoreLoadPromise = loadPromise.catch((error: unknown) => {
    cubismCoreLoadPromise = null;
    if (script?.parentNode) script.remove();
    throw error;
  });

  return cubismCoreLoadPromise;
};
