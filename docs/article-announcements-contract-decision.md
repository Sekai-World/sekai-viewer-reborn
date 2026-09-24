# Game News (`userInformations`) Migration Contract Decision

**Type:** record
**Status:** Implemented; `sekai-master-api` owns the current source/API boundary
and `content-site` consumes it through the generated SDK
**Scope:** This record covers the legacy in-game Game News feed backed by the
`userInformations` master-data entity. The implementation is the public
`sekai-master-api` endpoint `GET /api/v1/game-news/{region}/list` and its
`@platform/sekai-master-api-sdk` consumer migration. Historical Strapi article
announcements are background and future scope, not the current implementation
target. The operational `sekai-api` `/notifications` feed is also outside this
scope.

The earlier proposal is superseded by the implemented contract below. Legacy
behavior is retained as a compatibility baseline, while source ownership,
transport, timestamps, and filtering responsibilities are now explicit.

## Confirmed legacy evidence (historical baseline)

### Source and region selection

- `sekai-viewer/src/components/blocks/SekaiGameNews.tsx:58-186` read the
  static region-scoped `userInformations` dataset with
  `useCachedData<IUserInformationInfo>("userInformations")`.
- `useCachedData` in `sekai-viewer/src/utils/index.ts:299-392` selected the
  current region and used `region|filename` as its SWR cache key.
- This describes the legacy transport only. The current consumer does not use
  that static dataset as its API boundary; it calls `sekai-master-api` through
  the generated SDK.
- The legacy item type has no `locale` field. The current Game News endpoint is
  region-scoped and does not introduce a locale parameter or locale fallback.

### Legacy item fields

`IUserInformationInfo` is defined at `sekai-viewer/src/types.d.ts:347-358`.
The compatibility field set is:

| Field             | Confirmed use in Game News                                          |
| ----------------- | ------------------------------------------------------------------- |
| `id`              | Carried item identity                                               |
| `seq`             | Carried legacy sequence field; it is not the confirmed display sort |
| `informationType` | Carried information type                                            |
| `informationTag`  | Category used by the UI filter                                      |
| `browseType`      | Selects the internal/external browse behavior                       |
| `platform`        | Carried platform field; no additional UI filter is confirmed        |
| `title`           | Displayed title                                                     |
| `path`            | Resolved into the click target                                      |
| `startAt`         | Displayed, used for spoiler filtering, and used for sorting         |
| `endAt`           | Displayed end time                                                  |

The current API also preserves the master-data `displayOrder` and
`bannerAssetbundleName` fields when present.

### Filtering, ordering, and display

- The fixed UI tags are `information`, `event`, `gacha`, `music`, `campaign`,
  `bug`, and `update`.
- The selected tag filters by `informationTag`.
- The default order is `startAt` descending.
- With `isShowSpoiler=false`, the legacy UI kept only items with `startAt <
now`; with spoilers enabled, it showed future items.
- The legacy DataGrid performed local pagination and used `autoPageSize`; there
  was no server-side pagination.
- A row displayed its start/end times, title, and an action.

### Click targets

- For `browseType === "internal"`, the legacy code used
  `https://n-production-web.sekai-en.com/` for `region=en`, and
  `https://production-web.sekai.colorfulpalette.org/` for every other region.
- An absolute `http` URL was used as-is.
- External links opened in a new window. Internal links opened in an iframe
  dialog.

The evidence above is the compatibility baseline, not a statement about the
current transport or source owner.

## Current source and API ownership

- The source data is the synced `userInformations` entity in master data.
  `sekai-master-api` owns the public API exposure, region readiness checks,
  current-record filtering, and API error responses.
- The endpoint is `GET /api/v1/game-news/{region}/list` and returns an
  `{ "items": [...] }` envelope for the requested region.
- The generated `@platform/sekai-master-api-sdk` exports
  `getGameNewsByRegionList` and the corresponding request, response, and error
  types. It is the supported consumer boundary.
