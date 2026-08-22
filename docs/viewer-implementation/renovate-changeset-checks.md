# Renovate and Changeset Checks

In `sekai-viewer-reborn`, dependency PRs created by Renovate do not require Changesets.

The Changeset workflow must identify Renovate from the pull request author:

```yaml
github.event.pull_request.user.login != 'renovate[bot]'
```

Do not use `github.actor` for this decision. The actor represents the account that triggered the current workflow run and can change when a maintainer updates or rebases a Renovate branch. The historical value `app/renovate` also does not match the actual Renovate PR author login.

Source: `sekai-viewer-reborn/.github/workflows/changeset.yml`.

## pnpm Security Overrides

With the repository's pnpm 11.13.0 toolchain, place workspace-wide dependency
security overrides under `overrides` in `pnpm-workspace.yaml`. The legacy
`pnpm.overrides` field in the root `package.json` is ignored by pnpm 11.

Use parent-child selectors when different compatible major versions are needed
for separate consumers (for example, `@changesets/parse>js-yaml` and
`@hey-api/json-schema-ref-parser>js-yaml`). Regenerate `pnpm-lock.yaml` with
`pnpm install --lockfile-only`, then verify with a frozen install and
`pnpm audit --json`:

```bash
pnpm install --lockfile-only
pnpm install --frozen-lockfile
pnpm audit --json
```

Source: `sekai-viewer-reborn/pnpm-workspace.yaml` and the Dependabot remediation
validated on 2026-07-25.

## Changesets YAML Compatibility

`@changesets/cli` reaches `read-yaml-file` through `@manypkg/get-packages`.
Two distinct override groups keep this dependency tree healthy:

1. **Package override for the legacy loader**: scope `read-yaml-file@1` to
   `^2.1.0`. Do not force it onto a `js-yaml` release without `safeLoad`.
2. **Dependency overrides for direct `js-yaml` consumers** such as
   `@changesets/parse>js-yaml` and
   `@hey-api/json-schema-ref-parser>js-yaml`: bound them below major 5 (for
   example, `>=4.2.0 <5.0.0`). An unbounded `>=4.2.0` range can resolve
   js-yaml 5 and break legacy `safeLoad` callers.

After changing these overrides, run:

```bash
pnpm install --lockfile-only
pnpm install --frozen-lockfile
pnpm audit --json
pnpm why read-yaml-file
pnpm why js-yaml
pnpm changeset status
```

Source: `sekai-viewer-reborn/pnpm-workspace.yaml`; verified 2026-08-08.
