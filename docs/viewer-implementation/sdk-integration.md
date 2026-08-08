# SDK integration

- The public `sekai-api` OpenAPI spec is available at
  <https://api.sekai.best/spec>.
- Regenerate `@platform/sekai-api-sdk` from the repository root with:

  ```bash
  pnpm --filter @platform/sekai-api-sdk generate:sdk -- --input https://api.sekai.best/spec --output ./src
  ```

- The generated client uses relative request paths by default. Configure
  `baseUrl: "https://api.sekai.best"` for direct public API requests; the
  generated paths do not include an `/api/v1` prefix.
