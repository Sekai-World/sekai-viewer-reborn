interface ITask<T> {
  task: (signal: AbortSignal) => Promise<T>;
  callback?: () => void;
}

const getAbortReason = (signal: AbortSignal): unknown =>
  signal.reason ?? new DOMException("The operation was aborted", "AbortError");

const raceWithAbort = <T>(promise: Promise<T>, signal: AbortSignal): Promise<T> => {
  if (signal.aborted) {
    void promise.catch(() => {});
    return Promise.reject(getAbortReason(signal));
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const finish = (result: { kind: "resolve"; value: T } | { kind: "reject"; error: unknown }) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (result.kind === "resolve") resolve(result.value);
      else reject(result.error);
    };
    const onAbort = () => finish({ kind: "reject", error: getAbortReason(signal) });

    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => finish({ kind: "resolve", value }),
      (error: unknown) => finish({ kind: "reject", error })
    );
    if (signal.aborted) onAbort();
  });
};

/** Runs a bounded batch and aborts active tasks when any task fails or times out. */
export class PreloadQueue<T> {
  private readonly maxQueueLength: number;
  private readonly timeout: number;
  private readonly tasks: ITask<T>[];
  private readonly abortController = new AbortController();
  private readonly results: (T | null)[];
  private failure: unknown;
  private hasFailure = false;
  private runPromise: Promise<(T | null)[]> | undefined;
  private readonly externalSignal: AbortSignal | undefined;
  private readonly onExternalAbort: (() => void) | undefined;

  constructor(tasks: ITask<T>[] = [], maxQueueLength = 20, timeout = 60, signal?: AbortSignal) {
    this.tasks = tasks;
    this.maxQueueLength = Math.max(1, Math.floor(maxQueueLength));
    this.timeout = Math.max(0, timeout);
    this.results = new Array(tasks.length).fill(null);
    this.externalSignal = signal;

    if (signal) {
      this.onExternalAbort = () => this.abort(getAbortReason(signal));
      if (signal.aborted) this.onExternalAbort();
      else signal.addEventListener("abort", this.onExternalAbort, { once: true });
    }
  }

  public run(): Promise<(T | null)[]> {
    this.runPromise ??= this.runTasks();
    return this.runPromise;
  }

  private async runTasks(): Promise<(T | null)[]> {
    try {
      if (this.hasFailure) throw this.failure;

      let nextIndex = 0;
      const worker = async (): Promise<void> => {
        if (this.hasFailure || nextIndex >= this.tasks.length) return;
        const taskIndex = nextIndex++;
        const task = this.tasks[taskIndex]!;
        await this.runTask(task, taskIndex);
        return worker();
      };

      await Promise.all(
        Array.from({ length: Math.min(this.maxQueueLength, this.tasks.length) }, () => worker())
      );

      if (this.hasFailure) throw this.failure;
      return this.results;
    } finally {
      this.removeExternalAbortListener();
    }
  }

  private async runTask(task: ITask<T>, taskIndex: number): Promise<void> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        const error = new Error(`${taskIndex}: Promise timeout.`);
        this.abort(error);
        reject(error);
      }, this.timeout * 1000);
    });
    const taskPromise = Promise.resolve().then(() => task.task(this.abortController.signal));

    try {
      const result = await Promise.race([
        raceWithAbort(taskPromise, this.abortController.signal),
        timeoutPromise
      ]);
      this.results[taskIndex] = result;
    } catch (error) {
      this.abort(error);
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      try {
        task.callback?.();
      } catch (error) {
        this.abort(error);
      }
    }
  }

  private abort(error: unknown): void {
    if (this.hasFailure) return;
    this.hasFailure = true;
    this.failure = error;
    if (!this.abortController.signal.aborted) this.abortController.abort(error);
  }

  private removeExternalAbortListener(): void {
    if (this.externalSignal && this.onExternalAbort) {
      this.externalSignal.removeEventListener("abort", this.onExternalAbort);
    }
  }
}
