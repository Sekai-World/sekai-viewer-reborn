export const page = {
  url: new URL("http://localhost/"),
  data: {} as Record<string, unknown>
};

export const updated = {
  current: false,
  check: async (): Promise<boolean> => false
};
