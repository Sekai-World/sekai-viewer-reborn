# Changesets Workflow

This repository uses [Changesets](https://github.com/changesets/changesets) for workspace versioning and changelog generation.

## Common Commands

```bash
pnpm changeset
pnpm changeset:status
pnpm release:version
pnpm release:tag
pnpm release:github
pnpm release:publish
pnpm release
```

## Typical Flow

1. Run `pnpm changeset` after making a user-facing change.
2. Select the affected workspaces and choose the appropriate bump type.
3. Commit the generated markdown file in `.changeset/`.
4. Pull requests that touch `apps/*` or `packages/*` are expected to include a changeset file, unless they are the auto-generated release PR.
5. When changes land on `main`, the GitHub release workflow opens or updates a release PR.
6. Merging that PR applies version bumps, writes `CHANGELOG.md` files for the changed workspaces, creates missing git tags, and creates matching GitHub releases.

## Notes

- This monorepo uses private workspaces, so Changesets is configured to version and tag private packages as well.
- `pnpm release:version` updates package versions and changelog files locally.
- `pnpm release:tag` creates Git tags for the versioned packages after the version commit is ready.
- `pnpm release:github` is the explicit entrypoint for creating missing git tags and matching GitHub Releases after a release commit lands.
- `pnpm release:publish` is the CI-safe publish step. It only tags and creates releases for workspaces whose `package.json` version changed in the current release diff.
