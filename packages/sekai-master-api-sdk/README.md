# @platform/sekai-master-api-sdk

Type-safe SDK for `sekai-master-api`, generated from an OpenAPI document via `@hey-api/openapi-ts`.

## What this package provides

- Generated API functions (for example `getHealth`, `getCardsByRegionList`, `postAdminLogin`)
- Generated request/response types
- A script to regenerate SDK code from an OpenAPI JSON/YAML file

## Generate SDK

From repository root:

```bash
pnpm --filter @platform/sekai-master-api-sdk generate:sdk -- --input <openapi-file-path-or-url> --output <output-dir>
```

Examples:

```bash
pnpm --filter @platform/sekai-master-api-sdk generate:sdk -- --input F:\sekai-master-api\docs\swagger.json
pnpm --filter @platform/sekai-master-api-sdk generate:sdk -- --input F:\sekai-master-api\docs\swagger.json --output F:\sekai-viewer-reborn\packages\sekai-master-api-sdk\src
```

Notes:

- Default output is `./src`
- Generating into `src` may overwrite previously generated SDK files

## Default base URL behavior

- If `SEKAI_MASTER_API_BASE_URL` is set, SDK requests use that value.
- Otherwise, if `NODE_ENV=test`, SDK defaults to `https://master-api-test.sekai.best/api/v1`.
- Otherwise, if `NODE_ENV=production`, SDK defaults to `https://master-api.sekai.best/api/v1`.
- Otherwise (development/local browser host on `localhost`/`127.0.0.1`/`[::1]`), SDK defaults to `http://localhost:8080/api/v1`.

## Usage

### Basic call

```ts
import { getHealth } from '@platform/sekai-master-api-sdk';

const health = await getHealth();
```

### Path + query parameters

```ts
import { getCardsByRegionList } from '@platform/sekai-master-api-sdk';

const cards = await getCardsByRegionList({
  baseUrl: 'http://localhost:8080/api/v1',
  path: { region: 'jp' },
  query: { page: 1, page_size: 20 }
});
```

### Request body

```ts
import { postAdminLogin } from '@platform/sekai-master-api-sdk';

const login = await postAdminLogin({
  baseUrl: 'http://localhost:8080/api/v1',
  body: {
    username: 'admin',
    password: 'your-password'
  }
});
```

### Authenticated endpoint

```ts
import { getAdminProfile } from '@platform/sekai-master-api-sdk';

const profile = await getAdminProfile({
  baseUrl: 'http://localhost:8080/api/v1',
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

## Type imports

```ts
import type {
  GetCardsByRegionListData,
  GetCardsByRegionListResponse,
  PostAdminLoginData,
  PostAdminLoginResponse
} from '@platform/sekai-master-api-sdk';
```

## Build and checks

```bash
pnpm --filter @platform/sekai-master-api-sdk lint
pnpm --filter @platform/sekai-master-api-sdk build
pnpm --filter @platform/sekai-master-api-sdk check
```
