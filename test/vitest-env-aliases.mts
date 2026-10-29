type ViteAlias = { find: string | RegExp; replacement: string };

interface SvelteKitEnvironmentAliasOptions {
  includeAppEnvironment?: boolean;
}

export const createSvelteKitEnvironmentAliases = (
  configUrl: string,
  options: SvelteKitEnvironmentAliasOptions = {}
): ViteAlias[] => {
  const testModule = (name: string): string =>
    new URL(`./src/lib/test/${name}`, configUrl).pathname;

  return [
    ...(options.includeAppEnvironment
      ? [{ find: /^\$app\/env$/, replacement: testModule("app-environment.ts") }]
      : []),
    { find: "$app/env/public", replacement: testModule("public-env.ts") },
    { find: "$app/env/private", replacement: testModule("private-env.ts") }
  ];
};
