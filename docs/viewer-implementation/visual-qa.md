# Visual QA

Visual-regression snapshots must be approved or generated on ubuntu-24.04 Chromium through the manual **Visual baseline candidate** workflow, because macOS and CI rendering can differ. For an approved baseline update, run **Visual baseline candidate** for the PR head, inspect the generated artifact, and update committed snapshots only after approval.

## daisyUI 5 form migration

The daisyUI 5 migration found that `form-control`, `label-text`, and `input-bordered` are no longer valid. Use `fieldset` / `fieldset-legend` for grouped controls, a bare utility-styled `<label>` for a single input, and the default `input` border. Use Tailwind's `wrap-break-word` utility where UI text must wrap long tokens. Source: the daisyUI 5 compliance changes in `apps/content-site` and `packages/ui-shell`.

## Playwright CLI viewport sizing

- The local Playwright wrapper is available at `~/.agents/skills/playwright/scripts/playwright_cli.sh`.
- The installed `playwright-cli` does not accept `--viewport-size` on `open` or `screenshot`.
- To capture a specific viewport, open the page first, then run `resize <width> <height>`, then capture a screenshot:

```sh
"$HOME/.agents/skills/playwright/scripts/playwright_cli.sh" open http://127.0.0.1:4101/card/jp/109
"$HOME/.agents/skills/playwright/scripts/playwright_cli.sh" resize 375 900
"$HOME/.agents/skills/playwright/scripts/playwright_cli.sh" snapshot
"$HOME/.agents/skills/playwright/scripts/playwright_cli.sh" screenshot --full-page
```

- `resize 375 900` was confirmed to execute `page.setViewportSize({ width: 375, height: 900 })`.

## Screenshot analysis limitation

- The current `look_at` tool rejected local source and PNG file paths during this session, even when `file_path` was provided.
- Until that tool path is fixed, use Playwright `snapshot` for DOM/order checks and screenshot artifacts for manual review; use the visual QA image-diff script only when a reference screenshot exists.

## Clean-checkout visual test startup

- `playwright.config.ts` starts the content-site Vite server. Its `webServer.command` must first run `svelte-kit sync` for every SvelteKit app (`account-site`, `content-site`, `media-lab-site`, and `tools-site`). The root `tsconfig.json` references all of those projects, so syncing only `content-site` leaves generated `.svelte-kit/tsconfig.json` files unavailable in a clean checkout.
- The Vite invocation must use `vite dev --configLoader native --port 4105`. This bypasses the Rolldown config-loader regression whose CI signature is `Could not resolve 'node:module'` alongside `Tsconfig not found`.
- These prerequisites cover CI, the manual visual-baseline workflow, and local `pnpm test:visual`. Validate from a clean generated state by removing every app's `.svelte-kit` directory, then running the configured visual tests.
- Source: `playwright.config.ts`; confirmed in PR #160 visual-regression CI failures (2026-08-07).
