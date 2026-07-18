const safeArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const safeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) {
    return [value.trim()];
  }
  return [];
};

export interface GmailEmail {
  id: string;
  threadId: string;
  senderName: string;
  senderEmail: string;
  subject: string;
  snippet: string;
  receivedAt: string;
  timeDisplay: string;
  isRead: boolean;
  isImportant: boolean;
  isStarred: boolean;
  category: string;
  priority: string;
  status: string;
  labels: string[];
  initials: string;
  avatarBg: string;
  aiSummary: string | null;
  requiresReply: boolean;
  actionItems: string[];
  dueDate: string | null;
  aiConfidence: number;
}

export interface Insights {
  actionItems: unknown[];
  waitingOn: unknown[];
  bills: unknown[];
  followUps: unknown[];
  calendar: unknown[];
  security: unknown[];
  purchases: unknown[];
}

export function normalizeEmail(raw: unknown): GmailEmail {
  const r = raw as Record<string, unknown>;
  return {
    id: typeof r?.id === "string" ? r.id : "",
    threadId: typeof r?.threadId === "string" ? r.threadId : "",
    senderName: typeof r?.senderName === "string" ? r.senderName : "Unknown Sender",
    senderEmail: typeof r?.senderEmail === "string" ? r.senderEmail : "",
    subject: typeof r?.subject === "string" ? r.subject : "(No subject)",
    snippet: typeof r?.snippet === "string" ? r.snippet : "",
    receivedAt: typeof r?.receivedAt === "string" ? r.receivedAt : "",
    timeDisplay: typeof r?.timeDisplay === "string" ? r.timeDisplay : "",
    isRead: Boolean(r?.isRead),
    isImportant: Boolean(r?.isImportant),
    isStarred: Boolean(r?.isStarred),
    category: typeof r?.category === "string" ? r.category : "Other",
    priority: typeof r?.priority === "string" ? r.priority : "Medium",
    status: typeof r?.status === "string" ? r.status : "Information",
    labels: Array.isArray(r?.labels)
      ? r.labels.filter((item: unknown): item is string => typeof item === "string")
      : [],
    initials: typeof r?.initials === "string" ? r.initials : "?",
    avatarBg: typeof r?.avatarBg === "string" ? r.avatarBg : "#64748B",
    aiSummary: typeof r?.aiSummary === "string" ? r.aiSummary : null,
    requiresReply: Boolean(r?.requiresReply),
    actionItems: Array.isArray(r?.actionItems)
      ? r.actionItems.filter((item: unknown): item is string => typeof item === "string")
      : [],
    dueDate: typeof r?.dueDate === "string" ? r.dueDate : null,
    aiConfidence: Number.isFinite(Number(r?.aiConfidence)) ? Number(r.aiConfidence) : 0,
  };
}

function pickString(raw: Record<string, unknown>, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return fallback;
}

function pickAmount(raw: Record<string, unknown>): number | null {
  for (const key of ["amount", "total", "price", "cost"]) {
    const value = raw[key];
    if (value == null || value === "") continue;
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

/** Normalize sparse/variant AI purchase objects into a stable UI shape. */
export function normalizePurchase(raw: unknown) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const item = pickString(r, ["item", "name", "title", "product", "description", "subject"], "Purchase");
  const from = pickString(r, ["from", "merchant", "seller", "vendor", "store", "brand"]);
  const date = pickString(r, ["date", "orderDate", "orderedAt", "ordered_at", "purchaseDate"]);
  const status = pickString(r, ["status", "state"], "unknown").toLowerCase();
  const emailId = pickString(r, ["emailId", "email_id"]);
  return {
    item,
    from,
    amount: pickAmount(r),
    date: date || null,
    status,
    emailId: emailId || null,
  };
}

/** Normalize sparse/variant AI bill objects into a stable UI shape. */
export function normalizeBill(raw: unknown) {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    name: pickString(r, ["name", "title", "merchant", "from", "vendor"], "Bill"),
    amount: pickAmount(r) ?? 0,
    due: pickString(r, ["due", "dueDate", "due_date", "date"]) || null,
    category: pickString(r, ["category", "type"], "Other"),
    status: pickString(r, ["status"], "unknown").toLowerCase(),
    emailId: pickString(r, ["emailId", "email_id"]) || null,
  };
}

export function normalizeInsightsResponse(raw: unknown) {
  const source = (raw as Record<string, unknown>)?.insights
    ?? (raw as Record<string, unknown>)?.data
      ? ((raw as Record<string, unknown>).data as Record<string, unknown>)?.insights
      : raw
    ?? {};
  const src = source as Record<string, unknown>;
  const briefSource = src.brief && typeof src.brief === "object" && !Array.isArray(src.brief)
    ? (src.brief as Record<string, unknown>)
    : {};

  return {
    actionItems: safeArray(src.actionItems ?? src.action_items),
    waitingOn: safeArray(src.waitingOn ?? src.waiting_on),
    bills: safeArray(src.bills).map(normalizeBill),
    followUps: safeArray(src.followUps ?? src.follow_ups),
    calendar: safeArray(src.calendar),
    security: safeArray(src.security),
    purchases: safeArray(src.purchases).map(normalizePurchase),
    brief: {
      summary: typeof briefSource.summary === "string" ? briefSource.summary : "",
      highlights: safeArray<string>(briefSource.highlights).filter((item): item is string => typeof item === "string"),
    },
  };
}

export function normalizeBriefResponse(raw: unknown) {
  const rawObj = raw as Record<string, unknown>;
  const source =
    rawObj?.brief ??
    rawObj?.dailyBrief ??
    rawObj?.daily_brief ??
    (rawObj?.data as Record<string, unknown>)?.brief ??
    rawObj?.data ??
    rawObj ??
    {};

  if (Array.isArray(source)) {
    return { summary: "", highlights: safeStringArray(source) };
  }

  if (typeof source === "string") {
    return { summary: source, highlights: [] };
  }

  const src = source as Record<string, unknown>;
  const summary =
    typeof src?.summary === "string"
      ? src.summary
      : typeof src?.text === "string"
        ? src.text
        : "";

  const highlights = safeStringArray(
    src?.highlights ??
    src?.highlight ??
    src?.items ??
    src?.bullets ??
    src?.key_points,
  );

  return { summary, highlights };
}
