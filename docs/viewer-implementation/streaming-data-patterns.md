# Streaming Data Patterns (SvelteKit + Svelte 5)

content-site のリストページにおける Streaming Promise + Skeleton 表示パターン、
および Svelte 5 `$effect` で遭遇した落とし穴と回避策を記録します。

## アーキテクチャ概要

4つのリストページ (cards, events, gachas, musics) はすべて同じパターンを採用しています:

1. **Server load** は `initialPage` を未解決の Promise として返す (streaming)
2. これにより、SvelteKit は Promise が解決する前にページシェルを送信できる
3. **Page component** は `$effect` 内で Promise に `.then(applyInitialPage)` をアタッチする
4. **Skeleton** がデータ到着まで即座に表示される
5. Promise 解決後にリアクティブ state にデータが書き込まれ、Skeleton が実際のコンテンツに
   切り替わる

### Streaming list payloads

Streaming sends the shell early, but the skeleton remains until the list API
promise resolves. Keep list endpoints as card projections rather than reusing
detail responses: list-only nested joins and large payloads directly delay that
transition. For example, `/virtualLives/{region}/list` returns only `id`,
`name`, `assetbundleName`, `virtualLiveType`, `startAt`, and `endAt`; reward and
related-entity enrichment belongs to the by-id endpoint. Source:
`sekai-master-api/internal/transport/http/handlers/virtuallives/virtual_live_handler.go`
(`buildVirtualLiveListItem`, updated 2026-07-27).

### Server 側のコード構造

```typescript
// +page.server.ts
export const load = async ({ ... }): Promise<PageData> => {
  const initialQuery = parseQueryState(url);
  const filterMeta = await fetchFilterMeta(); // 同期取得

  const initialPage = fetchInitialPage(region, queryState)
    .then((page) => ({ page, loadFailed: false }))
    .catch(() => ({ page: emptyPage, loadFailed: true }));

  // 意図的に await しない — streaming
  initialPage.catch(() => {}); // unhandled rejection 防止の nop

  return { initialPage, initialQuery, filterMeta, ... };
};
```

### Page 側のコード構造

```svelte
<script lang="ts">
  let isInitialLoading = $state(true);
  let items = $state<ItemType[]>([]);

  type InitialPageResult = { page: PagePayload; loadFailed: boolean };

  const applyInitialPage = (result: InitialPageResult): void => {
    items = result.page.items;
    // フィルタ/ソート状態の初期化もここで (see pitfall below)
    isInitialLoading = false;
  };

  $effect(() => {
    const streaming = data.initialPage as unknown as Promise<InitialPageResult>;
    streaming.then(applyInitialPage);
  });
</script>

{#if isInitialLoading}
  <!-- 12個の skeleton カード -->
{:else}
  <!-- 実際のコンテンツ -->
{/if}
```

## ⚠️ 重要な落とし穴: `$effect` 内でのリアクティブ状態書き込み

### 現象

`effect_update_depth_exceeded` ランタイムエラー。ページが Skeleton から
抜け出せず、コンソールに 16件の "updated at" エラーが繰り返し出力される。

### 原因

フィルタ状態 (`sortBy`, `sortOrder`, `nameFilter` 等) を `$effect` 内で
`data.initialQuery` から初期化すると、書き込んだリアクティブ変数が
`$effect` の依存関係として追跡され、effect が自己再起動 → 無限ループになる。

```svelte
<!-- ❌ これをやってはいけない -->
$effect(() => {
  sortBy = data.initialQuery.sortBy;        // ← 書き込みが effect を再トリガー
  sortOrder = data.initialQuery.sortOrder;  // ← 同上
  nameFilter = data.initialQuery.name;      // ← 同上
});
```

### 解決策

フィルタ・ソート初期化は `applyInitialPage()` 内で行う。
`applyInitialPage` は Promise の `.then()` コールバックであり、
`$effect` ではないため、リアクティブ書き込みが自己ループを起こさない。

