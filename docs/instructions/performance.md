# Performance Instructions

## Measure before changing

- Profile the affected user flow before optimizing and verify the result after.
  Use browser performance tools, Lighthouse, or Node inspection as appropriate.
- Optimize common, measured bottlenecks; keep clear code when no measurement
  justifies additional complexity.

## Frontend and SvelteKit

- Let SvelteKit split routes automatically and dynamically import genuinely
  heavy, non-critical features when a measured need exists.
- Use stable identity keys for changing `{#each}` lists. Do not use array indexes
  when items can be inserted, removed, or reordered.
- Prefer `$derived` for computed state and avoid effects that repeatedly
  synchronize state or trigger unnecessary work.
- Debounce or throttle high-frequency input, scroll, and resize work when it
  affects rendering or requests. Clean up event listeners, intervals,
  observers, and pending asynchronous work when components are destroyed.
- Reserve image dimensions, lazy-load long-list media, and use responsive assets
  where the delivery path supports them. Avoid loading off-screen artwork early.
- Keep the initial JavaScript and DOM small. Avoid expensive broad blur, filters,
  shadows, animations, and layout-triggering loops; prefer local `transform` and
  `opacity` feedback that respects reduced motion.

## Node and server work

- Do not block the Node event loop with synchronous I/O or CPU-heavy request
  work. Stream large payloads and use cancellation or backpressure where the
  surrounding API supports it.
- Reuse clients outside hot paths, bound concurrency for external work, and
  measure memory and latency before adding caches or workers.
