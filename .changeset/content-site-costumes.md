---
"@apps/account-site": patch
"@apps/content-site": patch
"@apps/media-lab-site": patch
"@apps/tools-site": patch
"@platform/i18n-source": patch
"@platform/sekai-master-api-sdk": patch
---

Add a 3D costume directory to content-site at `/costumes/[region]`, with a sidebar entry under Library. It lists whole outfits, one per name across every character who has it, with filters by character and rarity, a name search, and ID order. Each outfit has its own page at `/costume/[region]/[id]` with its designer, rarity, publish time, how to obtain it, characters, and colors.

Regenerate the master API SDK for the new `costume3dOutfits` routes and add the pages' English source strings in a new content-site `costume` namespace. The other apps are included only because they consume these shared packages. Their behavior does not change.
