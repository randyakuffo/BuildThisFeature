import { Hono } from "npm:hono";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js";
import * as kv from "./kv_store.tsx";

const app = new Hono();
const BASE = "/make-server-6ac207ec";

// ── Safe type helpers ─────────────────────────────────────────────────────────

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeInsights(raw: any) {
  const source = raw?.insights ?? raw ?? {};
  const rawBrief = source.brief ?? source.daily_brief ?? {};
  return {
    actionItems: asArray(source.actionItems ?? source.action_items),
    waitingOn: asArray(source.waitingOn ?? source.waiting_on),
    followUps: asArray(source.followUps ?? source.follow_ups),
    bills: asArray(source.bills),
    calendar: asArray(source.calendar),
    security: asArray(source.security),
    purchases: asArray(source.purchases),
    brief: {
      summary: asString(rawBrief?.summary),
      highlights: asArray<string>(rawBrief?.highlights).filter((item): item is string => typeof item === "string"),
    },
  };
}

function normalizeClassification(raw: any, email: any) {
  const allowedCategories = ["Work", "Personal", "Finance", "Purchases", "Travel", "Newsletter", "Security", "Calendar", "Other"];
  const allowedPriorities = ["High", "Medium", "Low"];
  const allowedStatuses = ["Needs Reply", "Action Required", "Waiting", "Information", "No Action"];
  return {
    id: asString(raw?.id, email.id),
    category: allowedCategories.includes(raw?.category) ? raw.category : (email.category || "Other"),
    priority: allowedPriorities.includes(raw?.priority) ? raw.priority : (email.isImportant ? "High" : "Medium"),
    status: allowedStatuses.includes(raw?.status) ? raw.status : "Information",
    aiSummary: asString(raw?.aiSummary ?? raw?.ai_summary, email.snippet || email.subject || ""),
    requiresReply: asBoolean(raw?.requiresReply ?? raw?.requires_reply),
    actionItems: asArray<string>(raw?.actionItems ?? raw?.action_items).filter((item): item is string => typeof item === "string"),
    dueDate: typeof (raw?.dueDate ?? raw?.due_date) === "string" ? (raw?.dueDate ?? raw?.due_date) : null,
    confidence: Math.max(0, Math.min(1, asNumber(raw?.confidence))),
  };
}

// ── Cost controls ─────────────────────────────────────────────────────────────
const MAX_EMAILS_PER_SYNC = 50;
const CLASSIFICATION_BATCH_SIZE = 10;
const MAX_BODY_CHARS = 3000;
const MAX_INSIGHT_EMAILS = 50;
const MAX_CHAT_CONTEXT_EMAILS = 20;

// ── Model constants ───────────────────────────────────────────────────────────
const GROQ_CLASSIFICATION_MODEL =
  Deno.env.get("GROQ_CLASSIFICATION_MODEL") || "llama-3.3-70b-versatile";
const GEMINI_REASONING_MODEL =
  Deno.env.get("GEMINI_REASONING_MODEL") || "gemini-2.5-flash";

// ── CORS ──────────────────────────────────────────────────────────────────────
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

app.use("*", logger(console.log));
app.options("/*", (c) => new Response("ok", { headers: corsHeaders }));
app.use("/*", async (c, next) => {
  await next();
  Object.entries(corsHeaders).forEach(([k, v]) => c.res.headers.set(k, v));
});

app.get(`${BASE}/health`, (c) => c.json({ status: "ok" }));

// ── Auth ──────────────────────────────────────────────────────────────────────
async function validateSupabaseUser(authHeader: string | null) {
  if (!authHeader) return { user: null, error: "Missing Supabase authorization header." };
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnonKey) return { user: null, error: "Server configuration error." };
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { user: null, error: "Invalid Supabase user session." };
  console.log("InboxOS Edge Function auth:", { authenticatedUser: Boolean(user) });
  return { user, error: null };
}

// ── AI Provider Types ─────────────────────────────────────────────────────────
type AIProviderName = "groq" | "gemini" | "fallback";

interface AIRequestOptions {
  task: "email_classification" | "insight_generation" | "daily_brief" | "assistant_chat" | "thread_summary";
  systemPrompt: string;
  userPrompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
}

interface AIResult<T> {
  success: boolean;
  provider: AIProviderName;
  model: string;
  data: T | null;
  error: string | null;
  fallbackUsed: boolean;
}

interface NormalizedAIError {
  type: "quota_exceeded" | "rate_limited" | "invalid_key" | "timeout" | "invalid_response" | "provider_error" | "unknown";
  retryable: boolean;
  safeMessage: string;
}

// ── Provider routing ──────────────────────────────────────────────────────────
const taskRouting = {
  email_classification: { primary: "groq" as AIProviderName, secondary: "gemini" as AIProviderName },
  insight_generation:   { primary: "gemini" as AIProviderName, secondary: "groq" as AIProviderName },
  daily_brief:          { primary: "gemini" as AIProviderName, secondary: "groq" as AIProviderName },
  assistant_chat:       { primary: "gemini" as AIProviderName, secondary: "groq" as AIProviderName },
  thread_summary:       { primary: "gemini" as AIProviderName, secondary: "groq" as AIProviderName },
} as const;

