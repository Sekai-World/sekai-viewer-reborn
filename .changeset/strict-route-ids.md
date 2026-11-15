---
"@apps/content-site": patch
"@apps/media-lab-site": patch
---

Numeric ids in the story event-episodes, title preview, mission level and Virtual Live timeline endpoints must now be written in canonical decimal form. Forms such as `0x10`, `1e2`, `0180` or an id with a space no longer resolve to another record.
