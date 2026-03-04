export const supportedUiLocales = [
  "en-US",
  "en-GB",
  "ja-JP",
  "ko-KR",
  "zh-CN",
  "zh-TW"
] as const;

export type SupportedUiLocale = (typeof supportedUiLocales)[number];

export const repoLocaleByUiLocale: Record<SupportedUiLocale, string> = {
  "en-US": "en",
  "en-GB": "en",
  "ja-JP": "ja",
  "ko-KR": "ko",
  "zh-CN": "zh-CN",
  "zh-TW": "zh-TW"
};

export const themeModeLabelsByLocale: Record<
  SupportedUiLocale,
  { light: string; dark: string }
> = {
  "en-US": { light: "Light Mode", dark: "Dark Mode" },
  "en-GB": { light: "Light Mode", dark: "Dark Mode" },
  "ja-JP": { light: "ライトモード", dark: "ダークモード" },
  "ko-KR": { light: "라이트 모드", dark: "다크 모드" },
  "zh-CN": { light: "明亮模式", dark: "黑暗模式" },
  "zh-TW": { light: "明亮模式", dark: "黑暗模式" }
};

export const regionRoleLabelsByLocale: Record<
  SupportedUiLocale,
  { primary: string; secondary: string }
> = {
  "en-US": { primary: "Primary", secondary: "Secondary" },
  "en-GB": { primary: "Primary", secondary: "Secondary" },
  "ja-JP": { primary: "メイン地域", secondary: "サブ地域" },
  "ko-KR": { primary: "주 지역", secondary: "보조 지역" },
  "zh-CN": { primary: "主地区", secondary: "次地区" },
  "zh-TW": { primary: "主地區", secondary: "次地區" }
};

export const primarySecondaryLabelByLocale: Record<SupportedUiLocale, string> = {
  "en-US": "Primary|Secondary",
  "en-GB": "Primary|Secondary",
  "ja-JP": "メイン地域|サブ地域",
  "ko-KR": "주 지역|보조 지역",
  "zh-CN": "主地区|次地区",
  "zh-TW": "主地區|次地區"
};

export const noEventTextByLocale: Record<SupportedUiLocale, string> = {
  "en-US": "No current event data.",
  "en-GB": "No current event data.",
  "ja-JP": "現在のイベントデータはありません。",
  "ko-KR": "현재 진행 중인 이벤트 데이터가 없습니다.",
  "zh-CN": "暂无活动数据。",
  "zh-TW": "暫無活動資料。"
};

export const uiLocaleNameByCode: Record<SupportedUiLocale, string> = {
  "en-US": "American English",
  "en-GB": "British English",
  "ja-JP": "日本語",
  "ko-KR": "한국어",
  "zh-CN": "简体中文",
  "zh-TW": "繁體中文"
};
