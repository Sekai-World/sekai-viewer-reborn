import { env } from "$env/dynamic/private";

export const getMasterApiBaseUrl = (): string => {
  const value = env.SEKAI_MASTER_API_BASE_URL?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SEKAI_MASTER_API_BASE_URL");
  }

  return value.replace(/\/+$/, "") || "/";
};
