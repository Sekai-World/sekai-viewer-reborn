# Tools-site World Bloom countdown

- The chapter countdown is rendered only for a selected chapter tab. It targets the selected chapter's `chapterStartAt` before start, the next chapter's `chapterStartAt` after start, and the final chapter's `aggregateAt`, falling back to `chapterEndAt` only when aggregation is absent (`apps/tools-site/src/routes/tracker/[region]/+page.svelte`).
- The Event rankings tab has no chapter countdown or current-chapter status bar; the current marker remains on the relevant chapter tab.