```svelte
<!-- ✅ 正しい: applyInitialPage 内で初期化 -->
const applyInitialPage = (result: InitialPageResult): void => {
  items = result.page.items;

  sortBy = data.initialQuery.sortBy;
  sortOrder = data.initialQuery.sortOrder;
  nameFilter = data.initialQuery.name;
  // ... 他のフィルタ ...

  isInitialLoading = false;
};
```

### なぜ `data.initialQuery` は applyInitialPage 内で安全に参照できるか

`data.initialQuery` は server load から同期的に返される値 (Promise ではない)
なので、Promise が解決した時点で既に利用可能。

## Type Safety ノート

SvelteKit は生成する `PageData` 型において `Awaited<T>` を適用するため、
`data.initialPage` の型は Promise ではなく既にアンラップされた値の型に
なってしまう。実行時には Promise だが型チェッカは解決済み値の型を期待するため、以下のキャストが必要:

```typescript
const streaming = data.initialPage as unknown as Promise<InitialPageResult>;
```

これに伴い、`PageData["initialPage"]` から Result 型を導出できない。
代わりに、`$lib/server/*-list` モジュールから直接型を import する。

## Streaming i18n Messages

### Problem

`+layout.server.ts` previously `await`ed `loadI18nMessageBundle()`, which meant the
entire SSR response was blocked until i18n messages were fetched from the remote CDN.
This caused a ~1s blank page on first visit (no HTML shell sent until all layout data
resolved). On revisit, client-side cache made it fast enough to hide the problem.

### Solution: Stream i18n as an Unresolved Promise

Same streaming pattern as `initialPage`, applied to layout-level i18n:

1. **`+layout.server.ts`** returns `i18nMessages` as an unresolved Promise (no `await`)
2. **`resolveStreamingMessages()`** in `$lib/i18n/runtime.ts` detects runtime Promise
   and returns synchronous English source messages for the route's explicit namespace
   set as immediate fallback — the HTML shell renders without blocking. Rendering
   translators are pure and do not mutate global `svelte-i18n` state.
3. **`$effect` blocks** in page components re-run automatically when the streaming
   promise resolves, updating labels with full remote translations in place

### Server Side

```typescript
// +layout.server.ts
export const load = async ({ locals }): Promise<LayoutData> => {
  const i18nMessages = loadI18nMessageBundle(locale); // NO await — streaming
  i18nMessages.catch(() => {}); // prevent unhandled rejection

  return { i18nMessages, uiLocale: locale };
};
```

### Helper: resolveStreamingMessages

```typescript
// $lib/i18n/runtime.ts
export const resolveStreamingMessages = (
  messagesOrPromise: I18nMessages | Promise<I18nMessages>
): I18nMessages => {
  if (messagesOrPromise instanceof Promise) {
    return allLocalSourceMessages; // sync fallback from bundled English sources
  }
  return messagesOrPromise;
};
```

The parameter type must be `I18nMessages | Promise<I18nMessages>` because
SvelteKit's type generation applies `Awaited<T>` to streaming fields, so the
declared type is `I18nMessages` but the runtime value is `Promise<I18nMessages>`.
Without the union type, the type checker rejects calls passing `data.i18nMessages`.

### Consumer Pattern

Rendering call sites may pass `resolveStreamingMessages(data.i18nMessages)` to
`createI18nTranslator()` for an immediate English fallback. Do not pass that fallback
to `setI18nLocale()`: it updates module-global svelte-i18n state. Async locale refreshes
must first await the streamed bundle and register the resolved remote messages:

```typescript
// Import
import { createI18nTranslator, resolveStreamingMessages, setI18nLocale, tCommon } from "$lib/i18n/runtime";

// Initial translation (sync — uses local English sources if still streaming)
const getInitialI18nText = (key: string): string =>
  createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages))(key);

// $effect (re-runs with full translations once streaming promise resolves)
$effect(() => {
  const translate = createI18nTranslator(data.uiLocale, resolveStreamingMessages(data.i18nMessages));
  applyTranslations(translate);
});

// Async refresh — await before global registration
const refreshTranslations = async (locale: string): Promise<void> => {
  const messages = await data.i18nMessages;
  const resolvedLocale = await setI18nLocale(locale, messages);
  // ...
};
```

