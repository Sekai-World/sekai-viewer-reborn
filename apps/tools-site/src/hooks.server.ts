import type { HandleServerError } from "@sveltejs/kit/hooks";

const describeError = (error: unknown): string =>
  error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error);

// Expected errors (`error(404, …)` and framework 404s) keep SvelteKit's default
// message and are not logged. An unexpected error is logged once with a
// correlation id, the route pattern, and the method only: never the request URL,
// query, headers, or cookies. The user receives the generic message and the id.
export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== "unknown") return;

  const errorId = crypto.randomUUID();
  console.error("tools-site: unexpected server error", {
    errorId,
    status: 500,
    method: event.request.method,
    routeId: event.route.id,
    error: describeError(error)
  });

  return { message: "Internal Error", errorId };
};
