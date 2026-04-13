import type { ContentSiteCommonMessages } from "../../types";

const commonKoKr: ContentSiteCommonMessages = {
  home: "홈",
  darkmode: "테마",
  startAt: "시작",
  endAt: "종료",
  countdownStartsIn: "시작까지",
  countdownEndsIn: "종료까지",
  eventEnded: "이벤트 종료",
  idLabel: "ID",
  nameLabel: "이름",
  unitLabel: "유닛",
  eventBgmTitle: "이벤트 BGM",
  audioPlayLabel: "오디오 재생",
  audioPauseLabel: "오디오 일시정지",
  audioDownloadLabel: "다운로드",
  audioVolumeLabel: "볼륨 조절",
  audioSeekLabel: "재생 위치 조절",
  audioUnavailableLabel: "이벤트 BGM이 없습니다",
  bannerAltSuffix: "배너",
  imageUnavailable: "사용 가능한 이미지가 없습니다",
  noCurrentEventData: "현재 진행 중인 이벤트 데이터가 없습니다.",
  loadingLanguagePack: "언어 팩을 불러오는 중...",
  eventAssetTabs: {
    banner: "배너",
    title: "제목",
    background: "배경",
    characters: "캐릭터"
  },
  eventInfoTitle: "이벤트 정보",
  debugEventJsonButton: "디버그 JSON",
  debugEventJsonTitle: "이벤트 JSON",
  closeLabel: "닫기",
  settings: {
    title: "설정",
    gameContentRegion: "게임 데이터 지역",
    interfaceLanguage: "인터페이스 언어"
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
