---
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@apps/account-site": patch
"@platform/ui-shell": patch
"@platform/i18n-source": patch
---

Audio that fails to load on content-site now says so instead of claiming there is no audio. The card page's gacha phrase voice button showed "No event BGM available" on a failed load because the `card` and `event` i18n namespaces load together and both defined `audioUnavailableLabel`; it now uses the new shared `audioLoadFailedLabel` ("Failed to load audio."), and the unused card-namespace key is removed. `AudioPlayer` gains an optional `errorLabel` for the load-failure state, so the event BGM, music preview, and virtual live setlist players show the same failure message while keeping their "no audio" text for a missing source. Other `AudioPlayer` consumers are unchanged until they pass `errorLabel`.