### Affected Files

Every page component under `apps/content-site/src/routes/` that consumes
`data.i18nMessages`:

- `+layout.svelte`, `+error.svelte`
- `+page.svelte` (home)
- `cards/[region]/+page.svelte`
- `events/[region]/+page.svelte`
- `musics/[region]/+page.svelte`
- `gachas/[region]/+page.svelte`
- `card/[region]/[id]/+page.svelte`
- `event/[region]/[id]/+page.svelte`
- `gacha/[region]/[id]/+page.svelte`

## ⚠️ 落とし穴 #2: `applyInitialPage` と `$effect` の競合状態

### 現象

カード一覧ページで、パンくずナビゲーションで詳細ページから戻ると、一覧が
「未找到卡片」(カードなし) と表示され、データが読み込まれない。
`showSpoilerContent=true` (localStorage 設定) のユーザーで特に再現しやすい。
同じ競合は音楽一覧にも起きる。初期 URL に `spoiler=true` がなく、
localStorage では spoiler 表示が有効な場合、ページ内で設定を切り替えるまで
未来公開曲が表示されない。

### 原因

`$effect` 内で `reloadFirstPage()` を呼び出す複数の effect が
`applyInitialPage` の Promise `.then()` コールバックと同時に実行され、
互いの state 書き込みが競合する:

1. **Spoiler effect**: `spoilerContentAppliedState` の変化で
   `reloadFirstPage()` を即座に呼び出す
2. **Persisted-filters effect**: localStorage からのフィルタ復元で
   `reloadFirstPage()` を即座に呼び出す
3. **`applyInitialPage`**: `.then()` コールバックでサーバー既定値に
   フィルタ状態をリセットする

競合シナリオ (例: spoiler):

1. spoiler effect → `spoilerFilter = true` → `reloadFirstPage()` 開始
   (isLoading=true, fetch 開始)
2. `applyInitialPage` → サーバー既定値で `spoilerFilter = false` に上書き
3. `reloadFirstPage` fetch 完了 → `spoilerFilter` はすでに `false` に
   上書きされている → URL パラメータとデータの不整合 → 空のカード一覧

音楽一覧では同じ race により、先に開始した `spoiler=true` の再取得より後から
初期 `spoiler=false` の `applyInitialPage` が state を戻し、保存済み設定が初回表示に
反映されない。

### 解決策: `applyInitialPage` を単一の初期化箇所にする

すべての初期化後処理 (フィルタ復元、spoiler 同期) を
`applyInitialPage` 内で順次実行する。`$effect` は初期マウント時は
スキップし、ユーザー操作による**その後の変更**のみを処理する。

```svelte
<!-- ✅ applyInitialPage 内で順次処理 -->
const applyInitialPage = (result: InitialPageResult): void => {
  items = result.page.items;
  // ... フィルタ状態をサーバー既定値で初期化 ...
  isInitialLoading = false;
  hasTriedRestorePersistedFilters = true;

  let needsReload = false;

  // フィルタ復元 (URL に明示的なクエリがない場合のみ)
  if (browser && !hasExplicitQueryStateInUrl()) {
    if (restorePersistedFilters()) {
      persistAppliedFilters();
      needsReload = true;
    }
  }

  // spoiler 同期 (ユーザー設定とサーバー既定値が異なる場合)
  if (browser) {
    const userWantsSpoilers = contentDisplaySettings.showSpoilerContent;
    if (userWantsSpoilers !== spoilerFilter) {
      spoilerFilter = userWantsSpoilers;
      needsReload = true;
    }
    spoilerContentAppliedState = userWantsSpoilers;
  }

  if (needsReload) {
    void reloadFirstPage();
  }
};

<!-- ✅ spoiler effect は初期マウント時はスキップ -->
$effect(() => {
  if (!browser) return;
  const isInitialSpoilerState = spoilerContentAppliedState === null;
  if (isInitialSpoilerState) return; // ← applyInitialPage に任せる
  // ... ユーザーがその後設定を変更した場合の処理 ...
});
```

