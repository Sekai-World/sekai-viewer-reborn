export const SERVER_REQUEST_TIMEOUT_MS = 5_000;

export const withRequestTimeout = async <T>(request: (signal: AbortSignal) => Promise<T>): Promise<T> => {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request(controller.signal),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort();
          reject(new Error("Request timed out"));
        }, SERVER_REQUEST_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
};

type Envelope = { data?: unknown; restore?: unknown; status?: unknown };
const asObject = (value: unknown): Envelope | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Envelope : null;

export const isRestoreResponse = (response: { data?: unknown; response?: { status?: number } }): boolean => {
  if (response.response?.status === 202) return true;
  const root = asObject(response.data);
  if (root?.restore === true) return true;
  const payload = root && typeof root.status === "string" ? root.data : response.data;
  return asObject(payload)?.restore === true;
};

export const unwrapSekaiApiEnvelope = (value: unknown): unknown => {
  let payload = value;
  let envelope = asObject(payload);
  while (envelope && typeof envelope.status === "string" && "data" in envelope) {
    payload = envelope.data;
    envelope = asObject(payload);
  }
  return payload;
};
