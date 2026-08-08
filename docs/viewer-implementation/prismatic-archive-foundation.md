# Prismatic Archive: implementation plan

## Status and thesis

This is the approved foundation plan for **Prismatic Archive**, not a request to
redesign or implement all four sites at once. The first delivery is the shared
system and its core flows, with `content-site` as the most representative
consumer. Later phases extend the system to `tools-site`, `media-lab-site`, and
`account-site` without collapsing their app boundaries.

The thesis is **a calm, evidence-first archive surface for dense game data**:
make the stable identity of a record obvious, make the next useful path
obvious, and let color, image, and motion explain state rather than decorate
it. The archive should feel like one coherent product while retaining the
different jobs of the four independently deployed SvelteKit apps.

The visual system must therefore be additive and reversible. Existing routes,
loaders, SDK contracts, CDN dictionaries, `ViewerShell`, daisyUI/Tailwind
utilities, and established detail/list components remain the source of truth
until a phase explicitly migrates them.

## Current constraints to preserve

- The monorepo is `pnpm` + Turborepo, with SvelteKit 2, Svelte 5 runes,
  TypeScript, Tailwind CSS 4, and daisyUI.
- `content-site` is SSR-first and owns the current database/archive reading
  experience. Its route conventions use path parameters such as
  `/cards/:region`, `/musics/:region`, `/event/:region/:id`, and
  `/events/:region`.
- Shared shell UI is exported from `packages/ui-shell/src`; the current shell
  has an adaptive drawer/sidebar, sticky rounded navigation, a bounded content
  container, and localized sidebar labels supplied by `content-site`.
- Shared tokens currently live in `packages/ui-tokens/src/design-tokens.json`
  and are exposed through `packages/ui-tokens/src/index.ts`. The JSON keeps the
  legacy public keys as compatibility aliases (`color.brand.50/500/700`,
  `color.neutral.0/900`, `space.xs/sm/md/lg`, and the original `radius.sm/md/lg`
  values) while adding semantic color, numeric spacing, additive radius, icon,
  motion, and game-data groups. Prismatic Archive extends this contract; it
  does not replace or rename the legacy data.
- `content-site` app CSS owns theme variables, daisyUI proxy setup, shared
  content-card surfaces, and narrow motion utilities. Do not fight daisyUI
  defaults with business classes or add broad `:root *` transitions.
- User-facing `content-site` strings belong in the external i18n dictionaries;
  source keys are maintained under `packages/i18n-source/content-site/` and
  checked with `pnpm i18n:check`.
- Character, unit, image retry, spoiler, region, and detail behavior already
  have shared primitives and domain helpers. New archive UI should compose
  those primitives instead of duplicating image wrappers, route parsing, or
  data labels.

## Semantic token model

Tokens should describe meaning, not a component or a particular theme. Keep
the existing raw token JSON as the portable source and add semantic aliases
only after a concrete consumer needs them.

### Token layers

1. **Legacy compatibility tokens**: the existing public `color.brand`,
   `color.neutral`, `space.xs/sm/md/lg`, and `radius.sm/md/lg` keys remain
   available with their original values. Consumers may continue using them
   during migration.
2. **Additive semantic/reference tokens**: current groups include
   `color.surface`, `color.text`, `color.border`, `color.accent`, `color.status`,
   `color.focus`, numeric `space` steps, additive `radius.xl/pill`, `icon`, and
   `motion`. These are the preferred new names for archive work.
3. **Game-data tokens**: `gameData.immutable` contains stable attribute and
   rarity signals. They are data colors, not UI semantic aliases.
4. **Component tokens**: if repeated interaction contracts later need them,
   add a separately named group such as `shell` or `control`; do not make a
   second color vocabulary or repurpose legacy keys.

Semantic tokens need light/dark/theme mappings compatible with the current
`data-theme` and `.dark` selectors in `apps/content-site/src/app.css`.
Prefer CSS custom properties and `color-mix()` for derived borders and
surfaces, as current content-card classes do. Preserve `color-scheme` and
verify contrast for every theme. Game-character and unit colors remain data
signals, not replacements for UI semantic colors.

