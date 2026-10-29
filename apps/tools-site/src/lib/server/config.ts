import { SEKAI_MASTER_API_BASE_URL, SEKAI_API_BASE_URL } from "$app/env/private";

const removeTrailingSlashes = (value: string): string => {
  let normalized = value;
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
};

const normalizeSekaiApiBaseUrl = (value: string): string => {
  const normalized = removeTrailingSlashes(value);
  return normalized.endsWith("/api") ? normalized.slice(0, -4) : normalized;
};

export const getMasterApiBaseUrl = (): string => {
  const value = SEKAI_MASTER_API_BASE_URL?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SEKAI_MASTER_API_BASE_URL");
  }

  return removeTrailingSlashes(value) || "/";
};

export const getSekaiApiBaseUrl = (): string => {
  const value = SEKAI_API_BASE_URL?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SEKAI_API_BASE_URL");
  }

  return normalizeSekaiApiBaseUrl(value) || "/";
};
