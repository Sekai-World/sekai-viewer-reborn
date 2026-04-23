import type { ContentSiteCommonMessages } from "../../types";

const commonKoKr: ContentSiteCommonMessages = {
  home: "홈",
  darkmode: "외관",
  startAt: "시작",
  endAt: "종료",
  countdownStartsIn: "시작까지",
  countdownEndsIn: "종료까지",
  eventEnded: "이벤트 종료",
  idLabel: "#",
  nameLabel: "이름",
  unitLabel: "유닛",
  mixedUnitLabel: "혼합",
  eventTypeLabel: "이벤트 타입",
  eventBgmTitle: "이벤트 BGM",
  audioPlayLabel: "오디오 재생",
  audioPauseLabel: "오디오 일시정지",
  audioDownloadLabel: "다운로드",
  audioVolumeLabel: "볼륨 조절",
  audioSeekLabel: "재생 위치 조절",
  audioUnavailableLabel: "이벤트 BGM이 없습니다",
  audioDownloadStages: {
    preparing: "다운로드 준비 중",
    fetchingAudio: "오디오 다운로드 중",
    fetchingCover: "커버 이미지 다운로드 중",
    writingMetadata: "메타데이터 작성 중",
    finalizing: "파일 마무리 중",
    ready: "다운로드 준비 완료",
    failed: "다운로드 실패",
    cancelled: "다운로드 취소됨"
  },
  audioDownloadCloseLabel: "다운로드 창 닫기",
  bannerAltSuffix: "배너",
  imageUnavailable: "사용 가능한 이미지가 없습니다",
  noCurrentEventData: "현재 진행 중인 이벤트 데이터가 없습니다.",
  eventListTitle: "이벤트 목록",
  eventListEmpty: "이벤트가 없습니다.",
  eventListLoadingMore: "이벤트를 더 불러오는 중...",
  eventListLoadMoreHintDesktop: "계속 아래로 스크롤하면 더 불러옵니다.",
  eventListLoadMoreHintMobile: "계속 위로 밀면 더 불러옵니다.",
  eventListLoadFailed: "이벤트를 불러오지 못했습니다.",
  eventListRetry: "다시 시도",
  eventListEnd: "더 이상 이벤트가 없습니다.",
  eventListCurrentEvent: "현재 이벤트",
  spoilerContent: "스포일러 콘텐츠",
  loadingLanguagePack: "언어 팩을 불러오는 중...",
  eventAssetTabs: {
    banner: "배너",
    title: "제목",
    background: "배경",
    characters: "캐릭터"
  },
  eventTypeValues: {
    marathon: "마라톤",
    cheerfulCarnival: "치어풀 카니발",
    worldLink: "월드 링크"
  },
  eventInfoTitle: "이벤트 정보",
  eventCountdownTitle: "이벤트 카운트다운",
  debugEventJsonButton: "디버그 JSON",
  debugEventJsonTitle: "이벤트 JSON",
  closeLabel: "닫기",
  backToTopLabel: "맨 위로",
  settings: {
    title: "설정",
    appearance: "외관",
    theme: "테마",
    gameContentRegion: "게임 데이터 지역",
    interfaceLanguage: "인터페이스 언어",
    currentLanguage: "현재"
  },
  navigation: {
    database: "데이터베이스",
    cards: "카드",
    songs: "곡",
    events: "이벤트",
    virtualLives: "버추얼 라이브"
  },
  labels: {
    primary: "주 지역",
    secondary: "보조 지역",
    primarySecondary: "주 지역|보조 지역",
    timeUnit: {
      day: "일",
      hour: "시",
      minute: "분",
      second: "초"
    }
  },
  aria: {
    switchTheme: "테마 모드 전환",
    switchUiLanguageCurrent: "UI 언어 변경. 현재 언어"
  },
  pageTitle: {
    eventPrefix: "이벤트"
  },
  themeMode: {
    light: "라이트 모드",
    dark: "다크 모드",
    auto: "자동"
  }
};

export default commonKoKr;
