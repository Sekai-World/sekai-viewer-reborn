import { getSekaiApiBaseUrl } from "./config";

const normalizeApiPath = (path: string): string => path.trim().replace(/^\/+/, "");

export const buildSekaiApiUrl = (path: string): string => {
  const normalizedPath = normalizeApiPath(path);
  const baseUrl = getSekaiApiBaseUrl();

  return normalizedPath ? `${baseUrl}/${normalizedPath}` : baseUrl;
};

export const fetchSekaiApiJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(buildSekaiApiUrl(path), init);

  if (!response.ok) {
    throw new Error(`Sekai API request failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
};
