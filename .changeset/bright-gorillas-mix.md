---
"@apps/content-site": minor
---

Add a gacha detail page with SSR loading, region switching, and pickup card links.

Add a preferred content region selector in content-site settings for default database navigation.

Improve the content-site homepage hierarchy with a large-screen three-column latest data layout and a lighter footer note.

Disable 3D event-card hover effects on coarse pointer devices while preserving desktop hover behavior.

Move list filter dialog close actions to top-right icon buttons and remove the visible bottom Close buttons.

Polish card list and detail metadata by widening agenda-view artwork, showing character avatars beside unit badges, and reusing filter-style attribute icons on card details.

Extract card-detail gacha voice playback into a reusable `VoicePlayButton` component in `shared/`.

Improve `VoicePlayButton` with stop-button playback semantics and a circular progress ring.

Show a disabled, tooltip-backed error state when card gacha voice audio fails to load.
