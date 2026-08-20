# Contributing

Thanks for contributing to the Sekai viewer platform monorepo. Please keep
changes focused on the relevant app or shared package and preserve the
boundaries between independently deployable sites.

## Getting started

Use Node.js 24 and pnpm 11.13.0.

```bash
pnpm install
```

Read the repository `AGENTS.md` and `docs/instructions/README.md`, then the
applicable topic guidance, before making changes. UI changes must follow
`DESIGN.md` first; consult `docs/content-site-ui-conventions.md` for
content-site-specific implementation details.

## Checks

Before opening a pull request, run the smallest relevant checks first. Use
targeted pnpm workspace filters for app-specific changes, then broaden to the
following repository-wide checks when appropriate:

```bash
pnpm format:check
pnpm lint
pnpm check
pnpm i18n:check
pnpm build
```

## Visual regression workflow

PR CI runs the visual regression job when the change set includes Svelte or
stylesheet files. It uses Linux Chromium and never updates or commits snapshots
automatically. Non-visual changes skip that job.
When a visual test fails, download the `visual-regression-*` artifact from the
workflow run; it contains `test-results/` and `playwright-report/`, including
the expected, actual, and diff images when Playwright produces them.

Run the same test locally with `pnpm test:visual`. Approved baselines target
Ubuntu Chromium, so generate candidate snapshots with `pnpm test:visual:update`
only in that environment. On other systems, manually dispatch **Visual baseline
candidate** from the repository's default branch with the open PR number and
`update_snapshots` explicitly enabled. The workflow resolves that PR's head SHA
through the read-only GitHub API, checks out that exact SHA, and uploads an
artifact named with the PR number and SHA; it has no permission to push or
commit. Download and review the candidate PNGs, then copy approved snapshots
into the branch and commit them as part of the pull request. Do not directly
overwrite baselines from CI. Every visual PR should list its viewport/state
coverage and confirm review of the expected/actual/diff artifact; non-visual
PRs should mark the checklist as not applicable.

## Changes and commits

- Changes under `apps/` or `packages/` require a Changeset. Prefer updating an
  existing unpublished Changeset for the same workspace; create a new one only
  when no suitable Changeset exists. Use `pnpm changeset` for user-facing
  changes, or `pnpm changeset --empty` when a change is not user-facing.
- Use Conventional Commits for commit messages.
- Do not hand-edit generated build output or generated SDK artifacts.

## Pull requests

Keep each pull request scoped to one coherent change. Describe the scope and
validation performed, and include the required Changeset when the pull request
changes an app or package.
