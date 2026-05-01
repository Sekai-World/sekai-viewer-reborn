# Multi-Site Platform Monorepo

Monorepo for the Sekai viewer platform and related sites.

## Stack

- pnpm workspace
- Turborepo
- TypeScript
- SvelteKit 2
- Tailwind CSS 4

## Monorepo Structure

```text
apps/
  content-site/
  tools-site/
  media-lab-site/
  account-site/
packages/
  sekai-api-sdk/
  sekai-master-api-sdk/
  auth-client/
  ui-shell/
  ui-tokens/
deploy/
  k8s/
    content-site/
    tools-site/
    media-lab-site/
    account-site/
    ingress-examples/
```

## Apps

Apps in this workspace:

- `apps/content-site`
- `apps/tools-site`
- `apps/media-lab-site`
- `apps/account-site`

## Shared Packages

- `@platform/sekai-api-sdk`: sekai-api OpenAPI SDK generator scaffold
- `@platform/sekai-master-api-sdk`: sekai-master-api OpenAPI SDK generator and client package
- `@platform/auth-client`: Keycloak/OIDC helper URL builders
- `@platform/ui-shell`: shared Svelte shell and region-switcher components
- `@platform/ui-tokens`: framework-agnostic design tokens (JSON + TS export)

## Prerequisites

- Node.js 24+
- pnpm 11+

## Local Development

Install dependencies:

```bash
pnpm install
```

Run all apps in parallel via Turborepo:

```bash
pnpm dev
```

Typical local URLs:

- content-site: `http://localhost:4101`
- tools-site: `http://localhost:4102`
- media-lab-site: `http://localhost:4103`
- account-site: `http://localhost:4104`

Run one app only:

```bash
pnpm --filter @apps/content-site dev
```

`content-site` currently depends on these environment variables:

- `SEKAI_MASTER_API_BASE_URL`
- `SEKAI_API_BASE_URL`
- `PUBLIC_REMOTE_ASSET_BASE_URL`
- `PUBLIC_SEKAI_I18N_BASE_URL` (defaults to `https://sekai-world.github.io/sekai-i18n-reborn`)

## Build, Check, Lint, Format

Build everything:

```bash
pnpm build
```

Type/lint checks:

```bash
pnpm check
pnpm lint
```

Format:

```bash
pnpm format
pnpm format:check
```

## Release And Changelog

This repository now uses Changesets for workspace versioning and changelog generation.

Create a changeset for a user-facing change:

```bash
pnpm changeset
```

Check pending release state:

```bash
pnpm changeset:status
```

Generate version bumps and `CHANGELOG.md` updates locally:

```bash
pnpm release:version
```

Create Git tags after the version commit is ready:

```bash
pnpm release:tag
```

Run both steps together:

```bash
pnpm release
```

Notes:

- Pull requests that change `apps/*` or `packages/*` are checked by `.github/workflows/changeset.yml` and must include a changeset file, unless they are the auto-generated release PR.
- `.github/workflows/ci.yml` runs `pnpm lint`, `pnpm check`, and `pnpm build` on pushes to `main` and on pull requests.
- The GitHub Actions workflow at `.github/workflows/release.yml` opens or updates a release PR whenever changesets land on `main`.
- After the release PR is merged, `.github/workflows/release.yml` creates any missing workspace tags for the changed package versions and then creates matching GitHub releases.
- If you need to rerun just the GitHub Release publish step locally or in CI, use `pnpm release:github`.
- `pnpm release:publish` is an alias of `pnpm release:github`.
- All workspaces in this repo are private, so Changesets is configured to version and tag private packages too.
- Changeset entries should be committed as markdown files under `.changeset/`.
- If a code change should not produce a user-facing release note, use `pnpm changeset --empty`.

## Docker (Per App)

Each app has its own Dockerfile for independent image builds:

- `apps/content-site/Dockerfile`
- `apps/tools-site/Dockerfile`
- `apps/media-lab-site/Dockerfile`
- `apps/account-site/Dockerfile`

Build one image (example: content-site):

```bash
docker build -f apps/content-site/Dockerfile -t your-org/content-site:latest .
```

Run locally:

```bash
docker run --rm -p 3000:3000 your-org/content-site:latest
```

Repeat with the corresponding Dockerfile and image name for the other apps.

## Deployment Templates (Kubernetes)

Per-app manifests are under:

- `deploy/k8s/content-site`
- `deploy/k8s/tools-site`
- `deploy/k8s/media-lab-site`
- `deploy/k8s/account-site`

Each app folder includes:

- `deployment.yaml`
- `service.yaml`
- `ingress.yaml`

Ingress examples:

- shared ingress: `deploy/k8s/ingress-examples/shared-gateway-ingress.yaml`
- independent pattern notes: `deploy/k8s/ingress-examples/independent-ingress-pattern.md`

Example independent deployment for one app:

```bash
kubectl create namespace content-site
kubectl apply -f deploy/k8s/content-site/
```

Repeat per app namespace for independent rollouts.
