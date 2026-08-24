export type UnitMemberNameParts = {
  gameCharacterId: number;
  firstName: string | null;
  givenName: string | null;
  firstNameEnglish: string | null;
  givenNameEnglish: string | null;
};

export const formatUnitMemberName = (member: UnitMemberNameParts): string =>
  [member.firstName, member.givenName].filter(Boolean).join(" ") ||
  [member.firstNameEnglish, member.givenNameEnglish].filter(Boolean).join(" ") ||
  `#${member.gameCharacterId}`;
