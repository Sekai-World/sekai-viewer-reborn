# `@platform/sekai-api-sdk`

- The public `sekai-api` OpenAPI spec is available at
  <https://api.sekai.best/spec>.
- Regenerate `@platform/sekai-api-sdk` from the repository root with:

  ```bash
  pnpm --filter @platform/sekai-api-sdk generate:sdk -- --input https://api.sekai.best/spec --output ./src
  ```

- The generated client has no built-in base URL. Before calling endpoints, callers must
  explicitly configure the exported default client with
  `client.setConfig({ baseUrl: "https://api.sekai.best" })`, or use
  `createClient({ baseUrl: "https://api.sekai.best" })` and pass that client through an
  endpoint's `client` option.
- Generated endpoint URLs are OpenAPI absolute-path references (for example,
  `/event/live`).

## Event-ranking snapshot timestamp contract

`sekai-api`'s event ranking and chapter ranking list/graph operations accept
`timestamp` as an exact `date-time` snapshot filter, not a range query. Obtain a
round-trippable value from the corresponding `/time` endpoint; chapter ranking
calls must use the time endpoint with the same `charaId`. Source:
`sekai-api/app/controllers/event-ranking/rankings.js` and
`sekai-api/app/controllers/event-ranking/chapter-rankings.js`.

Use a root base URL such as `https://api.sekai.best`; generated operations
already prepend `/event/...`. Normalize a legacy trailing `/api` in consumer
configuration rather than sending requests to `/api/event/...`.

The generated serializer currently emits the OpenAPI `sort` object as
`timestamp=desc` instead of the server's required `sort[timestamp]=desc`. For the
latest historical snapshot lookup, provide a request-local `querySerializer`
that emits `limit=1&sort%5Btimestamp%5D=desc&region=...`; otherwise sekai-api
returns HTTP 500 even when the base URL is correct. Source:
`apps/tools-site/src/lib/server/event-tracker.ts`.

Cross-repo SDK integration workflows live in the workspace
`docs/cross-repository/sdk-integration.md`.
