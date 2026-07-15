Fix the remaining React crash:

TypeError: .map is not a function

The app’s shape diagnostics confirm that these fields are arrays:

actionItems
waitingOn
bills
followUps
calendar

The crash still occurs after data loads, so inspect every remaining .map() call, especially:

brief.highlights.map
email.actionItems.map
emails.map
topEmails.map
results.map
categories.map

Do not redesign the UI or remove existing functionality.

1. Fix the daily brief shape first

In src/app/App.tsx, find every rendering location that uses:

brief.highlights.map(...)

Replace it with:

const safeBriefHighlights = Array.isArray(brief?.highlights)
  ? brief.highlights.filter(
      (item): item is string => typeof item === "string"
    )
  : [];

Then render:

{safeBriefHighlights.slice(0, 5).map((highlight, index) => (
  <div key={`${highlight}-${index}`} className="flex items-start gap-2.5">
    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0 mt-1.5" />
    <p className="text-xs text-gray-700 dark:text-slate-300 leading-relaxed">
      {highlight}
    </p>
  </div>
))}

Never call .map() directly on brief.highlights.

2. Normalize unusual Gemini brief formats

In src/lib/supabase.ts, replace the daily brief normalizer with a version that supports strings, arrays, nested objects, and snake_case:

const safeStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string =>
        typeof item === "string" && item.trim().length > 0
    );
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
    return {
      summary: "",
      highlights: safeStringArray(source),
    };
  }

  if (typeof source === "string") {
    return {
      summary: source,
      highlights: [],
    };
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

  return {
    summary,
    highlights,
  };
}

Ensure getDailyBrief() always returns:

{
  summary: string;
  highlights: string[];
}

Example:

export async function getDailyBrief(userId: string) {
  const raw = await existingDailyBriefRequest(userId);
  return normalizeBriefResponse(raw);
}
3. Normalize the brief before setting React state

In loadBrief() inside src/app/App.tsx, use:

const loadBrief = async (userId: string) => {
  setBriefLoading(true);

  try {
    const result = await getDailyBrief(userId);

    const normalizedBrief = {
      summary:
        typeof result?.summary === "string"
          ? result.summary
          : "",

      highlights: Array.isArray(result?.highlights)
        ? result.highlights.filter(
            (item: unknown): item is string =>
              typeof item === "string"
          )
        : [],
    };

    console.log("InboxOS brief shape:", {
      summaryIsString:
        typeof normalizedBrief.summary === "string",
      highlightsIsArray:
        Array.isArray(normalizedBrief.highlights),
      highlightCount:
        normalizedBrief.highlights.length,
      rawHighlightsType:
        typeof result?.highlights,
    });

    setBrief(normalizedBrief);
  } catch (error) {
    console.error("InboxOS brief load failed:", error);

    setBrief({
      summary: "",
      highlights: [],
    });
  } finally {
    setBriefLoading(false);
  }
};

Do not store the raw backend response directly in brief.

4. Normalize all emails before setting state

Create:

function normalizeEmail(raw: any): GmailEmail {
  return {
    ...raw,

    id:
      typeof raw?.id === "string"
        ? raw.id
        : "",

    threadId:
      typeof raw?.threadId === "string"
        ? raw.threadId
        : "",

    senderName:
      typeof raw?.senderName === "string"
        ? raw.senderName
        : "Unknown Sender",

    senderEmail:
      typeof raw?.senderEmail === "string"
        ? raw.senderEmail
        : "",

    subject:
      typeof raw?.subject === "string"
        ? raw.subject
        : "(No subject)",

    snippet:
      typeof raw?.snippet === "string"
        ? raw.snippet
        : "",

    receivedAt:
      typeof raw?.receivedAt === "string"
        ? raw.receivedAt
        : "",

    timeDisplay:
      typeof raw?.timeDisplay === "string"
        ? raw.timeDisplay
        : "",

    isRead: Boolean(raw?.isRead),
    isImportant: Boolean(raw?.isImportant),
    isStarred: Boolean(raw?.isStarred),

    category:
      typeof raw?.category === "string"
        ? raw.category
        : "Other",

    priority:
      typeof raw?.priority === "string"
        ? raw.priority
        : "Medium",

    status:
      typeof raw?.status === "string"
        ? raw.status
        : "Information",

    labels: Array.isArray(raw?.labels)
      ? raw.labels.filter(
          (item: unknown): item is string =>
            typeof item === "string"
        )
      : [],

    initials:
      typeof raw?.initials === "string"
        ? raw.initials
        : "?",

    avatarBg:
      typeof raw?.avatarBg === "string"
        ? raw.avatarBg
        : "#64748B",

    aiSummary:
      typeof raw?.aiSummary === "string"
        ? raw.aiSummary
        : null,

    requiresReply: Boolean(raw?.requiresReply),

    actionItems: Array.isArray(raw?.actionItems)
      ? raw.actionItems.filter(
          (item: unknown): item is string =>
            typeof item === "string"
        )
      : [],

    dueDate:
      typeof raw?.dueDate === "string"
        ? raw.dueDate
        : null,

    aiConfidence: Number.isFinite(
      Number(raw?.aiConfidence)
    )
      ? Number(raw.aiConfidence)
      : 0,
  };
}

