import { env } from "$env/dynamic/private";

const removeTrailingSlashes = (value: string): string => {
  let end = value.length;

  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;

  return value.slice(0, end);
};

export const getMasterApiBaseUrl = (): string => {
  const value = env.SEKAI_MASTER_API_BASE_URL?.trim();

  if (!value) {
    throw new Error("Missing required environment variable: SEKAI_MASTER_API_BASE_URL");
  }

  return removeTrailingSlashes(value) || "/";
};
