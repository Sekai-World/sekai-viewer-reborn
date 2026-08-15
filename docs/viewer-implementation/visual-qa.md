# Visual QA

Visual-regression snapshots must be approved or generated on ubuntu-24.04 Chromium through the manual **Visual baseline candidate** workflow, because macOS and CI rendering can differ. For an approved baseline update, run **Visual baseline candidate** for the PR head, inspect the generated artifact, and update committed snapshots only after approval.

## daisyUI 5 form migration

The daisyUI 5 migration found that `form-control`, `label-text`, and `input-bordered` are no longer valid. Use `fieldset` / `fieldset-legend` for grouped controls, a bare utility-styled `<label>` for a single input, and the default `input` border. Use Tailwind's `wrap-break-word` utility where UI text must wrap long tokens. Source: the daisyUI 5 compliance changes in `apps/content-site` and `packages/ui-shell`.