Whenever cached or fresh emails are loaded, use:

const normalizedEmails = Array.isArray(cached?.emails)
  ? cached.emails.map(normalizeEmail)
  : [];

setEmails(normalizedEmails);

And after sync:

const normalizedFreshEmails = Array.isArray(fresh?.emails)
  ? fresh.emails.map(normalizeEmail)
  : [];

setEmails(normalizedFreshEmails);
5. Guard email action-item rendering

Search for:

email.actionItems.map(...)

Replace with:

{(
  Array.isArray(email?.actionItems)
    ? email.actionItems
    : []
).map((item, index) => (
  <div key={`${email.id}-action-${index}`}>
    {typeof item === "string" ? item : ""}
  </div>
))}
6. Add detailed map-source diagnostics

Before the dashboard renders, add:

console.log("InboxOS render array shapes:", {
  emails: Array.isArray(emails),
  topEmails: Array.isArray(topEmails),
  briefHighlights:
    Array.isArray(brief?.highlights),
  actionItems:
    Array.isArray(insights?.actionItems),
  waitingOn:
    Array.isArray(insights?.waitingOn),
  bills:
    Array.isArray(insights?.bills),
  followUps:
    Array.isArray(insights?.followUps),
  calendar:
    Array.isArray(insights?.calendar),
  security:
    Array.isArray(insights?.security),
  purchases:
    Array.isArray(insights?.purchases),
});

Do not log email content.

7. Inspect all .map() calls

Search the entire src/app/App.tsx file for:

.map(

For every .map() call, determine whether the value is:

a fixed local array, or
data loaded from Supabase/Groq/Gemini.

Every remotely loaded value must be protected with Array.isArray().

Pay special attention to:

brief.highlights
emails
results
email.actionItems
insights.security
insights.purchases

The earlier diagnostics may not have shown security, purchases, or briefHighlights because the console object was collapsed.

8. Do not use the same brief field in two formats

Use these separate types:

interface Insights {
  actionItems: any[];
  waitingOn: any[];
  bills: any[];
  followUps: any[];
  calendar: any[];
  security: any[];
  purchases: any[];
}

interface DailyBrief {
  summary: string;
  highlights: string[];
}

Remove this from Insights:

brief: string[];

Keep brief state separately:

const [brief, setBrief] =
  useState<DailyBrief | null>(null);

Update every empty insights object so it does not include an incompatible brief value.

9. Fix stored malformed data

Existing Supabase data may already contain malformed brief values.

When reading stored insights and briefs, always normalize them before returning.

When writing new Gemini insights, save:

brief: {
  summary:
    typeof normalized.brief.summary === "string"
      ? normalized.brief.summary
      : "",

  highlights:
    Array.isArray(normalized.brief.highlights)
      ? normalized.brief.highlights
      : [],
}

Never save raw Gemini output directly.

10. Final verification

Confirm:

brief.highlights is always an array.
email.actionItems is always an array.
emails is always an array.
security and purchases are always arrays.
No API-derived value uses .map() without validation.
Existing malformed stored records are normalized on read.
The error boundary no longer activates.
TypeScript compiles.
Authentication, Gmail sync, Groq, Gemini, inbox, and dashboard continue working.

Apply the changes directly. Do not merely explain them.