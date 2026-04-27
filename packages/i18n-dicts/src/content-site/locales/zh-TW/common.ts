import type { ContentSiteCommonMessages } from "../../types";

const commonZhTw: ContentSiteCommonMessages = {
  home: "首頁",
  darkmode: "外觀",
  startAt: "開始時間",
  endAt: "結束時間",
  countdownStartsIn: "距離開始",
  countdownEndsIn: "距離結束",
  eventEnded: "活動已結束",
  idLabel: "#",
  nameLabel: "名稱",
  unitLabel: "團體",
  mixedUnitLabel: "混合",
  eventTypeLabel: "活動類型",
  eventBgmTitle: "活動 BGM",
  audioPlayLabel: "播放音訊",
  audioPauseLabel: "暫停音訊",
  audioDownloadLabel: "下載",
  audioVolumeLabel: "調整音量",
  audioSeekLabel: "調整播放進度",
  audioUnavailableLabel: "暫無活動 BGM",
  audioDownloadStages: {
    preparing: "正在準備下載",
    fetchingAudio: "正在下載音訊",
    fetchingCover: "正在下載封面",
    writingMetadata: "正在寫入音訊資訊",
    finalizing: "正在整理檔案",
    ready: "下載已準備完成",
    failed: "下載失敗",
    cancelled: "下載已取消"
  },
  audioDownloadCloseLabel: "關閉下載視窗",
  bannerAltSuffix: "橫幅",
  imageUnavailable: "無可用圖片",
  noCurrentEventData: "暫無活動資料。",
  eventListTitle: "活動列表",
  eventListEmpty: "暫無活動。",
  eventListLoadingMore: "正在載入更多活動...",
  eventListLoadMoreHintDesktop: "繼續向下捲動載入更多。",
  eventListLoadMoreHintMobile: "繼續上拉載入更多。",
  eventListLoadFailed: "活動載入失敗。",
  eventListRetry: "重試",
  eventListEnd: "沒有更多活動了。",
  eventListCurrentEvent: "當前活動",
  spoilerContent: "劇透內容",
  loadingLanguagePack: "正在載入語言包...",
  eventAssetTabs: {
    banner: "橫幅",
    title: "標題",
    background: "背景",
    characters: "角色"
  },
  eventTypeValues: {
    marathon: "馬拉松",
    cheerfulCarnival: "歡樂嘉年華",
    worldLink: "世界綻放"
  },
  eventInfoTitle: "活動資訊",
  eventCountdownTitle: "活動倒數",
  debugEventJsonButton: "除錯 JSON",
  debugEventJsonTitle: "活動 JSON",
  closeLabel: "關閉",
  backToTopLabel: "回到頂部",
  settings: {
    title: "設定",
    appearance: "外觀",
    theme: "主題",
    gameContentRegion: "遊戲內容地區",
    interfaceLanguage: "介面語言",
    currentLanguage: "目前"
  },
  navigation: {
    sidebarTitle: "導航",
    database: "資料庫",
    cards: "卡牌",
    songs: "歌曲",
    events: "活動",
    virtualLives: "虛擬演出"
  },
  labels: {
    primary: "主地區",
    secondary: "次地區",
    primarySecondary: "主地區|次地區",
    timeUnit: {
      day: "天",
      hour: "時",
      minute: "分",
      second: "秒"
    }
  },
  aria: {
    switchTheme: "切換主題模式",
    switchUiLanguageCurrent: "切換介面語言。目前語言"
  },
  disclaimer:
    "本站展示的造型資料僅供研究學習用途。所有版權歸其合法所有者所有，包括但不限於 Sega、Colorful Palette 和 Crypton Future Media。本網站是一個僅用於研究目的的同人資料庫，與 Sega 或 Colorful Palette 沒有任何官方關係。",
  pageTitle: {
    eventPrefix: "活動"
  },
  themeMode: {
    light: "明亮模式",
    dark: "黑暗模式",
    auto: "自動"  },
  themeName: {
    default: "預設",
    sakura: "櫻花",
    mint: "薄荷"  }
};

export default commonZhTw;
