import { error, type RequestHandler } from "@sveltejs/kit";
import {
  cancelDownloadTask,
  getDownloadTaskSnapshot,
  subscribeDownloadTask,
  type DownloadTaskSnapshot
} from "$lib/server/download-progress";

const formatSseMessage = (snapshot: DownloadTaskSnapshot): string =>
  `data: ${JSON.stringify(snapshot)}\n\n`;

export const GET: RequestHandler = async ({ url }) => {
  const taskId = url.searchParams.get("taskId")?.trim() ?? "";
  if (!taskId) {
    throw error(400, "Missing download task id.");
  }

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const clearIdleTimer = (): void => {
        if (!idleTimer) {
          return;
        }

        clearTimeout(idleTimer);
        idleTimer = null;
      };

      const enqueueSnapshot = (snapshot: DownloadTaskSnapshot): void => {
        clearIdleTimer();
        controller.enqueue(encoder.encode(formatSseMessage(snapshot)));

        if (snapshot.state === "done" || snapshot.state === "error") {
          unsubscribe?.();
          unsubscribe = null;
          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
            heartbeatTimer = null;
          }
          controller.close();
        }
      };

      unsubscribe = subscribeDownloadTask(taskId, enqueueSnapshot);
      idleTimer = setTimeout(() => {
        unsubscribe?.();
        unsubscribe = null;
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        controller.close();
      }, 15_000);
      heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      const initialSnapshot = getDownloadTaskSnapshot(taskId);
      if (initialSnapshot.state !== "waiting" || initialSnapshot.updatedAt > 0) {
        enqueueSnapshot(initialSnapshot);
      }
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = null;
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
      return undefined;
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      connection: "keep-alive"
    }
  });
};

export const POST: RequestHandler = async ({ url }) => {
  const taskId = url.searchParams.get("taskId")?.trim() ?? "";
  if (!taskId) {
    throw error(400, "Missing download task id.");
  }

  const cancelled = cancelDownloadTask(taskId);
  return new Response(null, {
    status: cancelled ? 202 : 404
  });
};