### Additional pattern: discard stale results with route identity and request tokens

SvelteKit reuses the same page component instance when only a route parameter
changes, for example `/events/[region]`. During rapid region switching, an older
`data.initialPage` streaming promise or `reloadFirstPage()` / `loadNextPage()`
fetch can resolve after the route has already moved to another region. Without a
guard, that stale result can overwrite the current region's `items`, pagination,
or loading state.

`apps/content-site/src/routes/events/[region]/+page.svelte` uses this pattern:

1. Build the current list identity from `region + sort/filter + spoiler` state.
2. When `data.initialPage` changes, immediately reset list state (`items`,
   pagination, loading/error state, and touch/load-more hint state), then advance
   both an `initialPageRequestId` and a list request token.
3. `loadNextPage()` and `reloadFirstPage()` capture the request token and list
   identity at request start; when the request finishes, they update state only
   if both still match the current route state.
4. If `reloadFirstPage()` completes before the streamed `initialPage` and thereby
   invalidates it, it must also set `isInitialLoading = false` so the page can
   leave the skeleton state.
5. Key `{#each}` blocks by `${region}:${item.id}`, not only `item.id`. Event IDs
   overlap across regions, so the region must be part of the key to avoid reusing
   card, lazy-image observer, and hover-listener state across different region
   datasets.

This keeps stale async results out of the active DOM during repeated region
switching and lets `EventAssetImage` IntersectionObservers and `EventCardFrame`
media-query listeners be released through normal component teardown.

### Other list pages affected

Events, gachas, and musics use the same broad pattern (streaming Promise +
`$effect` + localStorage settings) and may have the same race risk. Audit each
page's `applyInitialPage` and `$effect` ordering before adding region/query
switching behavior.

## Pitfall #3: Two-Step Spoiler Card Interaction

### Problem

Spoiler cards (cards whose `releaseAt` is in the future) are wrapped in `<a>`
tags that navigate to the card detail page. When `mosaickedSpoilerContent` is
enabled, a single click both reveals the spoiler **and** navigates away — the
user never gets a chance to see the revealed content before leaving the list
page.

### Solution: `handleCardClick` with `event.preventDefault()`

The two-step pattern (already used by `EventListCard` + `EventCardFrame`) is:

1. The card component mounts `onclick={handleCardClick}` on its root element
2. `handleCardClick` checks `isSpoilerContentMosaicked()`:
   - **If mosaicked** → `event.preventDefault()` cancels the ancestor `<a>`
     navigation, then calls `revealSpoiler()` to remove the overlay
   - **If not mosaicked** → does nothing; the `<a>` navigates normally
3. On the second click, the spoiler is already revealed, so
   `isSpoilerContentMosaicked()` returns false and the `<a>` navigates

Key detail: `event.preventDefault()` on a **descendant** element cancels the
ancestor `<a>` tag's default navigation action. The component does not need
to own the `<a>` tag — it just needs to intercept the click before the
browser follows the link.

### Code Pattern

```svelte
<!-- Inside list card component (e.g., CardListCard.svelte) -->

<script lang="ts">
  const handleCardClick = (event: MouseEvent): void => {
    if (!isSpoilerContentMosaicked()) {
      return; // Not a spoiler → let the <a> navigate
    }

    event.preventDefault(); // Block <a> navigation
    revealSpoiler();       // Remove mosaic overlay
  };
</script>

<div onclick={handleCardClick}>
  <!-- card content -->
</div>
```

```svelte
<!-- Parent page wraps in <a> — no special handling needed -->
<a href={getCardDetailHref(item)}>
  <CardListCard {item} ... />
</a>
```

### Components Using This Pattern

