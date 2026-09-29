---
"@apps/content-site": patch
---

Drop the visible "Search titles" heading above the Titles catalogue search and show the text as the field's placeholder instead. The field is now named by `aria-label` alone; the old label also wrapped the Search button, so assistive technology read the field as "Search titles Search".
