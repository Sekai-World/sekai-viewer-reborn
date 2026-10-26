# SonarCloud analysis

- SonarCloud does not natively analyze `.svelte` files. Keep Svelte diagnostics in `pnpm check` and `pnpm lint`; configure the Sonar scan for supported JS/TS/CSS files only.
- App `tsconfig.json` files extend generated `.svelte-kit/tsconfig.json`. In CI, run `svelte-kit sync` for every app before Sonar analysis, then set `sonar.typescript.tsconfigPaths` to the explicit app and package configs. This avoids Sonar's monorepo-wide TSConfig discovery while preserving SvelteKit path aliases and generated route types.
- Set `sonar.sourceEncoding=UTF-8` explicitly. Do not commit `.svelte-kit/` output.
- Implementation: `sonar-project.properties` and `.github/workflows/sonarcloud.yml`.
- Keep repository-wide validation in the root `verify:ci` script; the SonarCloud workflow should retain dependency setup, esbuild rebuild, and SvelteKit sync, then run the scan without duplicating the check and lint steps.

## Coverage evidence

- Test discovery and coverage collection are separate. In particular,
  `apps/content-site/vitest.config.ts` uses a `coverage.include` allowlist: a test
  can pass while its source file is absent from LCOV and appears uncovered in
  Sonar. Keep new source files such as `src/hooks.server.ts` in the collection
  scope; do not exclude them from Sonar to make the gate pass.
- Use the app's `test:coverage` command so `scripts/lcov/normalize-lcov.mjs`
  produces repository-relative paths. Confirm the report contains the source
  record (for example `SF:apps/content-site/src/hooks.server.ts`) and nonzero
  execution counts, not merely that tests passed.
- Compare the quality gate for the exact pull request and head commit. The
  `main` branch has a different new-code baseline; a main-branch gate result is
  not evidence that a failed PR gate has been repaired. Verify the repair PR's
  own analysis without changing thresholds or accepting issues to hide them.

测试通过不等于覆盖率已被收集。新增源码须核对 LCOV 记录和执行次数；修复验收
以修复 PR 当前提交的 Sonar 分析为准，不能用主线不同基线的结果替代。