- `apps/content-site` owns client-side normalization, safe target resolution,
  spoiler presentation, sorting, local pagination, and localized UI copy. Its
  server loader calls the generated operation for `/news/{region}`.
- `sekai-api` `/notifications` remains an operational banner feed and is not a
  Game News source. The historical Strapi article catalogue is a separate,
  future concern.

## Current API and SDK gap

The endpoint and generated SDK gap described by the earlier version of this
record is closed for this migration:

- `sekai-master-api` exposes `GET /api/v1/game-news/{region}/list`.
- `includeAll` is an optional boolean query parameter. The default response is
  limited to current records; `includeAll=true` returns the complete region
  dataset, including future and expired records.
- `@platform/sekai-master-api-sdk` contains the generated
  `getGameNewsByRegionList` operation and `SharedGameNews*` models.
- `content-site` uses that generated operation rather than treating a static
  region dataset as its current source boundary.

## Decision

1. The migration object is the legacy in-game Game News feed
   (`userInformations`), independently of Strapi articles and
   `sekai-api` `/notifications`.
2. `sekai-master-api` is the current API owner and exposes the synced master
   data through `GET /api/v1/game-news/{region}/list`.
3. Consumers that need the complete dataset request `includeAll=true`. The
   content-site Game News page then applies its client-side spoiler control:
   future items are hidden by default and shown when spoilers are enabled.
4. `startAt` and `endAt` use epoch-millisecond timestamps in the current
   contract. The content-site adapter normalizes and displays them without
   changing the wire contract.
5. The generated SDK is regenerated from the master API OpenAPI document; no
   hand-maintained Game News client or direct static-data transport is part of
   the current implementation.
6. Strapi article announcements remain future scope and must not define the
   current Game News contract.

## Proposed minimal Game News contract (now implemented)

The proposal in the earlier version of this record is now the deployed contract
for the Game News migration. No article-list fields or article publication
semantics are part of this contract.

### Source request and region control

- A consumer requests one supported region with
  `GET /api/v1/game-news/{region}/list`.
- The current content-site region set is `jp`, `en`, `tw`, `kr`, and `cn`.
- `includeAll` is optional and boolean. When omitted or false, the API returns
  records currently inside the server-side time window. When true, the API
  returns all records from the synced `userInformations` entity so the consumer
  can make its own spoiler decision.
- The endpoint has no locale parameter or server-side page, `pageSize`, or
  `total` pagination contract.

### Item shape and tags (implemented)

Each API item preserves these master-data fields when present:

`id`, `seq`, `displayOrder`, `informationType`, `informationTag`, `browseType`,
`platform`, `title`, `path`, `startAt`, `bannerAssetbundleName`, and `endAt`.

`informationTag` is constrained by the content-site compatibility layer to the
seven legacy values: `information`, `event`, `gacha`, `music`, `campaign`,
`bug`, and `update`.

`startAt` is an epoch-millisecond timestamp. `endAt`, when supplied, is also an
epoch-millisecond timestamp and may be null or omitted. The content-site
adapter rejects records missing invalid required compatibility fields instead
of silently presenting malformed data.

### Time window, spoiler behavior, and ordering

- The API's default (`includeAll=false`) keeps records with `startAt <= now`
  and, when `endAt` is present, `endAt > now`.
- `includeAll=true` disables that server-side current-window filtering and is
  required when the consumer needs future or expired records.
- The content-site consumer applies the legacy spoiler control locally: with
  spoilers disabled it removes items whose `startAt` is in the future; with
  spoilers enabled it retains them.
- The content-site displays `endAt` but does not apply a second expiry filter
  after requesting the complete dataset.
- The displayed result is sorted by `startAt` descending. Pagination remains
  local to the content-site page; there is no server-side pagination requirement.

### Browse type, path safety, and actions

- `browseType` and `path` are treated as untrusted source data. An internal
  path is resolved against the fixed compatibility origin for its region and
  cannot replace that origin.
- Valid HTTP(S) external targets open in a new window; valid internal targets
  open in an iframe dialog.
