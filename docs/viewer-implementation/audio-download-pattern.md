# Audio Download Pattern (Server-Side Tagging)

content-site におけるサーバーサイド音声ダウンロード＆メタデータ埋め込みパターンを記録します。
現在、event BGM と music preview の 2 箇所で使用しています。

## アーキテクチャ概要

1. **クライアント** が `AudioPlayer` コンポーネント（`@platform/ui-shell`）から download option を選択
2. **サーバー側** の `+server.ts` がリモート音声を fetch、taglib-wasm でメタデータ（title, artist, cover art 等）を埋め込み、レスポンスとして返す
3. 進捗は SSE (Server-Sent Events) エンドポイントからストリーミング

## エンドポイント構成

各ダウンロード機能には 2 つの URL パス・3 つのオペレーションが必要:

| オペレーション | 役割 |
|---|---|
| `GET .../download` | 音声取得 → タグ付け → レスポンス（taskId は省略可 — 指定なしでも進捗トラッキングなしでダウンロードできる） |
| `GET .../download/progress` | SSE で進捗をストリーミング（taskId 必須） |
| `POST .../download/progress` | ダウンロードをキャンセル（taskId 必須） |

### 実装例

- Event BGM: `event/[region]/[id]/bgm/+server.ts`, `event/[region]/[id]/bgm/progress/+server.ts`
- Music: `musics/[region]/[id]/download/+server.ts`, `musics/[region]/[id]/download/progress/+server.ts`

## ダウンロード進捗インフラ

`$lib/server/download-progress.ts` が共有インフラを提供:

- `createDownloadTask(taskId)`: 新しいタスクを作成
- `updateDownloadTask(taskId, state, progress, detail)`: 進捗を更新
- `cancelDownloadTask(taskId)`: タスクをキャンセル
- `subscribeDownloadTask(taskId, callback)`: 変更を購読
- `getDownloadTaskSnapshot(taskId)`: 現在のスナップショットを取得

### 進捗ステージ

| ステージ | 説明 |
|---|---|
| `preparing` | 準備中 |
| `fetching-audio` | リモート音声を取得中 |
| `fetching-cover` | カバー画像を取得中 |
| `writing-metadata` | メタデータを書き込み中 |
| `finalizing` | ファイルを仕上げ中 |
| `done` | 完了 |
| `error` | エラー |

## taglib-wasm によるメタデータ埋め込み

### 基本フロー

```typescript
import { TagLib, type Picture } from "taglib-wasm";

// 音声バイト列へタグ付け（実際の入口は download/+server.ts を参照）
await TagLib.edit(audioBytes, async (file) => {
  const tag = file.tag();
  tag.setTitle(title);
  tag.setArtist(artist);
  tag.setAlbum(album);

  // カスタムプロパティは file.setProperty（null 不許可・string のみ）
  file.setProperty("albumArtist", albumArtist);
  file.setProperty("lyrics", lyricist); // 作詞者は lyrics キーに格納する

  // カバー画像: Picture は interface。プレーンオブジェクト + satisfies で渡す
  file.setPictures([
    {
      data: coverBytes,
      mimeType: "image/webp",
      type: "FrontCover",
      description: title
    } satisfies Picture
  ]);

  file.save();
});
```

### 注意点

- `setProperty` は `null` を受け付けない — `string` のみ。null 可能値は事前にフィルタする。
- `Picture.mimeType` は画像形式に合わせる（webp → `"image/webp"`）。
- `TagLib.edit` のコールバック外で自分でファイルを開いた場合は `file.dispose()` を必ず呼んでリソースを解放する。
- 非圧縮フォーマット（wav）でもタグは書き込めるが、ファイルサイズに注意。

## AudioPlayer コンポーネント連携

`AudioPlayer`（`@platform/ui-shell`）の download 関連 props:

