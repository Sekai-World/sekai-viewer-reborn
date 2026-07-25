# Contributing

Thanks for contributing to the Sekai viewer platform monorepo. Please keep
changes focused on the relevant app or shared package and preserve the
boundaries between independently deployable sites.

## Getting started

Use Node.js 24+ and pnpm 11+.

```bash
pnpm install
```

Read the repository `AGENTS.md` and the applicable guidance under
`.github/instructions/` before making changes.

## Checks

Before opening a pull request, run the relevant checks, preferably all of the
following from the repository root:

```bash
pnpm format:check
pnpm lint
pnpm check
pnpm i18n:check
pnpm build
```

## Changes and commits

- Changes under `apps/` or `packages/` require a Changeset. Use `pnpm changeset`
  for user-facing changes, or `pnpm changeset --empty` when a change is not
  user-facing.
- Use Conventional Commits for commit messages.
- Do not hand-edit generated build output or generated SDK artifacts.

## Pull requests

Keep each pull request scoped to one coherent change. Describe the scope and
validation performed, and include the required Changeset when the pull request
changes an app or package.
