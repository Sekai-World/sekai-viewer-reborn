---
"@apps/content-site": patch
"@platform/sekai-master-api-sdk": patch
---

Fix event list request query serialization for the updated `sekai-master-api-sdk` contract and add content display spoiler settings in the navbar.

Add a card list page with region switching, sorting, filtering, pagination, and multiple view modes. Extend the card filters with unit, character, skill, and 3DMV cut-in controls backed by the updated `/cards/:region/list` query params without preloading every card page.

Add color previews to the content-site theme selector.
