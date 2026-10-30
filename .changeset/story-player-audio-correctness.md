---
"@apps/content-site": patch
"@apps/tools-site": patch
"@apps/media-lab-site": patch
"@platform/live2d-story-player": patch
---

Fix StoryReader audio: a volume of 0 now mutes playing sounds, volume sliders keep each sound's scenario gain, stacked sound effects follow the sound-effect volume, BGM cross-fades instead of cutting the previous track, and music and looping effects fade out when a story ends.
