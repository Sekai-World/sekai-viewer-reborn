# @platform/sekai-api-sdk

Type-safe SDK for `sekai-api`, generated from the public OpenAPI document via `@hey-api/openapi-ts`.

## What this package provides

- A generation script aligned with `@platform/sekai-master-api-sdk`
- A stable package entry for generated API functions and types
- The same build, lint, and type-check flow used by the existing SDK package

## Generate SDK

From repository root:

```bash
pnpm --filter @platform/sekai-api-sdk generate:sdk -- --input https://api.sekai.best/spec --output ./src
```

Notes:

- Public spec: <https://api.sekai.best/spec>
- Default output is `./src`
- Generating into `src` may overwrite previously generated SDK files

## Base URL behavior

- The generated client has no built-in base URL, so requests use relative paths by default.
- Browser callers can use a same-origin proxy; server-side callers and direct public API
  consumers should configure an explicit `baseUrl`, such as `https://api.sekai.best`.
- The public API paths are generated exactly as specified (for example, `/event/live`);
  the client does not add an `/api/v1` prefix.

Configure the exported default client before calling an endpoint:

```ts
import { client, getEventRankingLive } from "@platform/sekai-api-sdk";

client.setConfig({ baseUrl: "https://api.sekai.best" });
const response = await getEventRankingLive();
```

For isolated configuration, use `createClient({ baseUrl: "https://api.sekai.best" })`
and pass the returned client through an endpoint's `client` option.

## Build and checks

```bash
pnpm --filter @platform/sekai-api-sdk lint
pnpm --filter @platform/sekai-api-sdk build
pnpm --filter @platform/sekai-api-sdk check
```
