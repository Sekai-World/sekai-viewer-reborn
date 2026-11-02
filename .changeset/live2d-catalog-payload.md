---
"@apps/media-lab-site": patch
---

Shrink the `/live2d` catalog page response: serialize the model list once with only the fields the page renders, and stream just the models whose character changes after character resolution instead of a second full model list.
