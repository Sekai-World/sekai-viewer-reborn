import { env } from "$env/dynamic/private";

const removeTrailingSlashes = (value: string): string => value.replace(/\/+$/, "");

export const getMasterApiBaseUrl = (): string => {
  const value = env.SEKAI_MASTER_API_BASE_URL?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SEKAI_MASTER_API_BASE_URL");
  }

  return removeTrailingSlashes(value) || "/";
};
