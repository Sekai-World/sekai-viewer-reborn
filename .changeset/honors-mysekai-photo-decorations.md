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

Drop the end-of-list note from Missions and Honors.

Regenerate the sekai-master-api SDK for reward item names and gacha ticket asset bundles.

Show reward items with their in-game icons and names in Story, Normal, and Character Rank rewards, and fix gacha ticket icons on event and virtual live pages. Open each Character mission as a card whose level goals and EXP or EX rewards appear in a dialog, on both the Missions page and Character pages. Keep the catalogue loading text for screen readers only.

Show reward items as their game icon and quantity, naming each item in a tooltip and accessible label, with text when an icon is missing.

Load every mission of the chosen character at once, and show ladder reward totals as icon and quantity.

Center reward ladder rows vertically, and show Character Rank honor rewards as their small honor degree at the granted level.

Place regular honor level stars at their measured position (x 51 + 16i) in both main and sub degrees.

Enlarge reward item icons (48px in rows, 56px in totals) so detailed items stay legible beside small honor degrees.

Centre trimmed honor frame textures instead of stretching them, and preview six Character missions on Character pages with an arrow on the See all link.

List only honor ranks as Character Rank milestones and show the cumulative EXP each rank needs.
