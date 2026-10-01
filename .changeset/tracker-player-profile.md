---
"@platform/ui-shell": minor
"@platform/i18n-source": patch
"@apps/tools-site": minor
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/account-site": patch
---

The tools-site event tracker shows each ranked player as the game does. Ranking rows and mobile cards show the leader card's thumbnail beside the player name, with the trained art only when the player chose it (`defaultImage` is `special_training`). Player details show the wide profile art (`character/member_small`) with the card's level bar and Master Rank diamond (hidden at rank 0, as in the game), and the player's titles in the game's main and sub slots, including Kizuna titles with their chosen word, side swap, and Virtual Singer outfit. Rank reward titles now follow content-site's rules, drawing an event title on the event background under its rank overlay, and replace the placeholder rank-range badge, which remains only when no title art is available.

The title rules that map honor master data onto `HonorDegree` move from content-site into `@platform/ui-shell/honor-degree-adapter` so both sites share them; a player's held level can now select that level's rarity and Live Master art. Content-site behavior is unchanged.
