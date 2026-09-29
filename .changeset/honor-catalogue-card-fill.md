---
"@apps/content-site": patch
---

Fill the Titles catalogue cards and dialog. Titles now scale to the width of their card or dialog up to their full 380px size (the small sub slot below 266px is unchanged), instead of staying at 266px on the left of a card up to 545px wide. The catalogue shows two columns from `md` and three from `lg`, so a 1235px window shows three 358px cards, each with a 324px title. The title group dialog narrows to 512px and shows each rarity's title at full size.
