# SDK integration

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

- Server-side tools-site loaders should read `SEKAI_API_BASE_URL` through their
  local config helper and pass the normalized URL directly to SDK calls. API
  failures should be converted to typed safe states at the loader boundary.

## Ranking history integration

- The `sekai-api` 2.2.3 ranking `timestamp` contract is live. For a safe event
  history flow, call `/event/{id}/rankings/time?region=` first, then use each
  returned exact timestamp (deduplicated) when requesting `rankings/graph`.
- Although the OpenAPI spec describes `/rankings` data as an array, the live
  response is a paginated object containing `eventRankings`. Apps must
  defensively parse that response shape.
- Treat a `202` restore payload as rankings being unavailable, rather than as
  ranking data.
- In tools-site, proxy client-side ranking interactions through a server-local
  `+server.ts` endpoint. This keeps the SDK base URL server-only instead of
  exposing it as a public client configuration value.
