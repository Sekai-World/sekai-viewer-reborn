# Multi-Site Platform Monorepo

> **Standalone project notice:** This is a brand new greenfield monorepo scaffold created at the workspace root. It is independent from any prior project structure.

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
  sekai-master-api-sdk/
  auth-client/
  i18n-dicts/
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

Each app includes a SvelteKit 2 starter page and Tailwind CSS 4 integration:

- `apps/content-site`
- `apps/tools-site`
- `apps/media-lab-site`
- `apps/account-site`

## Shared Packages

- `@platform/sekai-master-api-sdk`: sekai-master-api OpenAPI SDK generator and client package
- `@platform/auth-client`: Keycloak/OIDC helper URL builders
- `@platform/i18n-dicts`: locale dictionary starter
- `@platform/ui-tokens`: framework-agnostic design tokens (JSON + TS export)

## Prerequisites

- Node.js 24+
- pnpm 10+

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
