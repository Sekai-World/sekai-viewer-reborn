export const asset = (path: string): string => `/${path.startsWith("/") ? path.slice(1) : path}`;
