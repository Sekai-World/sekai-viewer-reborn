import { error, type RequestHandler } from "@sveltejs/kit";
import {
  cancelDownloadTask,
  getDownloadTaskSnapshot,
  hasDownloadTask,
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

  if (!hasDownloadTask(taskId)) {
    throw error(404, "Download task not found.");
  }

  let unsubscribe: (() => void) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const enqueueSnapshot = (snapshot: DownloadTaskSnapshot): void => {
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
      heartbeatTimer = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15000);

      enqueueSnapshot(getDownloadTaskSnapshot(taskId));
    },
    cancel() {
      unsubscribe?.();
      unsubscribe = null;
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
