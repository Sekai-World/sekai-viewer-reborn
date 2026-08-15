type CardDetailCharacter = {
  id: number | null;
  firstName: string | null;
  givenName: string | null;
  unit: string | null;
};

type CardDetailSkillEffectDetail = {
  level: number;
  activateEffectDuration: number | null;
  activateEffectValue: number | null;
  activateEffectValue2: number | null;
  activateEffectValueType: string | null;
};

type CardDetailSkillEnhanceCondition = {
  id: number | null;
  seq: number | null;
  unit: string | null;
};

type CardDetailSkillEnhance = {
  activateEffectValue: number | null;
  skillEnhanceType: string | null;
  skillEnhanceCondition: CardDetailSkillEnhanceCondition | null;
};

type CardDetailSkillEffect = {
  id: number | null;
  type: string | null;
  notesJudgmentType: string | null;
  activateCharacterRank: number | null;
  activateUnitCount: number | null;
  activateLife: number | null;
  skillEnhance: CardDetailSkillEnhance | null;
  details: CardDetailSkillEffectDetail[];
};

type CardDetailSkill = {
  name: string | null;
  description: string | null;
  shortDescription: string | null;
  descriptionSpriteName: string | null;
  maxSkillLevel: number;
  effects: CardDetailSkillEffect[];
};

type CardDetail = {
  id: string;
  title: string;
  assetBundleName: string | null;
  attr: string | null;
  rarityType: string | null;
  maxLevel: number | null;
  trainingMaxLevel: number | null;
  maxSkillLevel: number;
  character: CardDetailCharacter | null;
  supportUnit: string | null;
  cardSupplyType: string | null;
  cardSupplyAssetBundleName: string | null;
  initialSpecialTrainingStatus: string | null;
  releaseAt: string | number | null;
  archivePublishedAt: string | number | null;
  seq: string | number | null;
  flavorText: string | null;
  gachaPhrase: string | null;
  skill: CardDetailSkill | null;
};

type CardParameterSet = {
  level: number;
  performance: number | null;
  technique: number | null;
  stamina: number | null;
  total: number | null;
};

type CardDetailParams = {
  parameters: CardParameterSet[];
  specialTrainingBonus: {
    performance: number;
    technique: number;
    stamina: number;
    total: number;
  };
};

type CardDetailEpisode = {
  id: string;
  title: string;
  episodeNo: number | null;
  releaseConditionType: string | null;
  releaseConditionSentence: string | null;
  performanceBonus: number;
  techniqueBonus: number;
  staminaBonus: number;
  costs: string[];
  rewards: string[];
};

type CardRelatedEvent = {
  id: string;
  title: string;
  eventType: string | null;
  assetBundleName: string | null;
  startAt: string | number | null;
  aggregateAt: string | number | null;
  closedAt: string | number | null;
  bonusRate: number | null;
  finalBonusRateMin: number | null;
  finalBonusRateMax: number | null;
  isDisplayCardStory: boolean;
};

type CardGachaBanner = {
  id: string;
  name: string | null;
  assetbundleName: string | null;
  startAt: string | number | null;
  endAt: string | number | null;
};

export type {
  CardDetail,
  CardDetailCharacter,
  CardDetailEpisode,
  CardGachaBanner,
  CardDetailParams,
  CardRelatedEvent,
  CardDetailSkill,
  CardDetailSkillEnhance,
  CardDetailSkillEnhanceCondition,
  CardDetailSkillEffect,
  CardDetailSkillEffectDetail,
  CardParameterSet
};
