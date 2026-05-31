---
"@apps/content-site": patch
"@platform/i18n-source": patch
"@platform/sekai-master-api-sdk": patch
---

Fix event list request query serialization for the updated `sekai-master-api-sdk` contract and add content display spoiler settings in the navbar.

Add a card list page with region switching, sorting, filtering, pagination, and multiple view modes. Extend the card filters with unit, character, skill, and 3DMV cut-in controls backed by the updated `/cards/:region/list` query params without preloading every card page.

Add color previews to the content-site theme selector.

Give card list unit icons rounded surfaces for dark theme readability.

Add a regional song list with jacket artwork, grid and agenda layouts, and searchable, clearable filters for title, MV type, and creator credits.

Use the checked-in content-site i18n source messages as the runtime fallback for missing remote dictionary keys.

Prepare the song list filters for vocal character, vocal unit, tag, difficulty, and level fields.

Add song filter hints, multi-select difficulty, game character and unit pickers, and level condition matching.

Make song list vocal filters use game character and unit selectors, add multi-select song difficulty filtering, and support level filter conditions.