## Immutable game-data signals

Treat master/game data as immutable input during rendering. UI state may change
selection, filters, disclosure, spoiler visibility, or playback, but must not
mutate the parsed record or reinterpret its identity in place.

The first delivery should establish a small signal vocabulary:

- **Identity**: route region plus canonical numeric/string ID. Use typed
  SvelteKit route helpers (`resolve`) and existing SDK/domain parsers; never
  derive identity from display names or array position.
- **Time**: source timestamps and derived event state (`upcoming`, `ongoing`,
  `ended`) are read-only projections. Keep the existing server-load boundary
  and timestamp normalization rather than calculating authoritative state in a
  visual component.
- **Relationships**: character IDs, unit codes, card IDs, event IDs, music IDs,
  reward IDs, and release-condition references remain explicit links. Missing
  or invalid IDs render the established non-link fallback, never a fabricated
  destination.
- **Provenance and freshness**: region, source endpoint, version/cache status,
  and spoiler classification should remain inspectable metadata where a flow
  needs them. Do not silently rewrite persisted data to make a visual state fit.
- **Availability**: loading, unavailable-in-region, empty, error, and stale
  states are separate semantic states. They must not be represented only by
  color or by a blank card.

Use `$state` only for local interaction state and `$derived` for projections.
Avoid `$effect` for state synchronization, and never use module-level mutable
state for request-scoped data in SSR. Shared domain parsers should return
stable typed values; components should receive props and render them.

## Typography and multilingual behavior

Typography is part of the archive's information architecture, not a decorative
brand layer. Establish a small role scale: display/title, section heading,
record label, body/value, metadata, and compact control text. Use weight and
spacing to distinguish record identity from metadata before adding color.

- The system must tolerate Japanese, English, Korean, Chinese, and long
  localized strings without fixed-width assumptions. Titles may wrap; metadata
  may truncate only when the full value is available to assistive technology or
  an explicit disclosure.
- Prefer font stacks with appropriate CJK fallbacks and `font-variant`/line
  height choices that do not assume Latin ascender/descender metrics.
- Test mixed-script titles, long event names, narrow rail labels, and translated
  button/ARIA text. Never use source keys or English-only abbreviations as the
  visual fallback when a dictionary key is missing; follow the existing
  translator fallback conventions.
- Keep user-facing strings in the relevant CDN namespace. Shared labels belong
  in `common.json`; content-only and server-only labels stay scoped as directed
  by the i18n conventions.
- Numeric values, dates, IDs, and durations should use domain formatters and
  locale-aware output, while IDs remain stable and copyable.

## Surface, navigation, motion, and accessibility rules

### Confirmed content-site design language

Phase 3 confirms that `content-site` should read as a calm, readable archive/catalogue, not as a generic dashboard or decorative landing page. Keep these reusable implementation rules grounded in `apps/content-site/src/app.css`, `apps/content-site/src/routes/cards/[region]/+page.svelte`, `apps/content-site/src/routes/event/[region]/[id]/+page.svelte`, and their detail/list components:

- Use four semantic surface roles—canvas/background, panel, inset/sunken, and elevated/overlay—with token-driven archive text, border, accent, and focus roles and the `content-card-*` primitives.
- In dark mode, preserve a clear lightness ladder: canvas below inset, inset below the default card panel, then raised and overlay above it. Standard card separation comes from this ladder and the subtle border token, not from persistent shadows or component-specific colors; keep the rule aligned across default, sakura, and mint.
- Keep the visual language restrained: thin borders, modest shadows limited to interaction, no heavy blur or filters, compact but touch-safe controls, visible focus, and transitions that remain safe in low-motion mode.
- Organize information around clear page identity, composed control decks, grouped result fields, and scannable evidence/data sections. Prefer responsive mobile-first flow over dense desktop-only composition.
- Preserve established behavior: visibility-gated/lazy artwork, spoiler/reveal semantics, and route/query/server state remain authoritative rather than being reinterpreted by presentation code.
- In the Phase 3 cards catalogue and event detail, apply semantic archive surfaces without changing data, route, or i18n contracts. A multi-card event identity rail flows naturally with the page; it is not a full-column sticky rail.
- Treat this as a design evolution from generic daisyUI card/base surfaces and ad-hoc spacing/shadows to calmer semantic surfaces and explicit hierarchy, not as a claim that all previous UI has been removed.
- The homepage current event is a data-driven Archive Banner: use the selected region's existing streamed current-event payload while preserving its event-detail link, unit metadata, countdown, and asset retry/fallback behavior. For intrinsically small event artwork, use a compact contained preview rather than a stretched hero: at `lg` widths, a modest fixed media column sits beside the content-led details within the bounded `max-w-5xl` track; mobile remains naturally stacked. Loading, empty, and error states reserve that same media/details geometry to limit shift.
- Dark archive palettes are token-driven and hue-aware: use a gently tinted canvas with a default → raised → overlay surface ramp, restrained borders, and a quieter primary ambient glow than light mode. Preserve theme-specific indigo, sakura, and mint character without component-level hard-coded colors or heavy shadows.

### Surfaces

- Use a restrained three-level hierarchy: canvas, panel, and inset/elevated
  detail. Map these to semantic tokens and the current `content-card-shell`,
  `content-card-inset`, and `content-card-elevated` patterns where applicable.
- Dense data gets grouping, dividers, and alignment—not excessive shadows,
  gradients, blur, or nested cards. Images preserve their established loading,
  retry, spoiler, and visibility-gating behavior.
- Use existing daisyUI primitives and utility classes for one-off differences;
  introduce a shared component only when the interaction or semantic contract
  repeats across routes/apps.

### Adaptive desktop rail

The approved navigation direction is an **adaptive desktop rail**, with the
current drawer remaining the small-screen fallback. In Phase 1, persistence is
an explicit opt-in `ViewerShell` prop (`desktopRailOpen`, default `false`) and
only `content-site` enables it. This delivers a persistent full-width desktop
rail plus the existing mobile drawer; compact/collapsed rail behavior is out
of scope and is not implied by this contract.

- Keep navigation owned by `ViewerShell`; apps provide typed `SidebarItem[]`
  and localized labels rather than duplicating shell markup.
- Preserve active route/region logic, disabled-item alignment, drawer close on
  navigation, and explicit open/close labels and `aria-controls`/
  `aria-expanded` relationships.
- Define the enabled rail width, content offset, and breakpoint as semantic
  layout tokens when the layout token group is introduced. Do not claim or
  implement a collapsed width in Phase 1, and avoid making page components
  aware of hard-coded shell widths.
- The rail must not reduce the readable content track below the existing
  bounded container/detail layout rules. Keep mobile stacked layouts and the
  established one-third maximum for true two-column detail left tracks.

### Motion

- Motion communicates route change, disclosure, loading, and focus; it never
  gates access to data.
- Reuse the existing `tools-site`/`media-lab-site` view-transition fallback:
  native View Transitions when supported, short local `fade` otherwise, and no
  transition when reduced motion is requested. The same policy can be shared
  later, but must not force media-specific animation into content pages.
- Keep hover motion local to the component. Do not introduce page-wide
  transitions or scale raster artwork when a small translation/brightness
  change preserves sharpness.
- Honor both `prefers-reduced-motion` and the existing `contentDisplaySettings`
  low-motion mode. Ensure focus indicators are not animated away.

### Prismatic Archive feedback refinement