// ── Error normalization ───────────────────────────────────────────────────────
function normalizeAIError(status: number, _body?: string): NormalizedAIError {
  if (status === 401) return { type: "invalid_key", retryable: false, safeMessage: "AI provider API key is invalid." };
  if (status === 429) return { type: "rate_limited", retryable: true, safeMessage: "AI provider rate limit reached." };
  if (status === 408 || status === 504) return { type: "timeout", retryable: true, safeMessage: "AI provider request timed out." };
  if (status >= 500) return { type: "provider_error", retryable: true, safeMessage: `AI provider server error (${status}).` };
  return { type: "unknown", retryable: false, safeMessage: `AI provider returned status ${status}.` };
}

// ── Groq provider ─────────────────────────────────────────────────────────────
async function callGroq<T>(options: AIRequestOptions): Promise<AIResult<T>> {
  const apiKey = Deno.env.get("GROQ_API_KEY");
  if (!apiKey) return { success: false, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, data: null, error: "GROQ_API_KEY not configured.", fallbackUsed: false };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 30_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: GROQ_CLASSIFICATION_MODEL,
        temperature: options.temperature ?? 0.1,
        max_tokens: options.maxOutputTokens ?? 3000,
        messages: [
          { role: "system", content: options.systemPrompt },
          { role: "user", content: options.userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    clearTimeout(timer);
    const durationMs = Date.now() - start;

    if (!res.ok) {
      const normErr = normalizeAIError(res.status);
      console.log("InboxOS AI task:", { task: options.task, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, success: false, fallbackUsed: false, durationMs });
      return { success: false, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, data: null, error: normErr.safeMessage, fallbackUsed: false };
    }

    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return { success: false, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, data: null, error: "Empty response from Groq.", fallbackUsed: false };

    const parsed = JSON.parse(content) as T;
    console.log("InboxOS AI task:", { task: options.task, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, success: true, fallbackUsed: false, durationMs });
    return { success: true, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, data: parsed, error: null, fallbackUsed: false };
  } catch (err: any) {
    clearTimeout(timer);
    const durationMs = Date.now() - start;
    const isAbort = err?.name === "AbortError";
    console.log("InboxOS AI task:", { task: options.task, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, success: false, fallbackUsed: false, durationMs });
    return { success: false, provider: "groq", model: GROQ_CLASSIFICATION_MODEL, data: null, error: isAbort ? "Groq request timed out." : "Groq request failed.", fallbackUsed: false };
  }
}

// ── Gemini provider ───────────────────────────────────────────────────────────
async function callGemini<T>(options: AIRequestOptions): Promise<AIResult<T>> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return { success: false, provider: "gemini", model: GEMINI_REASONING_MODEL, data: null, error: "GEMINI_API_KEY not configured.", fallbackUsed: false };

  const controller = new AbortController();
  const timeoutMs = options.timeoutMs ?? 45_000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  const bodyObj: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: options.systemPrompt }] },
    contents: [{ role: "user", parts: [{ text: options.userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 4000,
      responseMimeType: options.schema ? "application/json" : "text/plain",
      ...(options.schema ? { responseJsonSchema: options.schema } : {}),
    },
  };

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_REASONING_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: controller.signal,
        body: JSON.stringify(bodyObj),
      }
    );

    clearTimeout(timer);
    const durationMs = Date.now() - start;

    if (!res.ok) {
      const normErr = normalizeAIError(res.status);
      console.log("InboxOS AI task:", { task: options.task, provider: "gemini", model: GEMINI_REASONING_MODEL, success: false, fallbackUsed: false, durationMs });
      return { success: false, provider: "gemini", model: GEMINI_REASONING_MODEL, data: null, error: normErr.safeMessage, fallbackUsed: false };
    }

    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return { success: false, provider: "gemini", model: GEMINI_REASONING_MODEL, data: null, error: "Empty response from Gemini.", fallbackUsed: false };

    let parsed: T;
    if (options.schema || text.trim().startsWith("{") || text.trim().startsWith("[")) {
      const cleaned = text.replace(/^```json?\s*/m, "").replace(/\s*```$/m, "").trim();
      parsed = JSON.parse(cleaned) as T;
    } else {
      parsed = text as unknown as T;
    }

    console.log("InboxOS AI task:", { task: options.task, provider: "gemini", model: GEMINI_REASONING_MODEL, success: true, fallbackUsed: false, durationMs });
    return { success: true, provider: "gemini", model: GEMINI_REASONING_MODEL, data: parsed, error: null, fallbackUsed: false };
  } catch (err: any) {
    clearTimeout(timer);
    const durationMs = Date.now() - start;
    const isAbort = err?.name === "AbortError";
    console.log("InboxOS AI task:", { task: options.task, provider: "gemini", model: GEMINI_REASONING_MODEL, success: false, fallbackUsed: false, durationMs });
    return { success: false, provider: "gemini", model: GEMINI_REASONING_MODEL, data: null, error: isAbort ? "Gemini request timed out." : "Gemini request failed.", fallbackUsed: false };
  }
}

// ── runAITask: route + fallback ────────────────────────────────────────────────
async function runAITask<T>(options: AIRequestOptions): Promise<AIResult<T>> {
  const route = taskRouting[options.task];
  const primary = route.primary;
  const secondary = route.secondary;

  const callProvider = (p: AIProviderName) =>
    p === "groq" ? callGroq<T>(options) : callGemini<T>(options);

  const primaryResult = await callProvider(primary);
  if (primaryResult.success) return primaryResult;

  // Only retry with secondary if error is retryable-ish (not invalid key)
  const secondaryResult = await callProvider(secondary);
  if (secondaryResult.success) {
    return { ...secondaryResult, fallbackUsed: true };
  }

  return {
    success: false,
    provider: "fallback",
    model: "none",
    data: null,
    error: `Both ${primary} and ${secondary} failed. ${primaryResult.error} / ${secondaryResult.error}`,
    fallbackUsed: true,
  };
}

