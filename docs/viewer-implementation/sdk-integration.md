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