Prismatic Archive does not remove feedback; it uses restrained, semantic motion. Keep interactions in the 150–300ms range, respect `data-low-motion` and `prefers-reduced-motion`, avoid broad/global animations, and avoid heavy filters. Skeletons should preserve layout at independently streamed boundaries instead of leaving blanks. In `apps/content-site/src/routes/event/[region]/[id]/+page.svelte`, the event payload, unit profiles/info, current-event countdown, and unit-profile BGM are separate streaming boundaries; each uses a visual-only skeleton placeholder with `aria-hidden="true"` while its data resolves.

Skeleton groups should avoid per-item costly shimmer loops. A simple pulse or static reduced-motion state, together with reserved dimensions, provides feedback without jank or cumulative layout shift (CLS). The corresponding app-level motion and surface rules are defined in `apps/content-site/src/app.css`.

### Accessibility

- Use semantic headings, landmarks, lists, buttons, and links. Every interactive
  element needs a keyboard path, a visible focus state, and a localized name.
- Decorative images use the existing `decorative` conventions; informative
  images retain meaningful alt text. Character/unit avatars should use
  `CharacterAvatar` and `UnitIconBadge`, not hand-rolled wrappers.
- A link around an avatar or card must have one clear accessible name. Invalid
  or missing game IDs retain a decorative, non-link fallback.
- Maintain minimum touch targets for shell controls and list toolbar controls;
  do not encode meaning in color alone. Check contrast in all current theme
  palettes and at keyboard focus.
- Dialogs, drawers, filters, media controls, spoiler reveals, and route changes
  need focus management and an announced state. Test with axe where practical
  and with keyboard-only flows in every app that adopts the primitive.

## Delivery phases

### Phase 1 — foundation, system, and core flows

Deliver the smallest usable Prismatic Archive system:

1. Document and encode semantic token roles without replacing existing theme
   behavior.
2. Add a backward-compatible shared shell contract for opt-in persistent
   desktop rail behavior (`desktopRailOpen=false` by default), while preserving
   the current mobile drawer and `SidebarItem` API. Enable it only in
   `content-site`; compact/collapse behavior is a later phase.
3. Establish shared primitives for archive surface, record header/identity,
   status/provenance metadata, and typed next-step links. Prefer composition
   over a universal page component.
4. Apply the system to representative `content-site` flows: home/current
   event → event detail, list → detail for cards/characters/music/events, and
   region/theme/locale settings. Include loading, empty, error, unavailable,
   spoiler, and invalid-ID fallbacks.
5. Add characterization tests for the primitives and route-level checks for
   the core flows. No API contract or generated SDK changes are expected.

Phase 1 is complete when the shell and representative content flows can be
enabled or reverted independently, preserve existing URLs and response data,
pass checks in the touched workspaces, and demonstrate the accessibility and
multilingual rules below.

### Phase 2 — content-site breadth

Migrate remaining content detail/list surfaces: gacha, virtual lives, rewards,
media previews, event BGM, downloads, and related-character/unit links. Extract
only patterns proven by Phase 1. Keep asset retry policies, lazy/visible image
loading, spoiler controls, region swipe behavior, and CDN i18n contracts intact.

### Phase 3 — tools-site workflows

Apply the archive shell and semantic tokens to tool discovery, input/output
states, filter/query controls, and result-to-record navigation. Keep tools
interaction-first and avoid importing content-site domain loaders. Reuse shared
surface, status, focus, and motion primitives; preserve the existing route
transition implementation and add tool-specific labels to its own i18n scope.

### Phase 4 — media-lab-site workflows

Adopt the shell foundation around media-heavy experiences, with explicit
performance budgets and a CSR-first interactive island inside an SSR-capable
shell. Extend audio/image/preview controls only through `ui-shell` contracts.
Keep reduced-motion behavior, view-transition fallback, lazy media loading, and
failure/retry affordances independent from content-site data presentation.

### Phase 5 — account-site workflows

Apply the same semantic surfaces, typography, rail/drawer behavior, focus
language, and route motion to account/community flows. Authentication remains
owned by `@platform/auth-client`; Prismatic Archive must not introduce local
credential storage or couple account state into archive data loaders.

### Phase 6 — consolidation and hardening

