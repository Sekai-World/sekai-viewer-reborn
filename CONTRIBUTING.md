# Contributing

Thanks for contributing to the Sekai viewer platform monorepo. Please keep
changes focused on the relevant app or shared package and preserve the
boundaries between independently deployable sites.

## Getting started

Use Node.js 24 and pnpm 11.13.0.

```bash
pnpm install
```

Read the repository `AGENTS.md` and the applicable guidance under
`.github/instructions/` before making changes.

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
