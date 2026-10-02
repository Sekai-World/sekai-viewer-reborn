# Single-app Docker builds

- The repository root `tsconfig.json` is an aggregate TypeScript solution that references every SvelteKit app and each app's generated `.svelte-kit/tsconfig.json`.
- Each app Dockerfile uses the repository root as its build context but builds only one app. After `COPY . .`, remove the aggregate `tsconfig.json` from the build stage, run `svelte-kit sync` only for the target app, and then run that app's build. Otherwise a clean build can fail while resolving another app's missing generated tsconfig.
- Keep the aggregate `tsconfig.json` available for local and CI workspace-wide checks; this is a container-only workaround for single-app image builds.
- The pattern is implemented in `apps/account-site/Dockerfile`, `apps/content-site/Dockerfile`, `apps/media-lab-site/Dockerfile`, and `apps/tools-site/Dockerfile`.
- The workspace patches `@sveltejs/adapter-node@5.5.7` to exclude the generated server `chunks/env.js` module from `manualChunks`, allowing Rollup to prune that empty artifact while preserving file-structure chunking for all other server modules. After building all four apps, run `pnpm verify:adapter-node-build` to assert that artifact is absent, import each built SSR entry, and verify that `env.js` still reads default unprefixed runtime variables.