// ── Gmail helpers ─────────────────────────────────────────────────────────────
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseMessage(msg: any) {
  const headers: any[] = msg.payload?.headers || [];
  const getH = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
  const fromRaw = getH("From");
  const fromMatch = fromRaw.match(/^"?(.+?)"?\s*<(.+?)>$/);
  const senderName = fromMatch ? fromMatch[1].trim() : (fromRaw.split("@")[0] || "Unknown");
  const senderEmail = fromMatch ? fromMatch[2] : fromRaw;
  const initials = senderName.split(/\s+/).map((w: string) => w[0] || "").join("").slice(0, 2).toUpperCase() || "??";
  const isRead = !(msg.labelIds ?? []).includes("UNREAD");
  const isImportant = (msg.labelIds ?? []).includes("IMPORTANT");
  const isStarred = (msg.labelIds ?? []).includes("STARRED");
  const gmailCat = (msg.labelIds ?? []).find((l: string) => l.startsWith("CATEGORY_")) || "";
  const catMap: Record<string, string> = {
    CATEGORY_PERSONAL: "Personal", CATEGORY_SOCIAL: "Social",
    CATEGORY_PROMOTIONS: "Newsletter", CATEGORY_UPDATES: "Other", CATEGORY_FORUMS: "Other",
  };
  const category = catMap[gmailCat] || "Work";
  const date = new Date(getH("Date") || Date.now());
  const now = new Date();
  const diffH = (now.getTime() - date.getTime()) / 3_600_000;
  const timeDisplay = diffH < 24
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : diffH < 48 ? "Yesterday"
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
  const colors = ["#4F46E5", "#7C3AED", "#0369A1", "#059669", "#DC2626", "#D97706", "#0891B2", "#9333EA"];
  let hash = 0;
  for (let i = 0; i < senderEmail.length; i++) hash = senderEmail.charCodeAt(i) + ((hash << 5) - hash);
  const avatarBg = colors[Math.abs(hash) % colors.length];
  return {
    id: msg.id, threadId: msg.threadId, senderName, senderEmail,
    subject: getH("Subject") || "(no subject)", snippet: msg.snippet || "",
    receivedAt: date.toISOString(), timeDisplay, isRead, isImportant, isStarred,
    category, priority: isImportant ? "High" : "Medium",
    status: "Information", labels: msg.labelIds || [],
    initials, avatarBg, aiSummary: null,
    requiresReply: false, actionItems: [], dueDate: null, aiConfidence: 0,
    ai_version: null, ai_provider: null, ai_model: null, ai_processed_at: null,
  };
}