```svelte
<AudioPlayer
  src={previewUrl}
  title={title}
  offset={fillerSec}   <!-- skip filler silence at start (seconds) -->
  downloadOptions={[
    { label: "MP3", href: downloadHref("mp3"), progressHref, downloadName: "song.mp3" },
    { label: "FLAC", href: downloadHref("flac"), progressHref, downloadName: "song.flac" },
    { label: "WAV", href: downloadHref("wav"), progressHref, downloadName: "song.wav" }
  ]}
  downloadName="song.mp3"
  downloadProgressMessages={{
    preparing: "...",
    fetchingAudio: "...",
    fetchingCover: "...",
    writingMetadata: "...",
    finalizing: "...",
    ready: "...",
    failed: "...",
    cancelled: "..."
  }}
  {playLabel}
  {pauseLabel}
  {downloadLabel}
  {downloadCloseLabel}
  {volumeLabel}
  {seekLabel}
  {unavailableLabel}
/>
```

### DownloadOption 型

```typescript
type DownloadOption = {
  label: string;          // UI表示ラベル ("MP3", "FLAC" 等)
  href: string;           // ダウンロードURL
  progressHref?: string;  // SSE進捗URL
  downloadName?: string;  // 保存ファイル名
};
```

### `offset` prop — filler silence skipping

`AudioPlayer` accepts an `offset` prop (default `0`) to skip silence at the start of an audio file. This is used for full (long) music previews where `MusicDetail.fillerSec` records the filler duration. Note: `fillerSec` is a music-level field in the master data API (`musics` record), not a per-vocal field — the API response places it on the music object, not on individual vocal objects.

Behavior when `offset > 0`:
- On load: Howl seeks to `offset` position after the audio is ready.
- Display time: `displayTime = rawTime - offset` (user sees 0:00 as content start).
- Display duration: `displayDuration = rawDuration - offset`.
- Seek slider: maps 0..displayDuration → offset..rawDuration internally.
- On end/stop: resets seek to `offset` so replay starts at content, not filler.
- Short previews always use offset `0` (no filler).

## i18n キー命名規約

ダウンロード関連 i18n キーは各 namespace に配置:

- `audioDownloadLabel` / `audioDownloadCloseLabel`: ダウンロードボタン・閉じる
- `audioDownloadStages.*`: 進捗メッセージ各ステージ
- `audioPlayLabel` / `audioPauseLabel` / `audioSeekLabel` / `audioVolumeLabel` / `audioUnavailableLabel`: プレイヤー操作

参照: `packages/i18n-source/content-site/event.json`, `packages/i18n-source/content-site/music.json`

## 関連ソース

- `packages/ui-shell/src/audio-player.svelte`
- `apps/content-site/src/lib/server/download-progress.ts`
- `apps/content-site/src/routes/event/[region]/[id]/bgm/+server.ts`
- `apps/content-site/src/routes/event/[region]/[id]/bgm/progress/+server.ts`
- `apps/content-site/src/lib/components/event/EventDetailBgmCard.svelte`
- `apps/content-site/src/routes/musics/[region]/[id]/download/+server.ts`
- `apps/content-site/src/routes/musics/[region]/[id]/download/progress/+server.ts`
- `apps/content-site/src/lib/components/music/MusicPreviewCard.svelte` (vocals list + preview + download combined — see below)

## Music Detail: Merged Vocals + Preview Card

Since 2026-06, the vocals info section and audio preview/download are unified into a single
`MusicPreviewCard`. Previously the vocals list (vocal type + character thumbnails) lived in a
separate card at the bottom of `MusicDetailInfoCard`, while the preview player and download
controls were in `MusicPreviewCard`. These were merged because:

- The vocal selector and the vocals list show the same data — selecting a vocal and viewing its
  info are naturally the same interaction.
- A separate vocals card added visual weight without interactivity.

### Current structure

