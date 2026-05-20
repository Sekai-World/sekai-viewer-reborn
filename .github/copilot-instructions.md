# Copilot Instructions for This Repository

## Big Picture

- This is a greenfield monorepo for 4 independently deployable SvelteKit sites plus shared TypeScript packages.
- Workspace layout is fixed: `apps/*` for deployable frontends, `packages/*` for shared libraries, `deploy/k8s/*` for per-app manifests.
- Keep app boundaries explicit: each site (`content-site`, `tools-site`, `media-lab-site`, `account-site`) should remain runnable and deployable on its own.
- Shared logic belongs in `packages/` when reused across apps (API, auth, tokens).

## Tooling and Build Graph

- Use pnpm workspaces (`pnpm-workspace.yaml`) and Turborepo (`turbo.json`) for all orchestration.
- Root scripts are the source of truth: `pnpm dev`, `pnpm build`, `pnpm check`, `pnpm lint`, `pnpm format`.
- Turbo tasks are dependency-aware (`build` depends on `^build`; `dev` is persistent and non-cached).
- TypeScript baseline is in `tsconfig.base.json` and uses strict mode + bundler resolution.

## App Patterns (SvelteKit 2 + Tailwind 4)

- Each app keeps global CSS import in `src/routes/+layout.svelte` and uses `@import "tailwindcss"` in `src/app.css`.
- App scripts follow the same pattern with distinct ports (dev: 4101-4104, preview: 5101-5104).
- Preserve `src/app.d.ts` SvelteKit structure; ESLint already allows empty interfaces for `.d.ts` in `eslint.config.mjs`.
- Use `@tailwindcss/vite` in `vite.config.ts`; do not add legacy Tailwind config unless required by a real feature.
- For dense list/toolbars (sorting/filtering/paging controls), prefer icon-first buttons over long text labels to reduce horizontal and vertical space usage; keep accessibility via `title` and `aria-label`.

## Shared Package Contracts

- `packages/sekai-master-api-sdk`: sekai-master-api OpenAPI SDK package (generated from an explicit OpenAPI input URL/path; local default is `http://localhost:18080/docs/openapi.json`).
- `packages/auth-client`: Keycloak/OIDC URL helpers (`buildLoginUrl`, `buildLogoutUrl`).
- `packages/i18n-runtime`: shared remote dictionary loader and `svelte-i18n` runtime wrapper.
- `content-site` loads UI dictionaries from the external `sekai-i18n-reborn` CDN through `svelte-i18n`.
- `packages/ui-tokens`: framework-agnostic tokens in JSON (`src/design-tokens.json`) exported through TypeScript.

## Deployment and Container Conventions

- Kubernetes manifests are per app under `deploy/k8s/<app>/` and assume container port `3000` behind service port `80`.
- Ingress supports both independent app ingress and shared gateway examples in `deploy/k8s/ingress-examples/`.
- Each app has its own Dockerfile (`apps/*/Dockerfile`) using `node:24-alpine` and workspace-aware build commands.

## Agent Workflow Expectations

- Prefer targeted workspace filtering for app-specific work, e.g. `pnpm --filter @apps/content-site dev`.
- After code changes, validate with the smallest relevant command first, then broaden (`check`/`lint`/`build`).
- Keep changes minimal and aligned with existing package naming (`@apps/*`, `@platform/*`) and ESM + strict TS style.
- There is currently no dedicated test suite; rely on `check`, `lint`, and `build` as the quality gates.