async function fetchGmailMessages(googleProviderToken: string, maxResults = MAX_EMAILS_PER_SYNC) {
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&labelIds=INBOX&includeSpamTrash=false`,
    { headers: { Authorization: `Bearer ${googleProviderToken}` } }
  );
  if (!listRes.ok) throw new Error(`Gmail list error: ${await listRes.text()}`);
  const { messages = [] } = await listRes.json();
  const detailed = await Promise.all(messages.slice(0, MAX_EMAILS_PER_SYNC).map(async (msg: any) => {
    const r = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${googleProviderToken}` } }
    );
    return r.ok ? r.json() : null;
  }));
  return detailed.filter(Boolean).map(parseMessage);
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) { try { return atob(payload.body.data.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; } }
  if (payload.parts) {
    const part = payload.parts.find((p: any) => p.mimeType === "text/plain") || payload.parts.find((p: any) => p.mimeType === "text/html");
    if (part?.body?.data) { try { return atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/")); } catch { return ""; } }
    for (const p of payload.parts) { const r = extractBody(p); if (r) return r; }
  }
  return "";
}

// ── AI Classification ─────────────────────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `You are an email classification assistant. Classify emails strictly from evidence present in each email.

Rules:
- Classify only from content explicitly present in the email.
- An unread email does not automatically require a reply.
- A promotional call-to-action is not an action item.
- A newsletter normally requires no action.
- A receipt is not necessarily an unpaid bill.
- A shipment advertisement is not a purchase.
- Use Needs Reply ONLY when the sender clearly asks the user to answer, confirm, approve, provide information, or make a decision.
- Use Action Required when the user must perform an action but does not need to respond.
- Use Waiting ONLY when another person or organization owes the user a response, approval, delivery, document, or result.
- Never invent a due date, amount, meeting, commitment, security threat, or required response.
- Return null when a due date is unknown.
- Use confidence below 0.6 for ambiguous classifications.

Return ONLY valid JSON with no markdown fences.`;

async function classifyEmailsBatch(emails: any[]): Promise<{ classMap: Map<string, any>; provider: AIProviderName; model: string; classifiedCount: number; fallbackCount: number }> {
  const classMap = new Map<string, any>();
  let provider: AIProviderName = "fallback";
  let model = "none";
  let classifiedCount = 0;
  let fallbackCount = 0;

  for (let i = 0; i < emails.length; i += CLASSIFICATION_BATCH_SIZE) {
    const batch = emails.slice(i, i + CLASSIFICATION_BATCH_SIZE);

    // Skip already classified v2 emails
    const toClassify = batch.filter((e) => e.ai_version !== "v2");
    const alreadyDone = batch.filter((e) => e.ai_version === "v2");
    for (const e of alreadyDone) {
      classMap.set(e.id, {
        category: e.category, priority: e.priority, status: e.status,
        aiSummary: e.aiSummary, requiresReply: e.requiresReply,
        actionItems: e.actionItems, dueDate: e.dueDate, confidence: e.aiConfidence,
      });
      classifiedCount++;
    }

    if (toClassify.length === 0) continue;

    const emailList = toClassify.map((e) => ({
      id: e.id,
      senderName: e.senderName,
      senderEmail: e.senderEmail,
      subject: e.subject,
      snippet: (e.snippet || "").slice(0, 300),
      receivedAt: e.receivedAt,
      labels: e.labels,
      isRead: e.isRead,
      isImportant: e.isImportant,
    }));

    const prompt = `Classify these ${toClassify.length} emails. Return ONLY valid JSON:
{"emails":[{"id":"gmail-id","category":"Work|Personal|Finance|Purchases|Travel|Newsletter|Security|Calendar|Other","priority":"High|Medium|Low","status":"Needs Reply|Action Required|Waiting|Information|No Action","aiSummary":"one sentence","requiresReply":true|false,"actionItems":["string"],"dueDate":"YYYY-MM-DD or null","confidence":0.0-1.0}]}

Today: ${new Date().toISOString().split("T")[0]}

Emails:
${JSON.stringify(emailList)}`;

    const result = await runAITask<{ emails: any[] }>({
      task: "email_classification",
      systemPrompt: CLASSIFICATION_SYSTEM_PROMPT,
      userPrompt: prompt,
      temperature: 0.1,
      maxOutputTokens: 2500,
      timeoutMs: 30_000,
    });

    // Validate provider returned an array before calling .map() on it
    const rawClassifications = Array.isArray(result.data?.emails)
      ? result.data!.emails
      : Array.isArray(result.data)
        ? (result.data as any[])
        : [];

    if (result.success && rawClassifications.length > 0) {
      provider = result.provider;
      model = result.model;
      for (const item of rawClassifications) {
        if (item?.id) {
          const original = toClassify.find((e) => e.id === item.id);
          classMap.set(item.id, normalizeClassification(item, original || {}));
          classifiedCount++;
        }
      }
      // Any ids in batch not returned by AI get fallback
      for (const e of toClassify) {
        if (!classMap.has(e.id)) {
          classMap.set(e.id, normalizeClassification({}, e));
          fallbackCount++;
        }
      }
    } else {
      for (const e of toClassify) {
        classMap.set(e.id, normalizeClassification({}, e));
        fallbackCount++;
      }
    }
  }

  console.log("InboxOS classification completed:", {
    emailCount: emails.length,
    classifiedCount,
    fallbackCount,
    provider,
  });

  return { classMap, provider, model, classifiedCount, fallbackCount };
}

function applyClassifications(emails: any[], classMap: Map<string, any>, provider: AIProviderName, model: string): any[] {
  const now = new Date().toISOString();
  return emails.map((e) => {
    const c = classMap.get(e.id);
    if (!c) return e;
    return {
      ...e,
      category: c.category,
      priority: c.priority,
      status: c.status,
      aiSummary: c.aiSummary,
      requiresReply: c.requiresReply,
      actionItems: c.actionItems,
      dueDate: c.dueDate,
      aiConfidence: c.confidence,
      ai_version: "v2",
      ai_provider: provider,
      ai_model: model,
      ai_processed_at: now,
    };
  });
}

// ── AI Insights ───────────────────────────────────────────────────────────────
async function generateInsights(emails: any[], userId: string): Promise<{ provider: AIProviderName; model: string; success: boolean }> {
  const insightEmails = emails.slice(0, MAX_INSIGHT_EMAILS).map((e) => ({
    id: e.id,
    senderName: e.senderName,
    senderEmail: e.senderEmail,
    subject: e.subject,
    receivedAt: e.receivedAt,
    category: e.category,
    priority: e.priority,
    status: e.status,
    aiSummary: e.aiSummary,
    requiresReply: e.requiresReply,
    actionItems: e.actionItems,
    dueDate: e.dueDate,
  }));

  const prompt = `Based on these classified email records, extract structured insights.
Do NOT invent information absent from the records.
Return ONLY valid JSON with no markdown fences.

Today: ${new Date().toISOString().split("T")[0]}

Email records:
${JSON.stringify(insightEmails)}

Return this structure:
{"actionItems":[{"text":"string","from":"string","priority":"High|Medium|Low","dueDate":"YYYY-MM-DD or null","emailId":"string"}],"waitingOn":[{"person":"string","subject":"string","days":0,"priority":"High|Medium|Low","emailId":"string","aiTip":"string"}],"followUps":[{"text":"string","person":"string","dueDate":"YYYY-MM-DD or null","emailId":"string","status":"overdue|due_today|upcoming"}],"bills":[{"name":"string","amount":null,"due":"YYYY-MM-DD or null","category":"string","status":"overdue|due_soon|upcoming|unknown","emailId":"string"}],"calendar":[{"title":"string","date":"YYYY-MM-DD or null","time":"HH:MM or null","location":"string or null","type":"string","emailId":"string"}],"security":[{"type":"string","from":"string","severity":"high|medium|low","description":"string","emailId":"string"}],"purchases":[{"item":"string","from":"string","amount":null,"date":"YYYY-MM-DD or null","status":"ordered|shipped|delivered|returned|unknown","emailId":"string"}],"brief":{"summary":"one sentence","highlights":["4-6 bullet strings"]}}`;

  const result = await runAITask<any>({
    task: "insight_generation",
    systemPrompt: "You are an email insights AI. Extract structured insights only from the provided email records. Never invent events, bills, or threats. Return ONLY valid JSON.",
    userPrompt: prompt,
    temperature: 0.2,
    maxOutputTokens: 4000,
    timeoutMs: 45_000,
  });

  const now = new Date().toISOString();

  if (!result.success || !result.data) {
    // Store empty insights with metadata
    await kv.mset(
      [`insights:${userId}:action_items`, `insights:${userId}:waiting_on`, `insights:${userId}:bills`,
       `insights:${userId}:follow_ups`, `insights:${userId}:calendar`, `insights:${userId}:security`,
       `insights:${userId}:purchases`, `insights:${userId}:brief`, `insights:${userId}:meta`],
      [[], [], [], [], [], [], [], [],
       { analysisCompletedAt: now, insights_provider: "fallback", insights_model: "none", insights_generated_at: now, insights_version: "v2" }]
    );
    return { provider: "fallback", model: "none", success: false };
  }

  // Always normalize before saving — never store raw provider output directly
  const d = normalizeInsights(result.data);

  console.log("InboxOS insights generated:", {
    actionItems: d.actionItems.length,
    waitingOn: d.waitingOn.length,
    bills: d.bills.length,
    followUps: d.followUps.length,
  });

  // Store brief as { summary, highlights } object — consistent shape
  await kv.mset(
    [`insights:${userId}:action_items`, `insights:${userId}:waiting_on`, `insights:${userId}:bills`,
     `insights:${userId}:follow_ups`, `insights:${userId}:calendar`, `insights:${userId}:security`,
     `insights:${userId}:purchases`, `insights:${userId}:brief`, `insights:${userId}:meta`],
    [
      d.actionItems, d.waitingOn, d.bills,
      d.followUps, d.calendar, d.security,
      d.purchases, d.brief,
      {
        analysisCompletedAt: now,
        insights_provider: result.provider,
        insights_model: result.model,
        insights_generated_at: now,
        insights_version: "v2",
      },
    ]
  );

  return { provider: result.provider, model: result.model, success: true };
}

// ── Gmail Sync ────────────────────────────────────────────────────────────────
app.post(`${BASE}/gmail/sync`, async (c) => {
  try {
    const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
    if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);

    const body = await c.req.json();
    const { userId, googleProviderToken } = body;

    console.log("InboxOS Gmail handler:", { authenticatedUser: Boolean(user), hasGoogleProviderToken: Boolean(googleProviderToken) });

    if (!googleProviderToken) return c.json({ error: "Google provider token is missing." }, 400);
    if (userId && userId !== user.id) return c.json({ error: "User ID does not match authenticated session." }, 403);

    const trustedUserId = user.id;
    const emails = await fetchGmailMessages(googleProviderToken, MAX_EMAILS_PER_SYNC);

    // Merge with cached emails to preserve ai_version on unchanged messages
    const cached: any[] = (await kv.get(`emails:${trustedUserId}`)) || [];
    const cachedById = new Map(cached.map((e: any) => [e.id, e]));
    const mergedEmails = emails.map((e) => {
      const prev = cachedById.get(e.id);
      if (prev?.ai_version === "v2") {
        // Preserve AI classification; update Gmail metadata only
        return { ...prev, isRead: e.isRead, isStarred: e.isStarred, labels: e.labels, timeDisplay: e.timeDisplay };
      }
      return e;
    });

    const groqAvailable = Boolean(Deno.env.get("GROQ_API_KEY"));
    const geminiAvailable = Boolean(Deno.env.get("GEMINI_API_KEY"));
    const aiAvailable = groqAvailable || geminiAvailable;

    let classifiedEmails = mergedEmails;
    let classificationStatus: "completed" | "partial" | "failed" | "fallback" = "fallback";
    let classificationProvider: AIProviderName = "fallback";
    let classificationModel = "none";
    let classifiedCount = 0;
    let fallbackCount = mergedEmails.length;

    if (aiAvailable) {
      const { classMap, provider, model, classifiedCount: cc, fallbackCount: fc } =
        await classifyEmailsBatch(mergedEmails);

      classifiedEmails = applyClassifications(mergedEmails, classMap, provider, model);
      classificationProvider = provider;
      classificationModel = model;
      classifiedCount = cc;
      fallbackCount = fc;

      if (provider === "fallback") classificationStatus = fc === mergedEmails.length ? "failed" : "partial";
      else if (fc === 0) classificationStatus = "completed";
      else classificationStatus = "partial";
    }

    const stats = {
      total: classifiedEmails.length,
      unread: classifiedEmails.filter((e: any) => !e.isRead).length,
      important: classifiedEmails.filter((e: any) => e.priority === "High").length,
      needsReply: classifiedEmails.filter((e: any) => e.requiresReply).length,
      byCategory: classifiedEmails.reduce((acc: Record<string, number>, e: any) => {
        acc[e.category] = (acc[e.category] || 0) + 1; return acc;
      }, {}),
    };

    await kv.mset(
      [`emails:${trustedUserId}`, `stats:${trustedUserId}`, `last_sync:${trustedUserId}`],
      [classifiedEmails, stats, new Date().toISOString()]
    );

    let insightsStatus: "completed" | "failed" | "fallback" = "fallback";
    let insightsProvider: AIProviderName = "fallback";

    if (aiAvailable) {
      const insResult = await generateInsights(classifiedEmails, trustedUserId);
      insightsProvider = insResult.provider;
      insightsStatus = insResult.success ? "completed" : "failed";
    }

    return c.json({
      success: true,
      count: classifiedEmails.length,
      classification: {
        status: classificationStatus,
        provider: classificationProvider,
        model: classificationModel,
        classifiedCount,
        fallbackCount,
      },
      insights: {
        status: insightsStatus,
        provider: insightsProvider,
        ready: insightsStatus === "completed",
      },
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── Re-run AI classification ──────────────────────────────────────────────────
app.post(`${BASE}/ai/reclassify`, async (c) => {
  try {
    const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
    if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);

    const cached: any[] = (await kv.get(`emails:${user.id}`)) || [];
    if (!cached.length) return c.json({ error: "No cached emails found. Run a Gmail sync first." }, 400);

    // Force reclassification by clearing ai_version
    const toReclassify = cached.map((e) => ({ ...e, ai_version: null }));

    const { classMap, provider, model, classifiedCount, fallbackCount } = await classifyEmailsBatch(toReclassify);
    const classifiedEmails = applyClassifications(toReclassify, classMap, provider, model);

    const stats = {
      total: classifiedEmails.length,
      unread: classifiedEmails.filter((e: any) => !e.isRead).length,
      important: classifiedEmails.filter((e: any) => e.priority === "High").length,
      needsReply: classifiedEmails.filter((e: any) => e.requiresReply).length,
      byCategory: classifiedEmails.reduce((acc: Record<string, number>, e: any) => {
        acc[e.category] = (acc[e.category] || 0) + 1; return acc;
      }, {}),
    };

    await kv.mset(
      [`emails:${user.id}`, `stats:${user.id}`],
      [classifiedEmails, stats]
    );

    const insResult = await generateInsights(classifiedEmails, user.id);

    return c.json({
      success: true,
      count: classifiedEmails.length,
      classification: { status: provider === "fallback" ? "failed" : "completed", provider, model, classifiedCount, fallbackCount },
      insights: { status: insResult.success ? "completed" : "failed", provider: insResult.provider, ready: insResult.success },
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── Re-generate insights ──────────────────────────────────────────────────────
app.post(`${BASE}/ai/regenerate-insights`, async (c) => {
  try {
    const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
    if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);

    const cached: any[] = (await kv.get(`emails:${user.id}`)) || [];
    if (!cached.length) return c.json({ error: "No cached emails found. Run a Gmail sync first." }, 400);

    const insResult = await generateInsights(cached, user.id);

    return c.json({
      success: true,
      insights: { status: insResult.success ? "completed" : "failed", provider: insResult.provider, model: insResult.model, ready: insResult.success },
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── Emails / cached data ──────────────────────────────────────────────────────
app.get(`${BASE}/emails/:userId`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const userId = c.req.param("userId");
  if (userId !== user.id) return c.json({ error: "User ID does not match authenticated session." }, 403);
  const [emails, stats, lastSync] = await kv.mget([`emails:${userId}`, `stats:${userId}`, `last_sync:${userId}`]);
  return c.json({ emails: emails || [], stats: stats || {}, lastSync });
});

app.post(`${BASE}/gmail/message`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const { googleProviderToken, message_id } = await c.req.json();
  if (!googleProviderToken) return c.json({ error: "Google provider token is missing." }, 400);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}?format=full`, {
    headers: { Authorization: `Bearer ${googleProviderToken}` },
  });
  if (!res.ok) return c.json({ body: "", snippet: "" });
  const data = await res.json();
  return c.json({ body: stripHtml(extractBody(data.payload)).slice(0, MAX_BODY_CHARS), snippet: data.snippet });
});

