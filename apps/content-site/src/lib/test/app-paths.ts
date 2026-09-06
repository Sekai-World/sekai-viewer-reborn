export const asset = (path: string): string => path;

export const resolve = (
  route: string,
  params: Record<string, string | number | undefined> = {}
): string => {
  let resolved = route;
  for (const [key, value] of Object.entries(params)) {
    resolved = resolved.replace(`[${key}]`, String(value ?? ""));
  }
  return resolved;
};
