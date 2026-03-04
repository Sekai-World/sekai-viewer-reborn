import { client } from './client.gen';

const DEFAULT_LOCAL_BASE_URL = 'http://localhost:8080/api/v1';
const DEFAULT_TEST_BASE_URL = 'https://master-api-test.sekai.best/api/v1';
const DEFAULT_PROD_BASE_URL = 'https://master-api.sekai.best/api/v1';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

type ProcessEnv = Record<string, string | undefined>;
type ProcessLike = {
  env?: ProcessEnv;
};

const getProcessEnv = (): ProcessEnv | undefined => {
  const maybeProcess = (globalThis as { process?: ProcessLike }).process;
  return maybeProcess?.env;
};

const getConfiguredBaseUrl = (): string | undefined => {
  const value = getProcessEnv()?.SEKAI_MASTER_API_BASE_URL;

  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const isLocalBrowserHost = (): boolean => {
  const hostname = globalThis.location?.hostname;
  return typeof hostname === 'string' && LOCAL_HOSTNAMES.has(hostname);
};

const getNodeEnv = (): string | undefined => getProcessEnv()?.NODE_ENV;

const resolveDefaultBaseUrl = (): string | undefined => {
  const configuredBaseUrl = getConfiguredBaseUrl();
  if (configuredBaseUrl) {
    return configuredBaseUrl;
  }

  const nodeEnv = getNodeEnv();

  if (nodeEnv === 'test') {
    return DEFAULT_TEST_BASE_URL;
  }

  if (nodeEnv === 'production') {
    return DEFAULT_PROD_BASE_URL;
  }

  if (isLocalBrowserHost() || nodeEnv === 'development' || !nodeEnv) {
    return DEFAULT_LOCAL_BASE_URL;
  }

  return undefined;
};

const baseUrl = resolveDefaultBaseUrl();
if (baseUrl) {
  client.setConfig({ baseUrl });
}

export * from './index';
