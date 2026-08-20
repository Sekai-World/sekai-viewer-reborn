export type UnitIconBadgeVariant = "sm" | "default" | "lg";

export type UnitIconResolver = (unit: string, mapNoneToPiapro?: boolean) => string | null;

export type UnitColorResolver = (
  unit: string,
  mapNoneToPiapro?: boolean
) => string | null | undefined;
