# @platform/sekai-api-sdk

Type-safe SDK scaffold for `sekai-api`, generated from an OpenAPI document via `@hey-api/openapi-ts`.

## What this package provides

- A generation script aligned with `@platform/sekai-master-api-sdk`
- A stable package entry for generated API functions and types
- The same build, lint, and type-check flow used by the existing SDK package

## Generate SDK

From repository root:

```bash
pnpm --filter @platform/sekai-api-sdk generate:sdk -- --input <openapi-file-path-or-url> --output <output-dir>
```

Examples:

```bash
pnpm --filter @platform/sekai-api-sdk generate:sdk -- --input F:\sekai-api\docs\swagger.json
pnpm --filter @platform/sekai-api-sdk generate:sdk -- --input F:\sekai-api\docs\swagger.json --output F:\sekai-viewer-reborn\packages\sekai-api-sdk\src
```

Notes:

- Default output is `./src`
- Generating into `src` may overwrite previously generated SDK files

## Default base URL behavior

- The generator normalizes the default client base URL to `/api/v1`.
- Server-side callers or non-proxied deployments should pass an explicit `baseUrl`.

## Current state

This package is intentionally scaffold-only until a `sekai-api` OpenAPI document is provided and generated into `src/`.

## Build and checks

```bash
pnpm --filter @platform/sekai-api-sdk lint
pnpm --filter @platform/sekai-api-sdk build
pnpm --filter @platform/sekai-api-sdk check
```
