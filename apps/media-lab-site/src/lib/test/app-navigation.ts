import { vi } from "vitest";

export const beforeNavigate = vi.fn();
export const goto = vi.fn<(url: string | URL, options?: unknown) => Promise<void>>(async () => {});
export const refreshAll = vi.fn<() => Promise<void>>(async () => {});