- `EventListCard.svelte` → `handleCardClick` on `EventCardFrame` (owns `<a>`)
- `CardListCard.svelte` → `handleCardClick` on root `<div>` (ancestor `<a>`)
- `GachaListCard.svelte` → `handleCardClick` on `EventCardFrame` (owns `<a>`)

### 影響を受ける他のリストページ

musics ページには spoiler mosaic がないため、このパターンの適用は不要。

## 関連ソース

- `apps/content-site/src/routes/cards/[region]/+page.server.ts`
- `apps/content-site/src/routes/cards/[region]/+page.svelte`
- `apps/content-site/src/routes/events/[region]/+page.server.ts`
- `apps/content-site/src/routes/events/[region]/+page.svelte`
- `apps/content-site/src/routes/gachas/[region]/+page.server.ts`
- `apps/content-site/src/routes/gachas/[region]/+page.svelte`
- `apps/content-site/src/routes/musics/[region]/+page.server.ts`
- `apps/content-site/src/routes/musics/[region]/+page.svelte`

## Pitfall #4: @iconify/svelte CDN fetch 延迟导致工具栏图标空白

### 症状

列表页的排序、视图切换、筛选按钮在首次访问时只显示边框/空按钮，
图标要等几百毫秒后才出现，视觉上看起来像是"等数据加载完才出图标"。

### 原因

`@iconify/svelte` v5 默认从 Iconify CDN 异步获取 SVG 图标数据。
首次访问（无浏览器缓存）时，`<Icon icon="mdi:clock-outline" />` 在 CDN
响应到达前不渲染任何可见内容，按钮内为空白。

**图标加载与列表数据加载是两个独立的异步操作，互不依赖。** 看起来
"图标等数据才出来"是因为两者延迟量级相近（都在数百 ms ~ 数秒），
恰好在差不多的时间到达，造成了视觉上的假性关联。实际时序：

1. 页面 shell 到达 → toolbar DOM 立即渲染（按钮框可见，图标位置空白）
2. Iconify 发起 CDN 请求 → CDN 响应到达 → 图标渲染
3. streaming Promise resolve → skeleton 消失，列表数据填入

步骤 2 和 3 是并行的，步骤 2 不等步骤 3。

### 修复

1. 安装 `@iconify-icons/mdi`（离线图标数据包）：
   `pnpm add -D @iconify-icons/mdi --filter @apps/content-site`

2. 创建集中注册模块 `src/lib/icons/mdi.ts`：
   - 从 `@iconify-icons/mdi` 导入每个使用中的图标数据对象
   - 用 `addIcon("mdi:<name>", data)` 注册到 `@iconify/svelte` 的内部缓存
   - 模块顶层执行注册（side-effect import）

3. 在 `+layout.svelte` 最早引入：
   `import "$lib/icons/mdi";`
   确保 `@iconify/svelte` 渲染 `<Icon>` 时数据已存在于缓存中。

### 效果

- 所有已注册图标同步渲染，零 CDN 请求
- 工具栏图标在页面骨架阶段就已可见
- 添加新图标只需在 `mdi.ts` 中追加 import + addIcon 行

### 注意

- `@platform/ui-shell` 使用的图标（`mdi:menu`, `mdi:earth`, `mdi:close` 等）
  也需注册在 content-site 的 `mdi.ts` 中，因为 `addIcon` 是应用级单例
- 新增 `mdi:*` 图标时务必同步更新 `src/lib/icons/mdi.ts`，否则该图标
  仍会回退到 CDN 获取

### 关键源文件

- `apps/content-site/src/lib/icons/mdi.ts` — 离线图标注册
- `apps/content-site/src/routes/+layout.svelte` — 侧边导入 mdi.ts

## Pitfall #5: cardParameters format differs by region (JP vs TW/KR/CN)

### Symptom

Card detail page (`/card/[region]/[id]`) shows "暂无属性数据" (no attribute data)
for TW/KR/CN regions, while JP cards render attributes correctly.

### Root Cause

The sekai-master-api `/cards/:region/:id/detail` endpoint returns `cardParameters`
in two different shapes depending on the region:

