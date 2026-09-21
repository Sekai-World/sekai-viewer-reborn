export const missionFamilies = ["storyMissions", "characterMissionV2s", "normalMissions"] as const;

export type MissionFamily = (typeof missionFamilies)[number];

export type MissionResourceBoxDetail = {
  resourceBoxId: number | null;
  resourceBoxPurpose: string | null;
  resourceId: number | null;
  resourceLevel: number | null;
  resourceQuantity: number | null;
  resourceType: string | null;
  seq: number | null;
};

export type MissionResourceBox = {
  id: number | null;
  resourceBoxPurpose: string | null;
  resourceBoxType: string | null;
  details: MissionResourceBoxDetail[];
};

export type MissionReward = {
  id: number | null;
  missionId: number | null;
  missionType: string | null;
  resourceBox: MissionResourceBox | null;
  resourceBoxId: number | null;
  resourceBoxIds: number[];
  resourceBoxPurpose: string | null;
  resourceId: number | null;
  resourceLevel: number | null;
  resourceQuantity: number | null;
  resourceType: string | null;
  seq: number | null;
  status: string | null;
};

export type Mission = {
  id: number;
  family: MissionFamily;
  characterId: number | null;
  characterMissionType: string | null;
  eventId: number | null;
  isAchievementMission: boolean | null;
  normalMissionType: string | null;
  parameterGroupId: number | null;
  progressSentence: string | null;
  requirement: number | null;
  resourceBoxId: number | null;
  rewards: MissionReward[];
  sentence: string | null;
  seq: number | null;
  storyMissionType: string | null;
};
