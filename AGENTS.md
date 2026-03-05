# AGENTS.md

Guidance for coding agents working in this workspace.

## Workspace Overview

- Monorepo with `pnpm` workspaces + Turborepo.
- Deployable apps live in `apps/*`:
  - `content-site`
  - `tools-site`
  - `media-lab-site`
  - `account-site`
- Shared packages live in `packages/*`.
- Kubernetes manifests live in `deploy/k8s/*`.

## Ground Rules

- Keep app boundaries explicit; do not couple app internals across `apps/*`.
- Prefer shared logic in `packages/*` when reused by multiple apps.
- Keep changes minimal and scoped to the request.
- Preserve existing naming conventions:
  - apps: `@apps/*`
  - shared packages: `@platform/*`
- Use ESM and strict TypeScript patterns already present in repo.

## Build, Check, and Lint

From repo root:

```bash
pnpm install
pnpm build
pnpm check
pnpm lint
```

Targeted commands (preferred for focused changes):

```bash
pnpm --filter <workspace-name> build
pnpm --filter <workspace-name> check
pnpm --filter <workspace-name> lint
```

## SvelteKit App Conventions

- SvelteKit 2 + Tailwind 4.
- Global CSS is imported in `src/routes/+layout.svelte`.
- App-level CSS uses `@import "tailwindcss"` in `src/app.css`.
- Dockerfiles are per app under `apps/*/Dockerfile`.

## content-site Region/Locale Conventions

- `content-site` uses three persisted preferences:
  - primary data region
  - secondary data region
  - UI locale
- In deep content pages:
  - Use **primary region** as the API `region` parameter for master data fetching.
  - Use **secondary region** for region-specific text/translation presentation when applicable.
- Current preference helpers and defaults are defined in:
  - `apps/content-site/src/lib/region.ts`
- Read preferences from layout/server context rather than duplicating cookie parsing in each page:
  - `apps/content-site/src/routes/+layout.server.ts`
- Keep `content-site` i18n strings centralized in `packages/i18n-dicts`.
- For new text, prefer locale + namespace static dictionaries (e.g. `content-site/locales/<locale>/<ns>.ts`) so migration to Weblate is straightforward.
- Avoid introducing new hardcoded user-facing strings directly in `apps/content-site`.

## Docker / Container Notes

- Build context must be repo root when using app Dockerfiles.
- Example:

```bash
podman build -f ./apps/content-site/Dockerfile -t content-site:local .
```

- Current app Dockerfiles use multi-stage builds and run with `node build`.

## Shared Package: sekai-master-api-sdk

Location: `packages/sekai-master-api-sdk`

Purpose:
- Generated TypeScript SDK for `sekai-master-api` from OpenAPI.

Generation command:

```bash
pnpm --filter @platform/sekai-master-api-sdk generate:sdk -- --input <openapi-file-path-or-url> --output <output-dir>
```

Notes:
- `--input` is required.
- Default output is `./src`.
- Generating into `src` can overwrite generated SDK files.

Build/lint/check for this package:

```bash
pnpm --filter @platform/sekai-master-api-sdk lint
pnpm --filter @platform/sekai-master-api-sdk build
pnpm --filter @platform/sekai-master-api-sdk check
```

## File Editing Guidance

- Do not manually edit generated SDK artifacts unless explicitly requested:
  - `*.gen.ts`
  - generated `src/client/*` files
- Prefer changing generator inputs or scripts, then re-generate.
- Update README/docs when behavior or commands change.

## Deployment Layout

Per-app manifests:
- `deploy/k8s/content-site`
- `deploy/k8s/tools-site`
- `deploy/k8s/media-lab-site`
- `deploy/k8s/account-site`

Ingress examples:
- `deploy/k8s/ingress-examples/*`
