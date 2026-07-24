---
"@apps/content-site": minor
---

Add the character catalogue to the Content Center: a region-aware character list (`/characters/[region]`) with unit filtering, search, and a card count, plus a character detail page (`/character/[region]/[id]`) showing profile, unit, height, and sequence metadata.

Link characters to their cards from the detail page through the shared cards list filtered by character ID. Surface the new catalogue in the homepage database directory, and add a Characters entry to the sidebar for discovery.

Enable cross-navigation into character profiles from card detail (character identity), event detail (banner character), and music detail (vocal characters) whenever a positive `gameCharacterId` is present. Load the complete character and unit catalogue through paginated aggregation (`aggregateGameCharactersByRegion` / `aggregateGameCharacterUnitsByRegion`), following pagination cursors and deduplicating results.

Make event bonus-character rows link to the character's card list, filtered by the highest event-bonus attribute (or all attributes for World Link), with Piapro support-unit filtering. Align card-list grid hover feedback with the other views and distinguish unavailable current-event data from an intentional absence of a current event.

Wire the character routes into the streaming i18n pattern so list/detail labels resolve from the `character` namespace with localized fallbacks.
