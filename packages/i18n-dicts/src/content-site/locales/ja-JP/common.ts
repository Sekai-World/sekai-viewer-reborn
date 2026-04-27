import type { ContentSiteCommonMessages } from "../../types";

const commonJaJp: ContentSiteCommonMessages = {
  home: "ホーム",
  darkmode: "外観",
  startAt: "開始",
  endAt: "終了",
  countdownStartsIn: "開始まで",
  countdownEndsIn: "終了まで",
  eventEnded: "イベント終了",
  idLabel: "#",
  nameLabel: "名称",
  unitLabel: "ユニット",
  mixedUnitLabel: "混合",
  eventTypeLabel: "イベントタイプ",
  eventBgmTitle: "イベント BGM",
  audioPlayLabel: "音声を再生",
  audioPauseLabel: "音声を一時停止",
  audioDownloadLabel: "ダウンロード",
  audioVolumeLabel: "音量を調整",
  audioSeekLabel: "再生位置を調整",
  audioUnavailableLabel: "イベント BGM はありません",
  audioDownloadStages: {
    preparing: "ダウンロードを準備中",
    fetchingAudio: "音声をダウンロード中",
    fetchingCover: "カバー画像をダウンロード中",
    writingMetadata: "メタデータを書き込み中",
    finalizing: "ファイルを仕上げ中",
    ready: "ダウンロードの準備が完了しました",
    failed: "ダウンロードに失敗しました",
    cancelled: "ダウンロードをキャンセルしました"
  },
  audioDownloadCloseLabel: "ダウンロードウィンドウを閉じる",
  bannerAltSuffix: "バナー",
  imageUnavailable: "利用可能な画像がありません",
  noCurrentEventData: "現在のイベントデータはありません。",
  eventListTitle: "イベント一覧",
  eventListEmpty: "イベントがありません。",
  eventListLoadingMore: "イベントをさらに読み込み中...",
  eventListLoadMoreHintDesktop: "さらに下へスクロールすると読み込みます。",
  eventListLoadMoreHintMobile: "さらに上へスワイプすると読み込みます。",
  eventListLoadFailed: "イベントの読み込みに失敗しました。",
  eventListRetry: "再試行",
  eventListEnd: "これ以上イベントはありません。",
  eventListCurrentEvent: "開催中イベント",
  spoilerContent: "ネタバレ内容",
  loadingLanguagePack: "言語パックを読み込み中...",
  eventAssetTabs: {
    banner: "バナー",
    title: "タイトル",
    background: "背景",
    characters: "キャラクター"
  },
  eventTypeValues: {
    marathon: "マラソン",
    cheerfulCarnival: "チアフルカーニバル",
    worldLink: "ワールドリンク"
  },
  eventInfoTitle: "イベント情報",
  eventCountdownTitle: "イベントカウントダウン",
  debugEventJsonButton: "デバッグ JSON",
  debugEventJsonTitle: "イベント JSON",
  closeLabel: "閉じる",
  backToTopLabel: "トップへ戻る",
  settings: {
    title: "設定",
    appearance: "外観",
    theme: "テーマ",
    gameContentRegion: "ゲームデータ地域",
    interfaceLanguage: "表示言語",
    currentLanguage: "現在"
  },
  navigation: {
    sidebarTitle: "ナビゲーション",
    database: "データベース",
    cards: "カード",
    songs: "楽曲",
    events: "イベント",
    virtualLives: "バーチャルライブ"
  },
  labels: {
    primary: "メイン地域",
    secondary: "サブ地域",
    primarySecondary: "メイン地域|サブ地域",
    timeUnit: {
      day: "日",
      hour: "時",
      minute: "分",
      second: "秒"
    }
  },
  aria: {
    switchTheme: "テーマモードを切り替え",
    switchUiLanguageCurrent: "UI言語を切り替え。現在の言語"
  },
  disclaimer:
    "当サイトに撃示されているゲームコンテンツおよび素材の著作権は、Sega、Colorful Palette、Crypton Future Mediaを含む（ただしこれらに限定されない）各権利者に帰属します。当サイトは上記各社との公式な関係を一切持たないインディーペンデントなファンメイドデータベースであり、情報提供および研究・学習目的のみで運営しています。",
  pageTitle: {
    eventPrefix: "イベント"
  },
  themeMode: {
    light: "ライトモード",
    dark: "ダークモード",
    auto: "自動"
  },
  themeName: {
    default: "デフォルト",
    sakura: "さくら",
    mint: "ミント"
  },
  versionInfo: {
    title: "バージョン情報",
    appLabel: "APP",
    dataLabel: "DATA",
    assetLabel: "ASSET"
  }
};

export default commonJaJp;