- **JP**: array of objects — `[{cardId, cardLevel, cardParameterType, power}]`
- **TW/KR/CN**: dict of arrays — `{param1: [power_at_level_1, ...], param2: [...], param3: [...]}`

In the dict format, each key (`param1`/`param2`/`param3`) maps to an array where
`array[level - 1]` gives the power value for that level. So `param1[0]` = level 1
performance power, `param1[49]` = level 50 performance power.

The backend divergence comes from `card_handler.go` `buildCardParams`:
JP cards lack embedded `cardParameters`, so the handler falls back to
`Search("cardparameters")` which returns array-of-objects; TW/KR/CN cards have
`cardParameters` embedded directly in the compact dict format.

### Fix

`parseCardDetailParams` must detect which format the payload contains and
handle both:

```typescript
if (Array.isArray(cardParamsValue)) {
  // JP format: iterate objects with cardLevel/cardParameterType/power
} else if (cardParamsValue !== null && typeof cardParamsValue === "object") {
  // TW/KR/CN format: read param1/param2/param3 arrays, index = level - 1
}
```

### Key Files

- `apps/content-site/src/lib/server/card-detail.ts` — `parseCardDetailParams` (frontend parser)
- `sekai-master-api/internal/transport/http/handlers/cards/card_handler.go` L1190-1234 — `buildCardParams` (backend source of divergence)
- `apps/content-site/src/routes/card/[region]/[id]/+page.server.ts` — server load function

### Note

Other card detail parsers (episodes, events, gachas) extract arrays via
`parseLooseItemList` and are not affected by this region format difference.
Only `cardParameters` has this dual-format issue.

### Pitfall #6: Millisecond timestamps vs seconds — formatDate `* 1000`

The sekai-master-api returns all timestamps as **milliseconds** (e.g. `1667199600000`
= 2022-10-31). The `CardDetailGachaCard.svelte` `formatDate` function originally did
`new Date(ts * 1000)`, doubling the scale and producing dates in year ~57488.

The events card (`CardDetailEventsCard.svelte`) correctly used
`formatDisplayDateTime(timestampMs)` which treats values as ms — no `* 1000`.

**Rule**: All timestamps from sekai-master-api are ms. Never multiply by 1000.
If a date renders as year > 9999, check for a `* 1000` in `new Date()`.

**Fixed**: `CardDetailGachaCard.svelte` L36: `new Date(ts)` instead of
`new Date(ts * 1000)`.

**Scope**: Searched all `.svelte` and `.ts` files in `apps/content-site/src` —
no other `new Date(.*\* 1000)` patterns found.

### Pitfall #7: Homepage Latest Data — region-indexed Promise arrays

The homepage `+page.server.ts` returns `latestData` as an array of Promises
(one per supported region), matching the `cards` pattern. The page component
uses a `$derived` to compute the array index from the user's region selection,
then `{#await}` on that single Promise.

Key design decisions:
- All SDK list endpoints (`getCardsByRegionList`, `getMusicsByRegionList`,
  `getGachasByRegionList`) support `spoiler: false` to exclude spoiler content.
- Sort by `releaseAt`/`publishedAt`/`startAt` descending, `page_size` small
  (3 cards, 3 songs, 2 gachas) to keep the section lightweight.
- Card thumbnails use `server="jp"` because only the JP bucket has card images
  (same rule as `GachaDetailPickupCard.svelte` and `GachaSimulatorCard.svelte`).
- `getGachaBannerAssetURL` takes `gachaId` (not `assetBundleName`) as its first
  argument; `getCardThumbnailAssetURL` and `getMusicJacketAssetURL` take
  `assetBundleName`.
- Parsers (`parseLatestCard`, `parseLatestMusic`, `parseLatestGacha`) use the
  existing `getString`/`getStringLike`/`getDateValue`/`getObject`/`getNestedObject`
  helpers for safe `unknown`→typed extraction from SDK responses.

**Source**: `apps/content-site/src/routes/+page.server.ts`, `+page.svelte`
