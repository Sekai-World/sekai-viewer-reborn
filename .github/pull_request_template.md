## Optional visual review

Visual checks are not automatic CI gates and apply only when a rendered UI
change or intentional baseline update is relevant.

- [ ] Not applicable: no rendered UI change or intentional baseline update.
- [ ] Rendered UI change: affected viewport(s) and state(s): <!-- e.g. 390px / loading, 1280px / fulfilled -->
- [ ] Rendered UI change: optionally ran `pnpm test:visual`.
- [ ] Intentional baseline update: manually ran **Visual baseline candidate** with this PR number and `update_snapshots` enabled, then reviewed the Linux Chromium candidate.
- [ ] Intentional baseline update: this pull request explains why the baseline changed.

## Summary

<!-- Describe the change and relevant validation. -->