app.post(`${BASE}/gmail/archive`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const { googleProviderToken, message_id } = await c.req.json();
  if (!googleProviderToken) return c.json({ error: "Google provider token is missing." }, 400);
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${googleProviderToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["INBOX"] }),
  });
  const emails: any[] = (await kv.get(`emails:${user.id}`)) || [];
  await kv.set(`emails:${user.id}`, emails.filter((e: any) => e.id !== message_id));
  return c.json({ success: true });
});

app.post(`${BASE}/gmail/mark-read`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const { googleProviderToken, message_id } = await c.req.json();
  if (!googleProviderToken) return c.json({ error: "Google provider token is missing." }, 400);
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${message_id}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${googleProviderToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
  const emails: any[] = (await kv.get(`emails:${user.id}`)) || [];
  await kv.set(`emails:${user.id}`, emails.map((e: any) => e.id === message_id ? { ...e, isRead: true, status: "Read" } : e));
  return c.json({ success: true });
});

app.post(`${BASE}/gmail/search`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const { googleProviderToken, query } = await c.req.json();
  if (!googleProviderToken) return c.json({ error: "Google provider token is missing." }, 400);
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Bearer ${googleProviderToken}` },
  });
  if (!res.ok) return c.json({ emails: [] });
  const { messages = [] } = await res.json();
  if (!messages.length) return c.json({ emails: [] });
  const emails = await fetchGmailMessages(googleProviderToken, messages.length);
  return c.json({ emails });
});

app.post(`${BASE}/gmail/send`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const { googleProviderToken, to, subject, body, thread_id } = await c.req.json();
  if (!googleProviderToken) return c.json({ error: "Google provider token is missing." }, 400);
  const raw = btoa([`To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset=utf-8`, ``, body].join("\r\n"))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const payload: any = { raw };
  if (thread_id) payload.threadId = thread_id;
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${googleProviderToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return c.json({ success: res.ok });
});

// ── Insights endpoint ─────────────────────────────────────────────────────────
app.get(`${BASE}/insights/:userId`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const u = c.req.param("userId");
  if (u !== user.id) return c.json({ error: "User ID does not match authenticated session." }, 403);
  const [a, w, b, f, cal, sec, p, br, meta] = await kv.mget([
    `insights:${u}:action_items`, `insights:${u}:waiting_on`, `insights:${u}:bills`,
    `insights:${u}:follow_ups`, `insights:${u}:calendar`, `insights:${u}:security`,
    `insights:${u}:purchases`, `insights:${u}:brief`, `insights:${u}:meta`,
  ]);

  // Normalize stored data on read to fix any previously corrupted records
  const briefRaw = br as any;
  const briefNorm = briefRaw && typeof briefRaw === "object" && !Array.isArray(briefRaw)
    ? { summary: asString(briefRaw.summary), highlights: asArray<string>(briefRaw.highlights).filter((x): x is string => typeof x === "string") }
    : { summary: "", highlights: asArray<string>(briefRaw).filter((x): x is string => typeof x === "string") };

  return c.json({
    actionItems: asArray(a), waitingOn: asArray(w), bills: asArray(b), followUps: asArray(f),
    calendar: asArray(cal), security: asArray(sec), purchases: asArray(p),
    brief: briefNorm,
    analysisCompletedAt: (meta as any)?.analysisCompletedAt || null,
    insightsProvider: (meta as any)?.insights_provider || null,
  });
});

// ── Repair corrupted data ─────────────────────────────────────────────────────
app.post(`${BASE}/ai/repair-data`, async (c) => {
  try {
    const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
    if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);

    const uid = user.id;

    // Repair emails — normalize actionItems arrays
    const emails: any[] = (await kv.get(`emails:${uid}`)) || [];
    const repairedEmails = emails.map((e) => ({
      ...e,
      actionItems: asArray<string>(e.actionItems).filter((x): x is string => typeof x === "string"),
      aiSummary: asString(e.aiSummary, e.snippet || ""),
      requiresReply: asBoolean(e.requiresReply),
      aiConfidence: Math.max(0, Math.min(1, asNumber(e.aiConfidence))),
    }));
    if (emails.length > 0) await kv.set(`emails:${uid}`, repairedEmails);

    // Repair insights
    const [a, w, b, f, cal, sec, p, br] = await kv.mget([
      `insights:${uid}:action_items`, `insights:${uid}:waiting_on`, `insights:${uid}:bills`,
      `insights:${uid}:follow_ups`, `insights:${uid}:calendar`, `insights:${uid}:security`,
      `insights:${uid}:purchases`, `insights:${uid}:brief`,
    ]);

    const briefRaw = br as any;
    const briefRepaired = briefRaw && typeof briefRaw === "object" && !Array.isArray(briefRaw)
      ? { summary: asString(briefRaw.summary), highlights: asArray<string>(briefRaw.highlights).filter((x): x is string => typeof x === "string") }
      : { summary: "", highlights: asArray<string>(briefRaw).filter((x): x is string => typeof x === "string") };

    await kv.mset(
      [`insights:${uid}:action_items`, `insights:${uid}:waiting_on`, `insights:${uid}:bills`,
       `insights:${uid}:follow_ups`, `insights:${uid}:calendar`, `insights:${uid}:security`,
       `insights:${uid}:purchases`, `insights:${uid}:brief`],
      [asArray(a), asArray(w), asArray(b), asArray(f), asArray(cal), asArray(sec), asArray(p), briefRepaired]
    );

    // Repair daily brief
    const dailyBrief = await kv.get(`ai_brief:${uid}`) as any;
    if (dailyBrief) {
      await kv.set(`ai_brief:${uid}`, {
        ...dailyBrief,
        summary: asString(dailyBrief.summary),
        highlights: asArray<string>(dailyBrief.highlights).filter((x): x is string => typeof x === "string"),
      });
    }

    return c.json({
      success: true,
      repairedEmails: repairedEmails.length,
      repairedInsights: 7,
      repairedBrief: Boolean(dailyBrief),
    });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ── Daily Brief ───────────────────────────────────────────────────────────────
app.get(`${BASE}/ai/brief/:userId`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);
  const userId = c.req.param("userId");
  if (userId !== user.id) return c.json({ error: "User ID does not match authenticated session." }, 403);

  const cached = await kv.get(`ai_brief:${userId}`);
  if (cached?.date === new Date().toDateString()) return c.json(cached);

  const emails: any[] = (await kv.get(`emails:${userId}`)) || [];
  if (!emails.length) return c.json({ highlights: ["Sync your Gmail to see your daily brief."], summary: "No emails synced yet.", date: new Date().toDateString() });

  const groqAvailable = Boolean(Deno.env.get("GROQ_API_KEY"));
  const geminiAvailable = Boolean(Deno.env.get("GEMINI_API_KEY"));

  if (!groqAvailable && !geminiAvailable) {
    const r = {
      highlights: [`${emails.length} emails, ${emails.filter((e: any) => !e.isRead).length} unread.`],
      summary: `${emails.length} emails in inbox.`,
      date: new Date().toDateString(),
    };
    await kv.set(`ai_brief:${userId}`, r);
    return c.json(r);
  }

  const ordered = [...emails].sort((a, b) => {
    const pa = a.priority === "High" ? 0 : a.priority === "Medium" ? 1 : 2;
    const pb = b.priority === "High" ? 0 : b.priority === "Medium" ? 1 : 2;
    if (pa !== pb) return pa - pb;
    return a.requiresReply ? -1 : 1;
  });

  const list = ordered.slice(0, 15).map((e: any) =>
    `[${e.priority}${e.requiresReply ? ",REPLY" : ""}] ${e.senderName}: "${e.subject}" — ${(e.aiSummary || e.snippet || "").slice(0, 100)}`
  ).join("\n");

  const result = await runAITask<{ highlights: string[]; summary: string }>({
    task: "daily_brief",
    systemPrompt: "You are a concise executive email assistant. Summarize only what is actually present. Return ONLY valid JSON.",
    userPrompt: `Create a daily email brief. Today: ${new Date().toISOString().split("T")[0]}. Return JSON: {"highlights":["4-6 bullet strings"],"summary":"one sentence"}\n\nEmails:\n${list}`,
    temperature: 0.3,
    maxOutputTokens: 600,
    timeoutMs: 45_000,
  });

  let brief: any;
  if (result.success && result.data) {
    brief = result.data;
  } else {
    brief = { highlights: [`${emails.filter((e: any) => !e.isRead).length} unread emails`], summary: `${emails.length} emails.` };
  }
  brief.date = new Date().toDateString();
  brief.provider = result.provider;
  await kv.set(`ai_brief:${userId}`, brief);
  return c.json(brief);
});

// ── AI Chat ───────────────────────────────────────────────────────────────────
app.post(`${BASE}/ai/chat`, async (c) => {
  const { user, error: authError } = await validateSupabaseUser(c.req.header("Authorization"));
  if (authError || !user) return c.json({ error: authError || "Unauthorized." }, 401);

  const groqAvailable = Boolean(Deno.env.get("GROQ_API_KEY"));
  const geminiAvailable = Boolean(Deno.env.get("GEMINI_API_KEY"));
  if (!groqAvailable && !geminiAvailable) {
    return c.json({ reply: "AI chat requires GROQ_API_KEY or GEMINI_API_KEY in Make Settings → Secrets.", error: true, provider: "fallback", model: "none", sourcesUsed: 0 });
  }

  const { message, history = [] } = await c.req.json();
  const lc = (message || "").toLowerCase();

  const allEmails: any[] = (await kv.get(`emails:${user.id}`)) || [];

  // Retrieve relevant emails
  const relevant = allEmails.filter((e) =>
    lc.includes(e.senderName.toLowerCase()) ||
    lc.includes(e.senderEmail.toLowerCase()) ||
    e.priority === "High" ||
    e.requiresReply ||
    e.status === "Action Required" ||
    e.category === "Security"
  ).slice(0, MAX_CHAT_CONTEXT_EMAILS);

  const context = (relevant.length > 0 ? relevant : allEmails.slice(0, MAX_CHAT_CONTEXT_EMAILS));

  const [ai, aw, ab] = await kv.mget([`insights:${user.id}:action_items`, `insights:${user.id}:waiting_on`, `insights:${user.id}:bills`]);

  const ctx = context.map((e: any) =>
    `- [${e.priority}${e.requiresReply ? ",REPLY" : ""}${e.isRead ? "" : ",UNREAD"}] ${e.senderName}: "${e.subject}" | ${e.status}${e.aiSummary ? ` | "${e.aiSummary.slice(0, 80)}"` : ""}`
  ).join("\n");

  const systemPrompt = `You are InboxOS AI, a smart email management assistant.

INBOX CONTEXT (${context.length} most relevant emails):
${ctx}

ACTION ITEMS: ${(ai || []).map((x: any) => x.text).join("; ")}
WAITING ON: ${(aw || []).map((x: any) => `${x.person} — ${x.subject}`).join("; ")}
BILLS: ${(ab || []).map((x: any) => `${x.name} $${x.amount} due ${x.due}`).join("; ")}

Be concise, direct, and actionable. Use bullet points for lists. Use **bold** for key items.`;

  const historyMessages = history.slice(-8).map((h: any) =>
    `${h.role === "user" ? "User" : "Assistant"}: ${h.text}`
  ).join("\n");

  const result = await runAITask<string>({
    task: "assistant_chat",
    systemPrompt,
    userPrompt: historyMessages ? `${historyMessages}\nUser: ${message}` : message,
    temperature: 0.4,
    maxOutputTokens: 800,
    timeoutMs: 45_000,
  });

  if (result.success && result.data) {
    return c.json({ reply: result.data, provider: result.provider, model: result.model, sourcesUsed: context.length });
  }

  return c.json({
    reply: "AI is temporarily unavailable. Please try again shortly.",
    error: true,
    provider: "fallback",
    model: "none",
    sourcesUsed: 0,
  });
});

Deno.serve(app.fetch);
