export interface OidcClientConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope?: string;
}

export function buildLoginUrl(config: OidcClientConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: config.scope ?? "openid profile email",
    state
  });

  return `${config.authority}/protocol/openid-connect/auth?${params.toString()}`;
}

export function buildLogoutUrl(config: OidcClientConfig, idTokenHint?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    post_logout_redirect_uri: config.postLogoutRedirectUri
  });

  if (idTokenHint) {
    params.set("id_token_hint", idTokenHint);
  }

  return `${config.authority}/protocol/openid-connect/logout?${params.toString()}`;
}
