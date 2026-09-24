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
