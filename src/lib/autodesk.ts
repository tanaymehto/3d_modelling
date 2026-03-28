import { cookies } from "next/headers";

const APS_AUTHORIZE_URL = "https://developer.api.autodesk.com/authentication/v2/authorize";
const APS_TOKEN_URL = "https://developer.api.autodesk.com/authentication/v2/token";
const APS_SCOPES = ["data:read", "data:write", "data:create", "bucket:create", "bucket:read"] as const;
const APS_COOKIE_NAME = "zennah_aps_tokens";
const APS_STATE_COOKIE = "zennah_aps_state";

type AutodeskTokenPayload = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  token_type?: string;
  scope?: string;
};

export function getAutodeskScopes() {
  return APS_SCOPES.join(" ");
}

export function getAutodeskConfig() {
  const clientId = process.env.APS_CLIENT_ID?.trim();
  const clientSecret = process.env.APS_CLIENT_SECRET?.trim();
  const callbackUrl = process.env.APS_CALLBACK_URL?.trim();

  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error("Missing Autodesk APS configuration.");
  }

  return { clientId, clientSecret, callbackUrl };
}

export function buildAutodeskAuthorizeUrl(state: string) {
  const { clientId, callbackUrl } = getAutodeskConfig();
  const url = new URL(APS_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("scope", getAutodeskScopes());
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeAutodeskCode(code: string) {
  const { clientId, clientSecret, callbackUrl } = getAutodeskConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: callbackUrl,
  });

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(APS_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`APS token exchange failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type?: string;
    scope?: string;
  };

  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    token_type: json.token_type,
    scope: json.scope,
    expires_at: Date.now() + json.expires_in * 1000,
  } satisfies AutodeskTokenPayload;
}

export async function readAutodeskTokens(): Promise<AutodeskTokenPayload | null> {
  const jar = await cookies();
  const raw = jar.get(APS_COOKIE_NAME)?.value;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as AutodeskTokenPayload;
    if (!parsed.access_token || !parsed.expires_at) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeAutodeskTokens(tokens: AutodeskTokenPayload) {
  const jar = await cookies();
  const encoded = Buffer.from(JSON.stringify(tokens), "utf8").toString("base64url");
  jar.set(APS_COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAutodeskTokens() {
  const jar = await cookies();
  jar.delete(APS_COOKIE_NAME);
  jar.delete(APS_STATE_COOKIE);
}

export async function writeAutodeskState(state: string) {
  const jar = await cookies();
  jar.set(APS_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
}

export async function readAutodeskState() {
  const jar = await cookies();
  return jar.get(APS_STATE_COOKIE)?.value ?? null;
}
