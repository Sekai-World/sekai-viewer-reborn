# AGENTS.md

Guidance for coding agents working in this workspace.

## Workspace Overview

- Monorepo with `pnpm` workspaces and Turborepo.
- Root package name: `multisite-platform`.
- Deployable SvelteKit apps live in `apps/*`:
  - `content-site` (`@apps/content-site`)
  - `tools-site` (`@apps/tools-site`)
  - `media-lab-site` (`@apps/media-lab-site`)
  - `account-site` (`@apps/account-site`)
- Shared packages live in `packages/*`:
  - `auth-client` (`@platform/auth-client`)
  - `i18n-dicts` (`@platform/i18n-dicts`)
  - `sekai-master-api-sdk` (`@platform/sekai-master-api-sdk`)
  - `ui-shell` (`@platform/ui-shell`)
  - `ui-tokens` (`@platform/ui-tokens`)
- Kubernetes manifests live in `deploy/k8s/*`.

## Ground Rules

- Keep app boundaries explicit; do not couple app internals across `apps/*`.
- Prefer shared logic in `packages/*` when reused by multiple apps.
- Keep changes minimal and scoped to the request.
- Preserve existing naming conventions:
  - apps: `@apps/*`
  - shared packages: `@platform/*`
- Use ESM and strict TypeScript patterns already present in repo.
- Assume the repo may already contain generated `dist/` output and `.turbo/` artifacts; do not hand-edit generated build output unless explicitly requested.

## Root Commands

From repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm check
pnpm lint
pnpm changeset
pnpm changeset:status
pnpm release:version
pnpm release:tag
pnpm release
pnpm format
pnpm format:check
```

Targeted commands:

```bash
pnpm --filter <workspace-name> dev
pnpm --filter <workspace-name> build
pnpm --filter <workspace-name> check
pnpm --filter <workspace-name> lint
```

Notes:

- `turbo dev --parallel` is the root `pnpm dev` command.
- Prefer targeted workspace commands for focused changes.
- `@platform/ui-shell` currently does not define standalone `build` / `check` / `lint` scripts; validate consumers instead when editing that package.
- Workspace versioning and changelog generation use Changesets.
- Release automation is defined in `.github/workflows/release.yml`.

## Local Dev Ports

App dev servers use fixed ports:

- `@apps/content-site`: `4101`
- `@apps/tools-site`: `4102`
- `@apps/media-lab-site`: `4103`
- `@apps/account-site`: `4104`

Preview ports:

- `@apps/content-site`: `5101`
- `@apps/tools-site`: `5102`
- `@apps/media-lab-site`: `5103`
- `@apps/account-site`: `5104`

## SvelteKit / Frontend Conventions

- Apps use SvelteKit 2, Svelte 5, Tailwind CSS 4, and `daisyui`.
- App-level CSS lives in `src/app.css` and uses:

```css
@import "tailwindcss";
@plugin "daisyui";
```

- Global CSS is imported from `src/routes/+layout.svelte`.
- App Dockerfiles are located at `apps/*/Dockerfile`.
- Shared Svelte UI lives in `packages/ui-shell/src`.
- If you add Tailwind utility classes inside shared Svelte components, make sure the consuming app scans that source. `content-site` already does this via `@source "../../../packages/ui-shell/src";` in `apps/content-site/src/app.css`.

## Shared Package Notes

- `@platform/auth-client`: shared auth/OIDC helpers.
- `@platform/i18n-dicts`: shared region, locale, and site dictionary data.
- `@platform/sekai-master-api-sdk`: generated API SDK plus generator script.
- `@platform/ui-shell`: shared Svelte shell components exported directly from `src`.
- `@platform/ui-tokens`: shared design tokens exposed as JSON and TypeScript.

When changing shared packages:

- Check whether the package is consumed by multiple apps before introducing app-specific behavior.
- Prefer updating package exports or source files over editing emitted `dist/` output.

## `content-site` Region / Locale Conventions

- `content-site` persists three preferences:
  - primary data region
  - secondary data region
  - UI locale
- Cookie names and default values are defined in `apps/content-site/src/lib/region.ts`.
- Normalize and read these preferences through `apps/content-site/src/routes/+layout.server.ts`; do not duplicate cookie parsing in page-level loaders.
- In deep content pages:
  - Use the primary region as the API `region` parameter for master data fetching.
  - Use the secondary region for region-specific text or translation presentation when applicable.
- Theme preference is handled separately on the client in `apps/content-site/src/routes/+layout.svelte`.

## `content-site` I18n Conventions

- Keep `content-site` user-facing strings centralized in `packages/i18n-dicts`.
- Current dictionaries live under:
  - `packages/i18n-dicts/src/content-site/locales/<locale>/common.ts`
  - `packages/i18n-dicts/src/content-site/locales/<locale>/server.ts`
- Dictionary entrypoints and helpers live in:
  - `packages/i18n-dicts/src/content-site/index.ts`
- Reuse existing helpers such as `getContentSiteCommonText` and `getContentSiteServerText` instead of reimplementing ad hoc lookup logic.
- Avoid introducing new hardcoded user-facing strings directly in `apps/content-site` when they should be localized.

## Shared Package: `sekai-master-api-sdk`

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

Package validation:

```bash
pnpm --filter @platform/sekai-master-api-sdk lint
pnpm --filter @platform/sekai-master-api-sdk build
pnpm --filter @platform/sekai-master-api-sdk check
```

## File Editing Guidance

- Do not manually edit generated SDK artifacts unless explicitly requested:
  - `*.gen.ts`
  - generated `src/client/*` files
  - generated `src/core/*` files
- Prefer changing generator inputs or scripts, then re-generate.
- Update README/docs when behavior or commands change.

## Docker / Container Notes

- Build context must be repo root when using app Dockerfiles.
- Current app Dockerfiles use multi-stage `node:24-alpine` builds.
- Each app image builds only its own workspace with `pnpm --filter @apps/<app-name> build`.
- Runtime containers execute `node build` and expose port `3000`.

Example:

```bash
docker build -f ./apps/content-site/Dockerfile -t content-site:local .
docker run --rm -p 3000:3000 content-site:local
```

## Deployment Layout

Per-app manifests:

- `deploy/k8s/content-site`
- `deploy/k8s/tools-site`
- `deploy/k8s/media-lab-site`
- `deploy/k8s/account-site`

Each app folder currently includes:

- `deployment.yaml`
- `service.yaml`
- `ingress.yaml`

Ingress examples:

- `deploy/k8s/ingress-examples/shared-gateway-ingress.yaml`
- `deploy/k8s/ingress-examples/independent-ingress-pattern.md`