Compare adoption across all four apps, remove duplicated primitives only after
their contracts are stable, document token ownership, and measure bundle size,
SSR output, Web Vitals, keyboard paths, and visual regressions. Any generated
SDK or deployment changes are separate, explicit work items.

## Delivery progress

### Tools-site first workflow

- `tools-site` now has an SSR-safe, tools-local i18n scope and a current-event
  comparison flow that uses SDK calls for two validated regions.
- The selected regions are restored from the URL through GET parameters, and
  unavailable-region and request-failed results remain distinct localized
  states.
- The workflow preserves the existing `ViewerShell` and route-motion boundary.
  It does not fabricate cross-app record links because no public `content-site`
  base-URL contract exists.

### Content-site Phase 3 visual polish — cards catalogue and event detail

- Archive semantic surfaces were applied without changing data, route, or i18n
  contracts.
- The cards catalogue retains query persistence and URL synchronization,
  visible-only artwork loading, and spoiler-reveal semantics. Its unbounded
  lists avoid static heavy image filters and shadows.
- Event detail retains streamed boundaries, asset preview, BGM, reward
  expansion, and region swipe behavior. Its left rail flows naturally rather
  than remaining a sticky full rail, so short viewports do not leave content
  unreachable.
- Validated with `pnpm --filter @apps/content-site check`,
  `pnpm --filter @apps/content-site lint`, and `git diff --check`.

## Likely files and components

These are likely touch points, not a mandate to edit all of them in Phase 1.

### Shared system

- `packages/ui-tokens/src/design-tokens.json` and `packages/ui-tokens/src/index.ts`
  for reference/semantic token definitions and typed exposure.
- `packages/ui-shell/src/viewer-shell.svelte` and
  `packages/ui-shell/src/viewer-shell.types.ts` for adaptive rail/drawer
  structure and typed navigation items.
- `packages/ui-shell/src/index.ts` for public primitive exports.
- New focused primitives under `packages/ui-shell/src/` only when they are
  genuinely cross-app (for example archive surface, status, or focus helpers).

### Content-site integration

- `apps/content-site/src/app.css` for theme-variable mappings and narrow global
  utilities; do not hand-edit generated CSS output.
- `apps/content-site/src/routes/+layout.svelte` for localized shell inputs,
  active region, settings, and rail integration.
- `apps/content-site/src/lib/components/shared/PageHeader.svelte`,
  `Breadcrumbs.svelte`, `RegionBadgeSwitch.svelte`, `CharacterAvatar.svelte`,
  `UnitIconBadge.svelte`, `AssetImage.svelte`, and `EventCardFrame.svelte` for
  established composition points.
- `apps/content-site/src/lib/components/event/*`,
  `card/*`, `music/*`, `virtual-live/*`, and `gacha/*` for representative
  detail/list application.
- `apps/content-site/src/lib/domain/*`, `src/lib/assets/*`,
  `src/lib/i18n/*`, and route `+page.server.ts` loaders for immutable signal,
  asset, locale, and SSR boundaries.
- `packages/i18n-source/content-site/*.json` for any new user-facing source
  keys; this plan does not add keys by itself.

### Later app integration

- `apps/tools-site/src/routes/+layout.svelte` and `app.css`.
- `apps/media-lab-site/src/routes/+layout.svelte` and `app.css`.
- `apps/account-site/src/routes/+layout.svelte` and `app.css`.
- Each app's route-local components and tests, keeping app-specific domain
  logic inside its app and shared presentation contracts in packages.

Do not modify generated SDK files (`*.gen.ts`, generated client/core files),
`dist/`, `.turbo/`, manifests, or AGENTS files as part of the foundation plan.

## Test and evidence matrix

The evidence path for the foundation claim is: a known route/data fixture →
rendered semantic state → observable link/navigation/focus behavior → static
type/lint/build evidence. Visual inspection is supplementary, not the sole
proof.

