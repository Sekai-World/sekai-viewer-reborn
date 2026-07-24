# Card thumbnail reuse

- `apps/content-site/src/lib/components/card/CardThumbnail.svelte` now owns the shared thumbnail shell used by card list agenda/comfy views and gacha pickup cards.
- The component centralizes visible-loading, fallback-on-error, and the optional card frame / rarity / attribute overlays.
- Keep new card-style thumbnails on this component instead of duplicating the loading shell in page components.
- Gacha pickup cards must forward `attr` and `rarityType` from `parseCardDetail` through `routes/gacha/[region]/[id]/+page.server.ts`; without those fields, `CardThumbnail` cannot render the same frame/icon overlays used by the card list agenda/comfy views.
- Card detail attribute displays should use the same right-facing attribute icon asset family as thumbnails: `/card_attr/icon_attribute_{attr}_88.png`.

## Sequence numbers are internal-only

- Do not render user-visible Sequence / `seq` fields in content-site UI by default.
- Keep `seq` for internal ordering, sorting, and stable keys only, unless a product request explicitly requires showing it.

## Gacha detail asset helpers and behavior keys

- Gacha detail components import asset helpers from `apps/content-site/src/lib/assets/index.ts`; keep gacha-specific helpers exported there so Vite dev imports do not fail at route load time.
- `GachaDetailBehaviorCard.svelte` can receive multiple behavior rows with the same `gachaBehaviorType`; keyed each blocks must use a composite key that includes spinnable/resource/limit fields, not only the behavior type.
