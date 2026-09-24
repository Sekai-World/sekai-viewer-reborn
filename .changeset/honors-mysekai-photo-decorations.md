---
"@platform/sekai-master-api-sdk": patch
"@platform/ui-shell": patch
"@platform/i18n-source": patch
"@apps/account-site": patch
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
---

Regenerate the master API SDK with Honors, Bonds Honors (including character-pair filtering), Missions, Event Honor Bonuses, MySekai photo decorations, Costume3D list/detail, and newly documented paginated list contracts. Add content-site Missions and Honors catalogues, and distinguish event honor bonus rules from ranking-reward honors on event detail pages.

Render Live Master honors with the standard rarity-based local frame while keeping their custom level parts separate.

Give the Honors catalogue a clear page identity and a labelled results region.

Keep Character Missions in the Missions catalogue while expanding level goals in place with explicit target labels; remove repeated Character Rank reward references from mission rows.

Move Character Rank rewards to Character detail pages with localized loading, empty, and failure states.

Group the content-site sidebar into Library, Activities, and Progression sections instead of a single Explore section.

Show each mission family in the Missions overview as soon as it loads instead of waiting for every family; a family that fails shows its own retry.

Render Missions overview families as cards with a visible per-family loading skeleton.

Load 24 Honors per page so the first page fills a desktop viewport before the next page loads.

Add Character Missions to Character detail pages, load every Character Rank instead of the first 100, and summarize ranks with reward totals and milestone ranks.

Show Story missions as a target ladder with reward totals and milestone targets, preview them by target and reward, and drop the duplicate target line from Normal missions.

Lay out milestone and full reward ladders in the same width-driven columns, keeping milestones emphasized when every step is shown.

Load every Normal mission at once, and pick a character before listing Character Missions; the Character detail page links to that character's missions.

Describe Story missions as fully read episode goals, with the reading rule shown above the ladder.
