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
  - `i18n-runtime` (`@platform/i18n-runtime`)
  - `sekai-api-sdk` (`@platform/sekai-api-sdk`)
  - `sekai-master-api-sdk` (`@platform/sekai-master-api-sdk`)
  - `ui-shell` (`@platform/ui-shell`)
  - `ui-tokens` (`@platform/ui-tokens`)
- Kubernetes manifests live in `deploy/k8s/*`.

## Ground Rules

- Keep app boundaries explicit; do not couple app internals across `apps/*`.
- Prefer shared logic in `packages/*` when reused by multiple apps.
- Keep changes minimal and scoped to the request.
- All coding agents and non-GitHub Copilot tools used in this workspace must also consult the applicable guidance under `.github/instructions/` and `.github/prompts/` before making changes.
- Treat this file together with `.github/copilot-instructions.md` and the applicable files in `.github/instructions/` and `.github/prompts/` as the authoritative repository guidance.
- Commit messages must follow the Conventional Commits specification.
- Changes under `apps/` or `packages/` require Changeset coverage before merge.
- Prefer updating an existing unpublished Changeset that already covers the same workspace instead of creating a new one for every commit.
- Create a new Changeset only when no suitable existing one covers the affected workspace; use `pnpm changeset --empty` when the change is not user-facing.
- Preserve existing naming conventions:
  - apps: `@apps/*`
  - shared packages: `@platform/*`
- Use ESM and strict TypeScript patterns already present in repo.
- Assume the repo may already contain generated `dist/` output and `.turbo/` artifacts; do not hand-edit generated build output unless explicitly requested.
- Match the CI/runtime toolchain already used in the repo: Node.js 24 and `pnpm@11.8.0`.

## Root Commands

From repo root:

```bash
pnpm install
pnpm dev
pnpm build
pnpm check
pnpm lint
pnpm i18n:check
pnpm changeset
pnpm changeset:status
pnpm release:version
pnpm release:tag
pnpm release:github
pnpm release:publish
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
- `pnpm release` only runs `release:version` and `release:tag`; publishing GitHub releases is handled by `pnpm release:github` / `pnpm release:publish` and `.github/workflows/release.yml`.
- CI validation is defined in `.github/workflows/ci.yml`.
- Pull requests that modify `apps/` or `packages/` are checked by `.github/workflows/changeset.yml` for a Changeset file.

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
- Prefer Iconify icons via `@iconify/svelte` over inline SVG when a suitable icon exists.
- App-level CSS lives in `src/app.css` and uses:

```css
@import "tailwindcss";
@plugin "daisyui";
```

- Global CSS is imported from `src/routes/+layout.svelte`.
- App Dockerfiles are located at `apps/*/Dockerfile`.
- Shared Svelte UI lives in `packages/ui-shell/src`.
- If you add Tailwind utility classes inside shared Svelte components, make sure the consuming app scans that source. `content-site` already does this via `@source "../../../packages/ui-shell/src";` in `apps/content-site/src/app.css`.
- When overriding daisyUI component defaults globally, prefer `@utility` in app CSS over fighting `.card` / `.btn` / `.badge` defaults with business classes.
- For one-off visual differences, prefer utility classes directly in Svelte markup over new global CSS.
- Avoid broad transition rules like `:root *`; keep theme transition fallbacks narrow so local hover motion is not diluted or overridden.
- Avoid unnecessary expensive CSS effects that can slow rendering, such as heavy blur, large shadows, excessive filters, or broad animations.
- For `content-site` card/shared UI conventions, read `docs/content-site-ui-conventions.md` before introducing new patterns.

## Shared Package Notes

- `@platform/auth-client`: shared auth/OIDC helpers.
- `@platform/i18n-runtime`: shared remote dictionary loading, caching, and `svelte-i18n` runtime helpers.
- `@platform/sekai-api-sdk`: generated API SDK plus generator script for `sekai-api`.
- `@platform/sekai-master-api-sdk`: generated API SDK plus generator script.
- `@platform/ui-shell`: shared Svelte shell components exported directly from `src`.
- `@platform/ui-tokens`: shared design tokens exposed as JSON and TypeScript.

When changing shared packages:

- Check whether the package is consumed by multiple apps before introducing app-specific behavior.
- Prefer updating package exports or source files over editing emitted `dist/` output.

## `content-site` Region / Locale Conventions

- `content-site` currently persists the UI locale preference only.
- Locale cookie names and defaults are defined in `apps/content-site/src/lib/region.ts`.
- Normalize and read locale preference through `apps/content-site/src/routes/+layout.server.ts`; do not duplicate locale cookie parsing in page-level loaders.
- The home page loader (`apps/content-site/src/routes/+page.server.ts`) fetches current event cards for all supported regions.
- The card list loader lives at `apps/content-site/src/routes/cards/[region]/+page.server.ts`.
- The music list loader lives at `apps/content-site/src/routes/musics/[region]/+page.server.ts`.
- The event detail loader lives at `apps/content-site/src/routes/event/[region]/[id]/+page.server.ts`.
- The event list loader lives at `apps/content-site/src/routes/events/[region]/+page.server.ts`.
- Inside `content-site`, prefer path-param routes:
  - card list: `/cards/:region`
  - music list: `/musics/:region`
  - event detail: `/event/:region/:id`
  - event list: `/events/:region`
- Keep old query/list routes only as redirects when backward compatibility is needed.
- Theme preference is handled separately on the client in `apps/content-site/src/routes/+layout.svelte`.

## `content-site` UI / Component Conventions

- Shared card frame/header/nav patterns should be extracted before repeating complex layout markup across pages.
- Current shared `content-site` UI primitives include:
  - `apps/content-site/src/lib/components/EventCardFrame.svelte`
  - `apps/content-site/src/lib/components/CurrentEventCard.svelte`
  - `apps/content-site/src/lib/components/CardListCard.svelte`
  - `apps/content-site/src/lib/components/EventListCard.svelte`
  - `apps/content-site/src/lib/components/MusicListCard.svelte`
  - `apps/content-site/src/lib/components/EventAssetImage.svelte`
  - `apps/content-site/src/lib/components/PageHeader.svelte`
  - `apps/content-site/src/lib/components/RegionBadgeSwitch.svelte`
- Shared non-component style constants should live outside `src/lib/components`, for example under `apps/content-site/src/lib/styles`.
- Sidebar structure for `content-site` is assembled in `apps/content-site/src/routes/+layout.svelte` and rendered by `packages/ui-shell/src/viewer-shell.svelte`; keep sidebar labels localized through the CDN dictionaries loaded by `apps/content-site/src/lib/i18n.ts`.
- Unit labels should come from `apps/content-site/src/lib/server/unit-profiles.ts`, which reads `/unitProfiles/{region}/list` and validates its local cache against `/versions/{region}`. Keep unit-code/tag mappings in `apps/content-site/src/lib/unit-profile.ts`.
- List card images that should not fetch before entering the viewport should use `EventAssetImage` with `loadMode="visible"` or the existing visibility-gated pattern in `CardListCard.svelte`.

## `content-site` I18n Conventions

- Keep `content-site` user-facing strings in the external `sekai-i18n-reborn` dictionaries.
- `apps/content-site/src/lib/i18n.ts` configures `@platform/i18n-runtime` to load scoped namespace files from `PUBLIC_SEKAI_I18N_BASE_URL`.
- New `content-site` source strings must be added to the matching `packages/i18n-source/content-site/*.json` namespace; use `common.json` only for labels shared across multiple scopes and `server.json` for server-only messages.
- `pnpm i18n:check` verifies referenced keys are present in the source files.
- `.github/workflows/i18n-sync.yml` syncs the English source files to `Sekai-World/sekai-i18n-reborn` and opens a PR for Weblate ingestion.
- Reuse `createI18nTranslator`, `setI18nLocale`, `tCommon`, and `getServerI18nText` instead of adding local dictionary files.
- Avoid introducing new hardcoded user-facing strings directly in `apps/content-site` when they should be localized.
- Locale and region metadata live in `apps/content-site/src/lib/i18n-config.ts` and `apps/content-site/src/lib/regions.ts`.

## `content-site` Environment Variables

- Server-side master API requests require `SEKAI_MASTER_API_BASE_URL`.
- In development, `SEKAI_MASTER_API_BASE_URL` must use the local API URL defined for the dev environment (for example `apps/content-site/.env.development`); do not try to access an online `master-api` endpoint while developing.
- Server-side sekai-api requests require `SEKAI_API_BASE_URL`.
- Public asset URL helpers require `PUBLIC_REMOTE_ASSET_BASE_URL`.
- Client/server i18n loading uses `PUBLIC_SEKAI_I18N_BASE_URL`; the default is `https://sekai-world.github.io/sekai-i18n-reborn`.

## Shared Package: `sekai-master-api-sdk`

Location: `packages/sekai-master-api-sdk`

Purpose:

- Generated TypeScript SDK for `sekai-master-api` from OpenAPI.

### When to regenerate

After any change to sekai-master-api that affects the API contract (routes, handlers,
response types, request params), the SDK must be regenerated. The full cross-repo
workflow is documented in `sekai-master-api/AGENTS.md` (Cross-Repository Integration).

### Generation command

```bash
pnpm --filter @platform/sekai-master-api-sdk generate:sdk -- --input <openapi-file-path-or-url> --output <output-dir>
```

Local default OpenAPI URL:

```bash
http://localhost:18080/docs/openapi.json
```

Mise task for local refresh:

```bash
mise run update-sekai-master-api-sdk-local
```

### Workflow notes

1. After changing sekai-master-api, run `mise run swagger` there to regenerate the spec.
2. Restart the sekai-master-api dev server with `mise run dev` and wait for it to be ready.
3. Then regenerate the SDK here with `mise run update-sekai-master-api-sdk-local`.
4. Validate: `pnpm --filter @platform/sekai-master-api-sdk check`.

The SDK generator overwrites generated artifacts (`src/sdk.gen.ts`, `src/types.gen.ts`,
`src/index.ts`). Always verify the generated output matches expectations before committing.

### Package validation

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
