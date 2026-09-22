const PATREON_HOSTS = ["patreon.com", "www.patreon.com"] as const;
const KOFI_HOSTS = ["ko-fi.com", "www.ko-fi.com"] as const;

const getApprovedProviderUrl = (
  value: string | undefined,
  allowedHosts: readonly string[]
): string | null => {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (
      url.protocol !== "https:" ||
      !allowedHosts.includes(url.hostname) ||
      url.username ||
      url.password ||
      url.port
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
};

export const getPatreonSupportUrl = (value: string | undefined): string | null =>
  getApprovedProviderUrl(value, PATREON_HOSTS);

export const getKofiSupportUrl = (value: string | undefined): string | null =>
  getApprovedProviderUrl(value, KOFI_HOSTS);
