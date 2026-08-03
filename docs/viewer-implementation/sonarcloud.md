# SonarCloud analysis

- SonarCloud does not natively analyze `.svelte` files. Keep Svelte diagnostics in `pnpm check` and `pnpm lint`; configure the Sonar scan for supported JS/TS/CSS files only.
- App `tsconfig.json` files extend generated `.svelte-kit/tsconfig.json`. In CI, run `svelte-kit sync` for every app before Sonar analysis, then set `sonar.typescript.tsconfigPaths` to the explicit app and package configs. This avoids Sonar's monorepo-wide TSConfig discovery while preserving SvelteKit path aliases and generated route types.
- Set `sonar.sourceEncoding=UTF-8` explicitly. Do not commit `.svelte-kit/` output.
- Implementation: `sonar-project.properties` and `.github/workflows/sonarcloud.yml`.
- Keep repository-wide validation in the root `verify:ci` script; the SonarCloud workflow should retain dependency setup, esbuild rebuild, and SvelteKit sync, then run the scan without duplicating the check and lint steps.
