# content-site update notices

`content-site` has two notices about updates. Both render in the same slot above
the page content in `apps/content-site/src/routes/+layout.svelte` and use the
same component, `apps/content-site/src/lib/components/SiteUpdateNotice.svelte`.
At most one shows at a time.

|                | Curated release notice                                                                                    | New-deployment prompt                                                                                              |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Tells the user | What changed in the version this tab runs                                                                 | The server has a newer build than this tab                                                                         |
| Source         | `siteUpdates` entry for `siteVersion` (`apps/content-site/package.json`)                                  | SvelteKit `updated` from `$app/state`, then the build name from `_app/version.json`                                |
| Identity       | Semantic version, such as `0.1.0`                                                                         | `kit.version.name` (the build timestamp)                                                                           |
| Appears        | After hydration, when onboarding has been seen and `content_site_seen_version` differs from `siteVersion` | After a newer build is detected and its name has been read, unless that name was dismissed                         |
| Disappears     | **Read** (opens `/updates`) or **Dismiss**: both store `content_site_seen_version`                        | **Reload** (only when the user asks), or **Dismiss**: stores the build name in `content_site_dismissed_deployment` |
| Code           | `apps/content-site/src/lib/onboarding.ts`, `apps/content-site/src/lib/site-updates.ts`                    | `apps/content-site/src/lib/deployment-update.svelte.ts`                                                            |

The curated entries and their copy follow the release checklist in `AGENTS.md`
("`content-site` Release Notes / Update Notices").

## How SvelteKit detects a deployment

These notes were checked against `@sveltejs/kit` 3.1.1
(`src/runtime/app/state/client.svelte.js` and `src/core/config/options.js`).

- `updated.check()` fetches `_app/version.json` with `cache-control: no-cache`.
  A network error or a non-OK response returns `false`. Once a check succeeds,
  `updated.current` stays `true` and polling stops. On the dev server the check
  always returns `false`, so the prompt cannot appear under `vite dev`.
- Checks run on a timer (`version.pollInterval`), when the window gains focus,
  when the tab becomes visible, and when a `__data.json`, form, or remote
  response carries a different `x-sveltekit-version` header. `content-site`
  sets the interval to 10 minutes in `apps/content-site/vite.config.ts`. The
  SvelteKit 3 default is one hour.
- `content-site` does not set `version.name`. The name is therefore
  `Date.now()` from when `vite build` loads the config, so every image build
  gets a new name. Images are built per `@apps/content-site@x.y.z` tag
  (`.github/workflows/docker-publish.yml`), and test and production run the same
  image, so they share a name. Re-running the image build for a tag, or rolling
  back to an older image, also counts as a new deployment.
- SvelteKit has its own fallback. When `updated.current` is `true` and a
  client-side navigation fails or returns a status of 400 or more, SvelteKit
  loads the target URL as a full page. This only happens on a navigation the
  user started.

## Prompt rules

- **Precedence:** once a tab knows about a newer build, it hides the curated
  notice for the rest of its session, including after the prompt is dismissed.
  That notice describes the old version. After a reload, the curated notice for
  the new version follows its own rules. The prompt waits while the onboarding
  dialog is open.
- **Dismissal:** dismissal is remembered for each build name. Other tabs that
  show the prompt for the same build hide it through the `storage` event. A
  build with a different name prompts again. Because `updated` stays `true`, a
  tab detects at most one deployment per page load.
- **Multiple tabs:** each tab detects a deployment independently. Reloading one
  tab does not reload the others.
- **Offline and failed checks:** failures are silent; the app does not log them. The
  prompt appears only after `_app/version.json` has been read successfully, so a
  reload is likely to work. A failed read is retried on focus, visibility, and
  `online` events.
- **Unsaved work:** `content-site` has no user-entered drafts. Filters and
  search live in the URL, and settings live in `localStorage`. A reload does
  drop in-memory state: in-progress audio downloads (fetched in
  `packages/ui-shell/src/audio-player.svelte`), playback, open dialogs, and
  gacha simulation results. That is why the prompt never reloads on its own and
  its copy says that work in progress will stop.
- **Rolling updates:** while old and new pods both serve traffic, a tab can see
  a different build name for a moment. The prompt names whichever build
  answered `_app/version.json`.
- **Accessibility:** the prompt is a polite `role="status"` region with a
  labelled **Reload** button and **Dismiss** icon button. Both targets are at
  least 44px, and the styling reuses the curated notice.

## Tests

- Unit tests: `apps/content-site/src/lib/deployment-update.test.ts`. Layout
  precedence: `apps/content-site/src/routes/layout.test.ts`.
- Browser tests: `pnpm exec playwright test -c playwright.deployment-update.config.ts`.
  The config builds `content-site`, serves it with `vite preview` on port 5530,
  and reuses the visual-test mock server on port 4173. The suite replaces
  `_app/version.json` to simulate new, unchanged, and unreachable deployments.

A CI guard that checks the curated entry against the `content-site` version is
tracked separately in #578.
