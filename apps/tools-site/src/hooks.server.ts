import type { HandleServerError } from "@sveltejs/kit/hooks";

// Walks the `cause` chain like SvelteKit's default handler: Node's fetch keeps
// the network reason (ECONNREFUSED, ENOTFOUND) in `cause`, not in the message.
const describeErrorChain = (error: unknown): string => {
  const links: string[] = [];
  const seen = new Set<unknown>();
  let current = error;
  while (current instanceof Error && !seen.has(current)) {
    seen.add(current);
    links.push(current.stack ?? `${current.name}: ${current.message}`);
    current = current.cause;
  }
  if (current !== undefined && !seen.has(current)) links.push(String(current));
  return links.join("\nCaused by: ");
};

// Expected errors (`error(404, …)` and framework 404s) keep SvelteKit's default
// message and are not logged. An unexpected error is logged once with a
// correlation id, the route pattern, and the method only: never the request URL,
// query, headers, or cookies. The user receives the generic message and the id.
export const handleError: HandleServerError = ({ kind, error, event }) => {
  if (kind !== "unknown") return;

  const errorId = crypto.randomUUID();
  // The chain is a separate string argument so its stack lines print unescaped.
  console.error(
    "tools-site: unexpected server error",
    { errorId, status: 500, method: event.request.method, routeId: event.route.id },
    `\n${describeErrorChain(error)}`
  );

  return { message: "Internal Error", errorId };
};
