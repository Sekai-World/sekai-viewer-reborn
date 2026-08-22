# Tools-site ranking snapshot time groups

`apps/tools-site/src/routes/tracker/[region]/+page.svelte` keeps the two time controls
semantically separate:

World Bloom 的默认 **Event rankings** tab 不显示章节倒计时。仅在选择章节 tab 后显示该章节的倒计时，并使用所选章节的 `chapterStartAt`/`chapterEndAt`；活动 `aggregateAt` 继续只用于活动排名的阶段、刷新和速度计算。

- **Activity day** uses continuous 24-hour event-relative grouping (`Day 1`, `Day 2`, ...),
  so an event day can span browser-local midnight and still retain its event-relative meaning.
- **Ranking snapshot time** uses native `<optgroup>` elements grouped by the browser's local
  calendar date. Its options show only local time, with `Latest` appended to the globally newest
  snapshot. Selecting the global latest clears the snapshot state and does not request
  `/snapshot`; selecting an older point queues the snapshot request.

The behavior is covered by the source contract test in
`apps/tools-site/src/routes/tracker-page-ui.test.ts` and was checked in Playwright with a
cross-midnight snapshot list: the DOM exposed separate local-date optgroups, past-ranking
activation requested `/time` only, and returning to global latest did not add another
`/snapshot` request.

## Deadline helper compiler constraint

In the tracker page, keep the browser `fetch` deadline helper as a generic **function
declaration** (`async function fetchJsonWithDeadline<Payload>(...)`), not a generic arrow
function. Svelte 5.56.9 stripped the parameter list from the generic-arrow compilation in
this component, causing its `url` reference to fail before graph, `/time`, or `/snapshot`
requests were issued. The UI source-contract test asserts the declaration form. Verified
with the historical tracker route (`/tracker/jp?eventId=214`), whose rank-detail dialog
loads a graph after the change. Source: `apps/tools-site/src/routes/tracker/[region]/+page.svelte`.

## Native dialog exit motion

For a native `<dialog>` that needs a visible exit transition, do not call `close()` immediately.
Set a closing state first, animate the `.modal-box` (the tracker uses `max-height`, opacity, and a
small vertical transform), then call `dialog.close()` after the transition duration. Intercept the
`cancel` event so Escape follows the same path, and route the modal-backdrop button through the
same close function. Keep the reduced-motion duration near instant. Source:
`apps/tools-site/src/routes/tracker/[region]/+page.svelte`.

## Tracker detail graph loading and dialog entrance

The tracker detail dialog keeps its content mounted while the native dialog exit
transition runs, then clears the selected row from the `close` handler. Opening
uses a one-frame `data-opening` state so the same CSS transition can animate the
panel from its collapsed state without flashing open first. The graph area keeps
a fixed responsive height (`18rem` on narrow screens) while loading, using a
lightweight grid skeleton; the chart fades in once data is available. Both the
skeleton pulse and chart entrance respect `prefers-reduced-motion`. Source:
`apps/tools-site/src/routes/tracker/[region]/+page.svelte`.

## Async visual-region loading rule

For any tools-site region whose content arrives asynchronously, keep one stable
outer geometry for loading, available, empty, error, and invalid states. Large
visual regions must use a skeleton that resembles the final structure rather
than inserting a bare spinner or paragraph. Swap the skeleton for resolved
content with opacity-only motion; do not animate the region's height or width.
Empty and error messages belong inside the same reserved region. Skeleton pulse,
content fade, and view transitions must respond to `prefers-reduced-motion`.

The tracker applies this rule to the ranking workspace, snapshot status,
time-travel controls, ranking refresh status, mobile ranking cards, and header
status panel. Refresh indicators should overlay or occupy an already-reserved
status slot instead of pushing the primary content downward. Navigation motion
must read the current reduced-motion preference rather than only the value at
initial mount. Sources:
`apps/tools-site/src/routes/tracker/[region]/+page.svelte` and
`apps/tools-site/src/routes/+layout.svelte`.
