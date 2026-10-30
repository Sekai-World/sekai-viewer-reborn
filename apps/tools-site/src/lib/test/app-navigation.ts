import { vi } from "vitest";

export const goto = vi.fn<(url: string, options?: unknown) => Promise<void>>(async () => {});
