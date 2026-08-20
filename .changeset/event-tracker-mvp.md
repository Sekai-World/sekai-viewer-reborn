---
"@apps/tools-site": minor
"@platform/ui-shell": minor
---

Add regional event tracking cards with localized event IDs and unit badges, and share the configurable unit icon badge component with content-site.

The Event Tracker MVP provides a regional current-event workspace and
server-side data loader, live and historical ranking views, URL-restored event
selection, refresh feedback, localized accessible states, a themed interactive
ranking-history chart, and layout-matched skeletons while ranking requests are
pending so unavailable defaults are never shown as loading data. Stream
current-event cards on the tools home page with matching skeletons so the brand,
hero, and tracker CTA render immediately. Available home cards now use their
official regional event banner, show a live ranking deadline countdown, and act
as a single keyboard-accessible tracker link.
World Bloom events now include a responsive per-chapter score ranking workspace
backed by the master-api chapter metadata and live chapter-ranking data. It uses
the distinct `chapterStartAt`, `chapterEndAt`, and event `aggregateAt` deadlines
for their respective countdown, phase, and ranking calculations.
