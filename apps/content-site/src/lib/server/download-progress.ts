type DownloadTaskState = "waiting" | "fetching" | "tagging" | "finalizing" | "done" | "error";

type DownloadTaskSnapshot = {
  state: DownloadTaskState;
  progress: number;
  detail: string;
  updatedAt: number;
};

type DownloadTaskListener = (snapshot: DownloadTaskSnapshot) => void;
type DownloadTaskAbortHandler = () => void;

const DEFAULT_SNAPSHOT: DownloadTaskSnapshot = {
  state: "waiting",
  progress: 0,
  detail: "",
  updatedAt: 0
};

const TASK_TTL_MS = 5 * 60 * 1000;

const taskSnapshots = new Map<string, DownloadTaskSnapshot>();
const taskListeners = new Map<string, Set<DownloadTaskListener>>();
const taskCleanupTimers = new Map<string, ReturnType<typeof setTimeout>>();
const taskAbortHandlers = new Map<string, DownloadTaskAbortHandler>();

const clampProgress = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const clearTaskCleanup = (taskId: string): void => {
  const timer = taskCleanupTimers.get(taskId);
  if (!timer) {
    return;
  }

  clearTimeout(timer);
  taskCleanupTimers.delete(taskId);
};

const scheduleTaskCleanup = (taskId: string): void => {
  clearTaskCleanup(taskId);
  taskCleanupTimers.set(
    taskId,
    setTimeout(() => {
      taskSnapshots.delete(taskId);
      taskListeners.delete(taskId);
      taskCleanupTimers.delete(taskId);
      taskAbortHandlers.delete(taskId);
    }, TASK_TTL_MS)
  );
};

const publishDownloadTask = (
  taskId: string,
  nextSnapshot: Partial<DownloadTaskSnapshot> & Pick<DownloadTaskSnapshot, "state">
): DownloadTaskSnapshot => {
  clearTaskCleanup(taskId);

  const previous = taskSnapshots.get(taskId) ?? DEFAULT_SNAPSHOT;
  const snapshot: DownloadTaskSnapshot = {
    state: nextSnapshot.state,
    progress: clampProgress(nextSnapshot.progress ?? previous.progress),
    detail: nextSnapshot.detail ?? previous.detail,
    updatedAt: Date.now()
  };

  taskSnapshots.set(taskId, snapshot);
  taskListeners.get(taskId)?.forEach((listener) => {
    listener(snapshot);
  });

  if (snapshot.state === "done" || snapshot.state === "error") {
    scheduleTaskCleanup(taskId);
  }

  return snapshot;
};

const getDownloadTaskSnapshot = (taskId: string): DownloadTaskSnapshot =>
  taskSnapshots.get(taskId) ?? DEFAULT_SNAPSHOT;

const subscribeDownloadTask = (taskId: string, listener: DownloadTaskListener): (() => void) => {
  const listeners = taskListeners.get(taskId) ?? new Set<DownloadTaskListener>();
  listeners.add(listener);
  taskListeners.set(taskId, listeners);

  return () => {
    const currentListeners = taskListeners.get(taskId);
    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);
    if (currentListeners.size === 0) {
      taskListeners.delete(taskId);
    }
  };
};

const registerDownloadTaskAbort = (
  taskId: string,
  abortHandler: DownloadTaskAbortHandler
): void => {
  taskAbortHandlers.set(taskId, abortHandler);
};

const unregisterDownloadTaskAbort = (taskId: string): void => {
  taskAbortHandlers.delete(taskId);
};

const cancelDownloadTask = (taskId: string): boolean => {
  const abortHandler = taskAbortHandlers.get(taskId);
  if (!abortHandler) {
    return false;
  }

  abortHandler();
  publishDownloadTask(taskId, {
    state: "error",
    progress: 0,
    detail: "cancelled"
  });
  taskAbortHandlers.delete(taskId);
  return true;
};

export type { DownloadTaskSnapshot, DownloadTaskState };
export {
  cancelDownloadTask,
  getDownloadTaskSnapshot,
  publishDownloadTask,
  registerDownloadTaskAbort,
  subscribeDownloadTask,
  unregisterDownloadTaskAbort
};
