# Single-app Docker builds

- The repository root `tsconfig.json` is an aggregate TypeScript solution that references every SvelteKit app and each app's generated `.svelte-kit/tsconfig.json`.
- Each app Dockerfile uses the repository root as its build context but builds only one app. After `COPY . .`, remove the aggregate `tsconfig.json` from the build stage, run `svelte-kit sync` only for the target app, and then run that app's build. Otherwise a clean build can fail while resolving another app's missing generated tsconfig.
- Keep the aggregate `tsconfig.json` available for local and CI workspace-wide checks; this is a container-only workaround for single-app image builds.
- The pattern is implemented in `apps/account-site/Dockerfile`, `apps/content-site/Dockerfile`, `apps/media-lab-site/Dockerfile`, and `apps/tools-site/Dockerfile`.
- `pnpm verify:adapter-node-build` rebuilds all four apps and checks for empty adapter-node server chunks, generated runtime configuration, importable request handlers and route nodes, and content-site client retention for Howler and EventDebugDialog.
- Adapter-node 6 no longer consumes the runtime `ORIGIN` variable. With `paths.origin` unset, it derives request origins from `Host` and assumes HTTPS unless a protocol header is configured. This repository does not pin `paths.origin` because the canonical public origins and trusted reverse-proxy configuration have not been confirmed; verify deployment settings before adding either a fixed origin or forwarded-header configuration.
