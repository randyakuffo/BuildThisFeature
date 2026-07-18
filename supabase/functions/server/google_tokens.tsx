import * as kv from "./kv_store.tsx";

export interface GoogleTokenRecord {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  updated_at: string;
}

const TOKEN_KEY = (userId: string) => `google_tokens:${userId}`;
const EXPIRY_BUFFER_MS = 60_000;

export async function storeGoogleTokens(
  userId: string,
  accessToken: string,
  refreshToken?: string | null,
  expiresInSec = 3600,
): Promise<void> {
  const existing = (await kv.get(TOKEN_KEY(userId))) as GoogleTokenRecord | null;
  await kv.set(TOKEN_KEY(userId), {
    access_token: accessToken,
    refresh_token: refreshToken ?? existing?.refresh_token ?? null,
    expires_at: Date.now() + expiresInSec * 1000,
    updated_at: new Date().toISOString(),
  } satisfies GoogleTokenRecord);
}

export async function clearGoogleTokens(userId: string): Promise<void> {
  await kv.del(TOKEN_KEY(userId));
}

async function refreshGoogleAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number }> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured for token refresh.");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Google token refresh failed (${res.status}).`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error("Google token refresh returned no access token.");
  }

  return {
    access_token: json.access_token,
    expires_in: Number(json.expires_in) || 3600,
  };
}

export async function getValidGoogleAccessToken(userId: string): Promise<string | null> {
  const record = (await kv.get(TOKEN_KEY(userId))) as GoogleTokenRecord | null;
  if (!record?.access_token) return null;

  if (record.expires_at > Date.now() + EXPIRY_BUFFER_MS) {
    return record.access_token;
  }

  if (!record.refresh_token) {
    return record.access_token;
  }

  try {
    const refreshed = await refreshGoogleAccessToken(record.refresh_token);
    await storeGoogleTokens(userId, refreshed.access_token, record.refresh_token, refreshed.expires_in);
    return refreshed.access_token;
  } catch (error) {
    console.error("InboxOS Google token refresh failed:", error);
    return record.access_token;
  }
}

export async function resolveGoogleAccessToken(
  userId: string,
  body?: { googleProviderToken?: string; googleProviderRefreshToken?: string },
): Promise<string | null> {
  if (body?.googleProviderToken) {
    await storeGoogleTokens(userId, body.googleProviderToken, body.googleProviderRefreshToken ?? null);
  }
  return getValidGoogleAccessToken(userId);
}