```text
MusicPreviewCard
├── Header: "Vocals" label with microphone icon
├── If no vocals: "No vocals" message
└── If vocals exist:
    └── For each vocal:
        ├── Clickable vocal row (type + character thumbnails)
        │   ├── Selected: ring-primary highlight + chevron-up
        │   └── Unselected: hover effect + chevron-down
        └── If selected AND has audio asset:
            ├── Preview mode toggle (short / long)
            └── AudioPlayer (playback + download options)
```

### Props added (previously in InfoCard)

- `vocalLabel` — section header
- `vocalTypeLabel` — "Vocal Type" label
- `vocalCharacterLabel` — "Character" label
- `noVocalsLabel` — empty state message

### Props removed from MusicPreviewCard

- `previewTitle` (now uses `vocalLabel` as the header)
- `vocalSelectLabel` (vocal list replaced the `<select>` dropdown)

### Media Session API integration

`AudioPlayer` integrates `navigator.mediaSession` so OS-level controls (iOS Control Center, Android notification, Windows media overlay) show the now-playing track:

**New props on AudioPlayer:**
- `artworkUrl?: string` — image URL for lock screen / notification artwork (e.g. music jacket, event banner)
- `artist?: string` — artist name for OS now-playing display (fallback: `subtitle`)

**How it works:**
- `setupMediaSessionActions()` — called when the Howl instance is created; registers action handlers for `play`, `pause`, `stop`, `seekto` (delegates to existing player methods)
- `updateMediaSessionMetadata()` — sets `navigator.mediaSession.metadata = new MediaMetadata({title, artist, artwork})` from the props
- `updateMediaSessionPlaybackState()` — sets `navigator.mediaSession.playbackState` to `"playing"` or `"paused"`
- `updateMediaSessionPositionState()` — updates `navigator.mediaSession.setPositionState()` using display-time values (respects `offset`)
- `clearMediaSession()` — called on teardown; nulls metadata, clears action handlers, sets playbackState to `"none"`
- A reactive `$effect` updates metadata when `title`, `artist`, or `artworkUrl` change during playback

**Consumer wiring:**
- `MusicPreviewCard` → `AudioPlayer artworkUrl={jacketUrl} artist={composer}` — jacket from `getMusicJacketAssetURL()`, composer from `MusicDetail.composer`
- `EventDetailBgmCard` → `AudioPlayer artworkUrl={eventBannerUrl} artist={unitName}` — banner from `getEventBannerAssetURL()`, artist is the event's unit name

## Music Asset JP Server Fallback

Music audio (preview/full) and jacket assets usually share the JP server bucket across regions — the same song in EN/TW/KR typically uses the JP asset path. Only region-exclusive songs (not available in JP) need their own region's bucket.

### Helper: `getMusicAssetServer(region, availableRegions)`

Location: `apps/content-site/src/lib/assets/index.ts`

```typescript
export function getMusicAssetServer(
  region: SupportedRegion,
  availableRegions: SupportedRegion[]
): AssetServer {
  return availableRegions.includes("jp") ? "jp" : region;
}
```

### Consumers

| Consumer | How it gets `availableRegions` | What it uses `assetServer` for |
|---|---|---|
| `MusicPreviewCard` | Prop from `+page.svelte` | Preview audio URL (short/long) |
| `MusicJacketHero` | Prop from `+page.svelte` | Jacket image URL |
| `+page.svelte` | `{#await data.availableRegions}` from `+page.server.ts` | Passes to children; also uses for inline jacket URL |
| `download/+server.ts` | Fetches `getMusicsRegionsByIdAvailability` directly at request time | Audio + cover fetch URLs |

### Graceful degradation

- Download endpoint: if `getMusicsRegionsByIdAvailability` API call fails, `availableRegions` falls back to `[region]` — meaning `assetServer` = current region (no JP fallback, but still functional).
- Frontend: `availableRegions` is loaded in `+page.server.ts` and passed as a promise; components unwrap it via `{#await}`.
