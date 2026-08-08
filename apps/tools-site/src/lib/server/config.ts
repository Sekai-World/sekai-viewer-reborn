import { env } from "$env/dynamic/private";

const removeTrailingSlashes = (value: string): string => {
  let normalized = value;
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return normalized;
};

export const getMasterApiBaseUrl = (): string => {
  const value = env.SEKAI_MASTER_API_BASE_URL?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SEKAI_MASTER_API_BASE_URL");
  }

  return removeTrailingSlashes(value) || "/";
};
