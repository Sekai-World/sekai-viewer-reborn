# Frontend Instructions

## Scope and priority

This repository uses SvelteKit 2, Svelte 5, Tailwind CSS 4, and daisyUI.
For visual or component decisions, `DESIGN.md` has the highest priority. Follow
its daisyUI-first, semantic, interaction, and accessibility requirements before
using the implementation guidance below. Keep the more specific established
patterns in `docs/content-site-ui-conventions.md` for content-site work.

## Svelte and SvelteKit

- Use TypeScript and Svelte 5 runes for new component reactivity: `$props`,
  `$state`, and `$derived` as appropriate. Prefer `$derived` to `$effect` for
  derived state; reserve effects for real side effects and return cleanup for
  listeners, timers, and subscriptions.
- Keep components focused on one responsibility. Keep route, API-shape, and
  domain-specific components in their app; promote a component to
  `@platform/ui-shell` only when its behavior and accessibility contract are
  genuinely cross-site.
- Use SvelteKit file-based routes, server load functions for server-only data,
  and form actions with progressive enhancement for mutations. Provide loading,
  empty, and error states without discarding usable adjacent content.
- Avoid module-level mutable request state in SSR. Use component state or scoped
  context for reactive state shared within a request or component tree.
- In `.svelte` component scripts, do not use generic arrow functions (for
  example, `const request = async <T>(url: string) => ...`). Use a generic
  function declaration (`async function request<T>(url: string) { ... }`) or
  move the helper to a `.ts` module. Svelte 5.56.9 can compile the generic-arrow
  form without its parameters, causing runtime `ReferenceError`s.

## UI, CSS, and accessibility

- Consult the official daisyUI documentation first. Reuse an existing component
  or template and its semantic structure where it satisfies the product contract;
  customize only when it does not.
- Use Tailwind v4 utilities and the existing daisyUI setup. For global daisyUI
  default overrides, use `@utility` in the app's `src/app.css`; use markup
  utilities for local differences. Do not create custom classes merely to fight
  daisyUI defaults.
- Build mobile first, use the existing Tailwind breakpoints consistently, and
  ensure controls remain usable by touch and keyboard.
- Use semantic HTML, visible labels, meaningful image alternatives, visible
  focus, keyboard-operable interactions, and non-color-only feedback. Respect
  reduced-motion preferences; do not make meaning depend on hover or motion.

## Testing

- Use the repository's targeted workspace checks first.
- In a fresh checkout or `.slim/worktrees/*` worktree, generate SvelteKit
  runtime artifacts before running Vitest: run `svelte-kit sync` for every
  SvelteKit app (`account-site`, `content-site`, `media-lab-site`,
  `tools-site`) or one `vite build`. The root `tsconfig.json` references all
  apps, so missing generated `.svelte-kit/tsconfig.json` files make Vitest fail
  at startup with a Rolldown `Could not resolve 'node:module'` /
  `Tsconfig not found` error.
- Test component behavior with Vitest and Svelte Testing Library. Use Playwright
  for end-to-end user flows and visual regression coverage where applicable.
- Prefer accessible queries and user-observable outcomes over implementation
  details; use fake timers or mocks instead of wall-clock waits.
