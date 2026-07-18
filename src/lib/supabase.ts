import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

export {
  normalizeEmail,
  normalizeInsightsResponse,
  normalizeBriefResponse,
  type GmailEmail,
  type Insights,
} from "./normalize";

import { normalizeInsightsResponse, normalizeBriefResponse } from "./normalize";

export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey,
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      storageKey: "inboxos-supabase-auth",
    },
  }
);

export const SERVER = `https://${projectId}.supabase.co/functions/v1/make-server-6ac207ec`;

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function signInWithGoogle() {
  const redirectTo = `${window.location.origin}/`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: [
        "openid",
        "email",
        "profile",
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.send",
      ].join(" "),
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error) {
    console.error("Google OAuth start failed:", error);
    throw error;
  }

  return data;
}

export async function clearGoogleTokens() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) return;

  await fetch(`${SERVER}/gmail/tokens`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: publicAnonKey,
    },
  }).catch((error) => {
    console.error("InboxOS clear Google tokens failed:", error);
  });
}

export async function signOut() {
  await clearGoogleTokens();
  await supabase.auth.signOut();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

// ── Auth header helper ────────────────────────────────────────────────────────

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
    apikey: publicAnonKey,
  };
}

// ── Gmail API via backend ─────────────────────────────────────────────────────

export interface GoogleSessionTokens {
  googleProviderToken?: string;
  googleProviderRefreshToken?: string | null;
}

export async function storeGoogleTokens(
  googleProviderToken: string,
  googleProviderRefreshToken?: string | null,
) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");
  if (!session.user?.id) throw new Error("No authenticated user is available.");

  const response = await fetch(`${SERVER}/gmail/store-tokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: publicAnonKey,
    },
    body: JSON.stringify({
      userId: session.user.id,
      googleProviderToken,
      googleProviderRefreshToken: googleProviderRefreshToken ?? undefined,
    }),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(result?.error || result?.message || `Store Google tokens failed with status ${response.status}.`);
  }
  return result;
}

export async function syncGmail(userId: string, tokens?: GoogleSessionTokens) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const body: Record<string, string> = { userId };
  if (tokens?.googleProviderToken) {
    body.googleProviderToken = tokens.googleProviderToken;
  }
  if (tokens?.googleProviderRefreshToken) {
    body.googleProviderRefreshToken = tokens.googleProviderRefreshToken;
  }

  const response = await fetch(`${SERVER}/gmail/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.access_token}`,
      apikey: publicAnonKey,
    },
    body: JSON.stringify(body),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.error || result?.message || `Gmail sync failed with status ${response.status}.`);
  }

  return result;
}

export async function getCachedEmails(userId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/emails/${userId}`, { headers });
  return res.json();
}

export async function getInsights(userId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/insights/${userId}`, { headers });
  const raw = await res.json().catch(() => ({}));
  return normalizeInsightsResponse(raw);
}

export async function getDailyBrief(userId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/ai/brief/${userId}`, { headers });
  const raw = await res.json().catch(() => ({}));
  return normalizeBriefResponse(raw);
}

export async function repairAIData() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${SERVER}/ai/repair-data`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Repair failed with status ${response.status}.`);
  return result;
}

export async function archiveEmail(messageId: string, userId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/gmail/archive`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message_id: messageId, user_id: userId }),
  });
  return res.json();
}

export async function markAsRead(messageId: string, userId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/gmail/mark-read`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message_id: messageId, user_id: userId }),
  });
  return res.json();
}

export async function searchEmails(query: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/gmail/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  return res.json();
}

export async function fetchMessageBody(messageId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/gmail/message`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message_id: messageId }),
  });
  return res.json();
}

export async function sendReply(
  to: string,
  subject: string,
  body: string,
  threadId?: string,
) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/gmail/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ to, subject, body, thread_id: threadId }),
  });
  return res.json();
}

export async function reclassifyEmails() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${SERVER}/ai/reclassify`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Reclassify failed with status ${response.status}.`);
  return result;
}

export async function regenerateInsights() {
  const headers = await getAuthHeaders();
  const response = await fetch(`${SERVER}/ai/regenerate-insights`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Regenerate insights failed with status ${response.status}.`);
  return result;
}

export async function aiChat(message: string, userId: string, history: { role: string; text: string }[]) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message, user_id: userId, history }),
  });
  return res.json();
}