| Area                 | Evidence                                                                         | Phase 1 target                                                                                     |
| -------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Token contract       | JSON/type import test; theme CSS inspection                                      | Reference and semantic names resolve without breaking current themes                               |
| Shell navigation     | Svelte Testing Library + keyboard DOM events                                     | Rail/drawer open/close, active item, disabled alignment, localized labels, and focus relationships |
| Core routes          | Playwright or route-level tests with fixture data                                | Home/list/detail navigation preserves existing path-param URLs and region selection                |
| Immutable signals    | Unit tests for parsers/formatters and invalid IDs                                | IDs, timestamps, relationships, availability, and spoiler states remain stable projections         |
| Loading/error states | Component tests with controlled promises/errors                                  | Loading, empty, unavailable, error, and retry states are distinguishable and actionable            |
| I18n/typography      | Fixture matrix for long/mixed-script strings and `pnpm i18n:check`               | No overflow-caused loss of identity; labels and ARIA names come from dictionaries                  |
| Accessibility        | `svelte-check`, axe where available, keyboard-only Playwright flow               | Landmarks, headings, names, focus visibility, dialog/drawer behavior, and contrast are valid       |
| Motion               | Reduced-motion browser context and low-motion setting                            | No required content depends on animation; fallback route motion remains short/local                |
| Media/performance    | Visible-loading/retry tests; smoke performance observation                       | Existing lazy image, retry, spoiler, and media failure contracts remain intact                     |
| Workspace safety     | `pnpm --filter @apps/content-site check`, targeted lint/test, `git diff --check` | Foundation changes are scoped; no generated artifacts or API contracts change                      |

For later apps, repeat the shell, i18n, accessibility, motion, and route-flow
rows with each app's own fixtures. Add media frame-rate and auth/session
boundary checks before Phases 4 and 5 are considered complete.

## Migration risks and mitigations

- **Shell regression or lost navigation context**: keep the existing
  `ViewerShell` props and `SidebarItem` model initially; ship rail behavior
  behind a small layout variant/feature flag, test drawer fallback, and retain
  route-derived region logic.
- **Token/theme drift**: map semantic aliases to current CSS variables first,
  compare all `default`, `sakura`, and `mint` light/dark combinations, and do
  not remove old variables until consumers are migrated.
- **Data mutation or SSR leakage**: keep records in server load/domain parser
  boundaries, use props plus `$derived`, and test two requests with different
  regions to detect module-level state contamination.
- **Broken or misleading links**: construct destinations from typed route
  helpers and canonical IDs; preserve decorative fallback for null/invalid IDs;
  add route tests for character, card, music, event, and region links.
- **I18n regressions**: add source keys before component references, run
  `pnpm i18n:check`, test long/mixed-script strings, and avoid hardcoded UI text.
- **Accessibility regressions from decorative density**: require a semantic
  name for every control, keep decorative nested images `aria-hidden`, and run
  keyboard/axe checks before visual polish is accepted.
- **Motion and performance regressions**: reuse local transitions, respect both
  reduced-motion controls, avoid broad CSS transitions, and keep visible-only
  image loading for long lists.
- **Cross-app coupling**: promote a primitive only after two concrete consumers
  need the same contract; keep domain loaders, route policy, and app i18n
  ownership local.
- **Generated artifact churn**: do not regenerate SDKs or edit emitted output
  for a UI foundation task; if an API contract is later required, follow the
  documented OpenAPI → local server → SDK regeneration workflow separately.
- **Rollback complexity**: land token mappings, shared primitives, and app
  adoption as independently revertible changes; preserve old class names and
  route URLs during the migration window.

## Definition of done for the foundation

The first delivery is ready for implementation review when the semantic token
contract, adaptive rail/drawer contract, immutable signal rules, and core
content flows are represented by focused source/tests; all four apps have a
documented adoption path; and the test matrix demonstrates that existing data,
routes, localization, accessibility, motion, and fallback behavior remain
intact. This document itself does not authorize edits outside
`docs/viewer-implementation/`.
