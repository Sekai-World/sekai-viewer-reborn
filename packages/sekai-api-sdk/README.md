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

- The generated client has no built-in base URL. Callers must explicitly provide one with
  the exported default client's `setConfig({ baseUrl })` or with `createClient({ baseUrl })`.
- Generated endpoint URLs are OpenAPI absolute-path references (for example, `/event/live`),
  so configure a base URL such as `https://api.sekai.best` before making requests.

Configure the exported default client before calling an endpoint:

```ts
import { client, getEventRankingLive } from "@platform/sekai-api-sdk";

client.setConfig({ baseUrl: "https://api.sekai.best" });
const response = await getEventRankingLive();
```

For isolated configuration, create a client with an explicit base URL and pass it through an
endpoint's `client` option:

```ts
import { createClient, getEventRankingLive } from "@platform/sekai-api-sdk";

const client = createClient({ baseUrl: "https://api.sekai.best" });
const response = await getEventRankingLive({ client });
```

## Build and checks

```bash
pnpm --filter @platform/sekai-api-sdk lint
pnpm --filter @platform/sekai-api-sdk build
pnpm --filter @platform/sekai-api-sdk check
```
