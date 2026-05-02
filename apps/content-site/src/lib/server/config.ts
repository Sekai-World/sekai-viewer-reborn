import { env } from "$env/dynamic/private";

const trimTrailingSlash = (value: string): string => {
  const normalized = value.replace(/\/+$/, "");
  return normalized.length > 0 ? normalized : "/";
};

const getRequiredPrivateEnv = (name: keyof typeof env): string => {
  const rawValue = env[name];
  if (!rawValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = rawValue.trim();
  if (value.length === 0) {
    throw new Error(`Environment variable ${name} must not be empty.`);
  }

  return trimTrailingSlash(value);
};

const getOptionalPrivateEnv = (name: keyof typeof env): string | null => {
  const rawValue = env[name];
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