- `javascript:`, `data:`, `blob:`, malformed, cross-origin internal, and other
  unsafe targets remain non-openable. Unknown browse types and invalid paths do
  not fall back to unsafe navigation.

### Failure and empty states

The API and consumer distinguish successful empty data from unavailable or
invalid data:

| Condition                                                | Current result                                                  |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| Successful response with `items: []`                     | Successful empty result; render the Game News empty state       |
| Invalid request, including a non-boolean `includeAll`    | `400` API error                                                 |
| Master data disabled or region data not ready            | `503` API error                                                 |
| Master-data query failure                                | `500` API error                                                 |
| Network/API/schema failure in content-site               | Error result; do not report a successful empty result           |
| Missing consumer API configuration or unsupported region | Unavailable result                                              |
| Unsafe or invalid item target                            | Keep the item non-openable; never open it as executable content |

## Implementation slices

### 1. Master API and contract — complete

- `sekai-master-api` owns the `userInformations` read path and exposes
  `GET /api/v1/game-news/{region}/list`.
- The endpoint returns the `{ "items": [...] }` envelope, supports
  `includeAll`, applies the default current-record window, and publishes its
  OpenAPI contract with the `GameNews` response models.
- Epoch-millisecond `startAt`/`endAt` values and the preserved master-data
  fields are part of the current wire contract.

### 2. Generated SDK migration — complete

- `@platform/sekai-master-api-sdk` was regenerated from the master API OpenAPI
  document and exports `getGameNewsByRegionList` plus its Game News types.
- The SDK follows the standard cross-repository sequence:
  `mise run swagger` → `mise run dev-cluster-rebuild` →
  `mise run dev-cluster-forward` → `mise run update-sekai-master-api-sdk-local`
  → `pnpm --filter @platform/sekai-master-api-sdk check`.
- Generated SDK artifacts are not hand-edited.

### 3. `content-site` consumer and UI — complete

- The `/news/{region}` server loader calls the generated Master API operation
  and requests the complete dataset with `includeAll=true`.
- The adapter validates and normalizes the compatibility fields and
  epoch-millisecond timestamps, resolves internal/external targets safely, and
  exposes distinct ready, empty, error, and unavailable states.
- The UI preserves the seven tag filters, local spoiler control,
  `startAt`-descending order, local pagination, displayed time window, and
  internal iframe/external-window actions.
- Game News labels and navigation copy are owned by the content-site
  `@platform/i18n-source` namespaces.

### 4. Fixtures and tests — complete

- Adapter tests cover all seven tags, epoch-millisecond timestamp handling,
  region-specific request/cache identity, internal and external target
  classification, unsafe-target rejection, schema failures, and the
  empty/error/unavailable distinction.
- Fixtures cover past and future `startAt` values, nullable `endAt`, preserved
  master-data fields, internal paths for `en` and another region, and absolute
  external URLs.
- API tests cover default current-record filtering, `includeAll=true`, invalid
  query values, readiness and query errors, and field preservation.

## Future article announcements — out of scope

- The historical `sekai-strapi/api/announcement/` article catalogue is retained
  only as background. It is a different system from `userInformations` Game
  News and is not the current source or contract.
- Strapi retirement means article announcements may later be generated by
  `sekai-api` or another project. This record intentionally does not select
  their owner, URL, API placement, or concrete language matrix.
- Article-list concerns such as `page`, `pageSize`, `publishedAt`, translated
  article fallback, article categories, preview, rich text, comments, and
  publication ordering are not part of the current Game News migration.
- Do not create an article endpoint or change the Game News SDK contract for
  that future work as part of this phase.

## Open questions

1. Whether future Strapi-style article announcements need a separate owner,
   endpoint, and language contract remains open; that work is independent of
   the implemented Game News endpoint.
2. Whether a future master API revision should replace the currently permissive
   master-data item fields with stricter field-level OpenAPI types is a separate
   contract-quality question.
3. Any expansion beyond the current region set or addition of locale/article
   content requires a new API and consumer contract decision; neither is part of
   the current Game News migration.
