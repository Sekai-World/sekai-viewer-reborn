import { env } from "$env/dynamic/private";

const getRequiredPrivateEnv = (name: keyof typeof env): string => {
  const rawValue = env[name];
  if (!rawValue) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = rawValue.trim();
  if (value.length === 0) {
    throw new Error(`Environment variable ${name} must not be empty.`);
  }

  return value;
};

export const getMasterApiBaseUrl = (): string =>
  getRequiredPrivateEnv("SEKAI_MASTER_API_BASE_URL");
