---
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@platform/live2d-story-player": patch
---

Add a Restart control to the StoryReader player that rewinds to the first line, make previous line and restart work again after a story has finished, and keep the stage controls icon-only with clearer disabled states. Rewinding (previous line and restart) now replays from a blank stage, so models, backgrounds and overlays from later lines no longer linger, and a model cleared in the same step it appears is hidden again instead of staying on screen.
