import {
  SEKAI_API_BASE_URL,
  SEKAI_MASTER_API_BASE_URL,
  SEKAI_REMOTE_ASSET_BASE_URL
} from "$app/env/private";

const privateEnv = {
  SEKAI_API_BASE_URL,
  SEKAI_MASTER_API_BASE_URL,
  SEKAI_REMOTE_ASSET_BASE_URL
};

const trimTrailingSlash = (value: string): string => {
  const normalized = value.replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : "/";
};

const getRequiredPrivateEnv = (name: keyof typeof privateEnv): string => {
  const rawValue = privateEnv[name];
  if (!rawValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = rawValue.trim();
  if (value.length === 0) {
    throw new Error(`Environment variable ${name} must not be empty.`);
  }

  return trimTrailingSlash(value);
};

const getOptionalPrivateEnv = (name: keyof typeof privateEnv): string | null => {
  const rawValue = privateEnv[name];
  if (!rawValue) {
    return null;
  }

  const value = rawValue.trim();
  if (value.length === 0) {
    return null;
  }

  return trimTrailingSlash(value);
};

export const getMasterApiBaseUrl = (): string => getRequiredPrivateEnv("SEKAI_MASTER_API_BASE_URL");

export const getSekaiApiBaseUrl = (): string => getRequiredPrivateEnv("SEKAI_API_BASE_URL");

export const getInternalRemoteAssetBaseUrl = (): string | null =>
  getOptionalPrivateEnv("SEKAI_REMOTE_ASSET_BASE_URL");
