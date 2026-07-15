import { createClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../utils/supabase/info";

// ── Safe response normalizers ─────────────────────────────────────────────────

const safeArray = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

export function normalizeInsightsResponse(raw: any) {
  const source = raw?.insights ?? raw?.data?.insights ?? raw ?? {};
  const briefSource = source.brief && typeof source.brief === "object" && !Array.isArray(source.brief)
    ? source.brief
    : {};
  return {
    actionItems: safeArray(source.actionItems ?? source.action_items),
    waitingOn: safeArray(source.waitingOn ?? source.waiting_on),
    bills: safeArray(source.bills),
    followUps: safeArray(source.followUps ?? source.follow_ups),
    calendar: safeArray(source.calendar),
    security: safeArray(source.security),
    purchases: safeArray(source.purchases),
    brief: {
      summary: typeof briefSource.summary === "string" ? briefSource.summary : "",
      highlights: safeArray<string>(briefSource.highlights).filter((item): item is string => typeof item === "string"),
    },
  };
}

const safeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
};

export function normalizeBriefResponse(raw: any) {
  const source =
    raw?.brief ??
    raw?.dailyBrief ??
    raw?.daily_brief ??
    raw?.data?.brief ??
    raw?.data ??
    raw ??
    {};

  if (Array.isArray(source)) {
    return { summary: "", highlights: safeStringArray(source) };
  }

  if (typeof source === "string") {
    return { summary: source, highlights: [] };
  }

  const summary =
    typeof source?.summary === "string"
      ? source.summary
      : typeof source?.text === "string"
        ? source.text
        : "";

  const highlights = safeStringArray(
    source?.highlights ??
    source?.highlight ??
    source?.items ??
    source?.bullets ??
    source?.key_points
  );

  return { summary, highlights };
}

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

  try {
    localStorage.setItem("inboxos-storage-test", "working");
    console.log("InboxOS localStorage test:", localStorage.getItem("inboxos-storage-test"));
    localStorage.removeItem("inboxos-storage-test");
  } catch (error) {
    console.error("InboxOS localStorage unavailable:", error);
  }

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

export async function signOut() {
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
    "Authorization": `Bearer ${session.access_token}`,
    "apikey": publicAnonKey,
  };
}

// ── Gmail API via backend ─────────────────────────────────────────────────────

export async function syncGmail(googleProviderToken: string, userId: string) {
  if (!googleProviderToken) throw new Error("No Google provider token is available.");

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  console.log("InboxOS Gmail sync credentials:", {
    hasSupabaseSessionToken: Boolean(session.access_token),
    hasGoogleProviderToken: Boolean(googleProviderToken),
    userIdAvailable: Boolean(userId),
  });

  const response = await fetch(`${SERVER}/gmail/sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({ userId, googleProviderToken }),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    console.error("InboxOS Gmail sync HTTP failure:", {
      status: response.status,
      statusText: response.statusText,
      result,
    });
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
  const normalized = normalizeInsightsResponse(raw);
  console.log("InboxOS insight shapes:", {
    actionItems: Array.isArray(normalized.actionItems),
    waitingOn: Array.isArray(normalized.waitingOn),
    bills: Array.isArray(normalized.bills),
    followUps: Array.isArray(normalized.followUps),
    calendar: Array.isArray(normalized.calendar),
    security: Array.isArray(normalized.security),
    purchases: Array.isArray(normalized.purchases),
    briefHighlights: Array.isArray(normalized.brief?.highlights),
  });
  return normalized;
}

export async function getDailyBrief(userId: string) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${SERVER}/ai/brief/${userId}`, { headers });
  const raw = await res.json().catch(() => ({}));
  return normalizeBriefResponse(raw);
}

export async function repairAIData() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");
  const response = await fetch(`${SERVER}/ai/repair-data`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({}),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Repair failed with status ${response.status}.`);
  return result;
}

export async function archiveEmail(googleProviderToken: string, messageId: string, userId: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const res = await fetch(`${SERVER}/gmail/archive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({ googleProviderToken, message_id: messageId, user_id: userId }),
  });
  return res.json();
}

export async function markAsRead(googleProviderToken: string, messageId: string, userId: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const res = await fetch(`${SERVER}/gmail/mark-read`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({ googleProviderToken, message_id: messageId, user_id: userId }),
  });
  return res.json();
}

export async function searchEmails(googleProviderToken: string, query: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const res = await fetch(`${SERVER}/gmail/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({ googleProviderToken, query }),
  });
  return res.json();
}

export async function fetchMessageBody(googleProviderToken: string, messageId: string) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const res = await fetch(`${SERVER}/gmail/message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({ googleProviderToken, message_id: messageId }),
  });
  return res.json();
}

export async function sendReply(
  googleProviderToken: string,
  to: string,
  subject: string,
  body: string,
  threadId?: string
) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const res = await fetch(`${SERVER}/gmail/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({ googleProviderToken, to, subject, body, thread_id: threadId }),
  });
  return res.json();
}

export async function reclassifyEmails() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const response = await fetch(`${SERVER}/ai/reclassify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({}),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Reclassify failed with status ${response.status}.`);
  return result;
}

export async function regenerateInsights() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const response = await fetch(`${SERVER}/ai/regenerate-insights`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({}),
  });

  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error || `Regenerate insights failed with status ${response.status}.`);
  return result;
}

export async function aiChat(message: string, userId: string, history: any[]) {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session?.access_token) throw new Error("No Supabase session access token is available.");

  const res = await fetch(`${SERVER}/ai/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": publicAnonKey,
    },
    body: JSON.stringify({ message, user_id: userId, history }),
  });
  return res.json();
}
