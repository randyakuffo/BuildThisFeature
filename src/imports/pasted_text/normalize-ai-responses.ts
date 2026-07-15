Fix the production crash:

TypeError: .map is not a function

The app loads initially, then turns blank after AI processing completes. This indicates an AI or backend response field expected to be an array is being stored or passed to React as a string, object, or null.

Do not redesign the UI. Preserve authentication, Gmail sync, Groq classification, Gemini insights, dashboard, inbox, assistant, reply, archive, search, analytics, and all existing functionality.

1. Normalize every AI response on the server

In:

supabase/functions/server/index.tsx

Create safe helpers:

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(
  value: unknown,
  fallback = 0
): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asBoolean(
  value: unknown,
  fallback = false
): boolean {
  return typeof value === "boolean" ? value : fallback;
}

Create a normalizer for generated insights:

function normalizeInsights(raw: any) {
  const source = raw?.insights ?? raw ?? {};

  const rawBrief = source.brief;

  const brief =
    typeof rawBrief === "object" &&
    rawBrief !== null &&
    !Array.isArray(rawBrief)
      ? {
          summary: asString(rawBrief.summary),
          highlights: asArray<string>(
            rawBrief.highlights
          ).filter(
            (item): item is string =>
              typeof item === "string"
          ),
        }
      : {
          summary: "",
          highlights: asArray<string>(
            source.highlights
          ).filter(
            (item): item is string =>
              typeof item === "string"
          ),
        };

  return {
    actionItems: asArray(source.actionItems),
    waitingOn: asArray(source.waitingOn),
    followUps: asArray(source.followUps),
    bills: asArray(source.bills),
    calendar: asArray(source.calendar),
    security: asArray(source.security),
    purchases: asArray(source.purchases),
    brief,
  };
}

Also support snake_case responses:

function normalizeInsights(raw: any) {
  const source = raw?.insights ?? raw ?? {};

  const rawBrief =
    source.brief ??
    source.daily_brief ??
    {};

  return {
    actionItems: asArray(
      source.actionItems ??
      source.action_items
    ),

    waitingOn: asArray(
      source.waitingOn ??
      source.waiting_on
    ),

    followUps: asArray(
      source.followUps ??
      source.follow_ups
    ),

    bills: asArray(source.bills),
    calendar: asArray(source.calendar),
    security: asArray(source.security),
    purchases: asArray(source.purchases),

    brief: {
      summary: asString(
        rawBrief?.summary
      ),

      highlights: asArray<string>(
        rawBrief?.highlights
      ).filter(
        (item): item is string =>
          typeof item === "string"
      ),
    },
  };
}

Use only the normalized result when saving insights to Supabase.

Never save raw Gemini or Groq JSON directly.

2. Normalize email classifications

Create:

function normalizeClassification(
  raw: any,
  email: any
) {
  const allowedCategories = [
    "Work",
    "Personal",
    "Finance",
    "Purchases",
    "Travel",
    "Newsletter",
    "Security",
    "Calendar",
    "Other",
  ];

  const allowedPriorities = [
    "High",
    "Medium",
    "Low",
  ];

  const allowedStatuses = [
    "Needs Reply",
    "Action Required",
    "Waiting",
    "Information",
    "No Action",
  ];

  return {
    id: asString(raw?.id, email.id),

    category: allowedCategories.includes(
      raw?.category
    )
      ? raw.category
      : email.category || "Other",

    priority: allowedPriorities.includes(
      raw?.priority
    )
      ? raw.priority
      : email.isImportant
        ? "High"
        : "Medium",

    status: allowedStatuses.includes(
      raw?.status
    )
      ? raw.status
      : "Information",

    aiSummary: asString(
      raw?.aiSummary ??
      raw?.ai_summary,
      email.snippet || email.subject || ""
    ),

    requiresReply: asBoolean(
      raw?.requiresReply ??
      raw?.requires_reply
    ),

    actionItems: asArray<string>(
      raw?.actionItems ??
      raw?.action_items
    ).filter(
      (item): item is string =>
        typeof item === "string"
    ),

    dueDate:
      typeof (
        raw?.dueDate ??
        raw?.due_date
      ) === "string"
        ? raw?.dueDate ??
          raw?.due_date
        : null,

    confidence: Math.max(
      0,
      Math.min(
        1,
        asNumber(raw?.confidence)
      )
    ),
  };
}

Before iterating over classifications, use:

const rawClassifications =
  Array.isArray(aiResult?.emails)
    ? aiResult.emails
    : Array.isArray(aiResult)
      ? aiResult
      : [];

Never call .map() directly on unvalidated provider output.

3. Normalize responses in src/lib/supabase.ts

Add safe response transformers:

const safeArray = <T,>(
  value: unknown
): T[] => {
  return Array.isArray(value) ? value : [];
};

export function normalizeInsightsResponse(
  raw: any
) {
  const source =
    raw?.insights ??
    raw?.data?.insights ??
    raw ??
    {};

  const briefSource =
    source.brief &&
    typeof source.brief === "object" &&
    !Array.isArray(source.brief)
      ? source.brief
      : {};

  return {
    actionItems: safeArray(
      source.actionItems ??
      source.action_items
    ),

    waitingOn: safeArray(
      source.waitingOn ??
      source.waiting_on
    ),

    bills: safeArray(source.bills),

    followUps: safeArray(
      source.followUps ??
      source.follow_ups
    ),

    calendar: safeArray(source.calendar),

    security: safeArray(source.security),

    purchases: safeArray(source.purchases),

    brief: {
      summary:
        typeof briefSource.summary ===
        "string"
          ? briefSource.summary
          : "",

      highlights: safeArray<string>(
        briefSource.highlights
      ).filter(
        item =>
          typeof item === "string"
      ),
    },
  };
}

Update getInsights() so it always returns this normalized shape.

Example:

export async function getInsights(
  userId: string
) {
  const raw = await existingGetInsightsRequest(
    userId
  );

  return normalizeInsightsResponse(raw);
}

Do the same for the daily brief:

export function normalizeBrief(
  raw: any
) {
  const source =
    raw?.brief ??
    raw?.data ??
    raw ??
    {};

  return {
    summary:
      typeof source.summary === "string"
        ? source.summary
        : "",

    highlights: safeArray<string>(
      source.highlights
    ).filter(
      item =>
        typeof item === "string"
    ),
  };
}
4. Make frontend state updates defensive

In:

src/app/App.tsx

Define a constant default:

const EMPTY_INSIGHTS: Insights = {
  actionItems: [],
  waitingOn: [],
  bills: [],
  followUps: [],
  calendar: [],
  security: [],
  purchases: [],
  brief: [],
};

When setting insights, never use raw results:

const loadedInsights =
  await getInsights(userId);

setInsights({
  actionItems: Array.isArray(
    loadedInsights?.actionItems
  )
    ? loadedInsights.actionItems
    : [],

  waitingOn: Array.isArray(
    loadedInsights?.waitingOn
  )
    ? loadedInsights.waitingOn
    : [],

  bills: Array.isArray(
    loadedInsights?.bills
  )
    ? loadedInsights.bills
    : [],

  followUps: Array.isArray(
    loadedInsights?.followUps
  )
    ? loadedInsights.followUps
    : [],

  calendar: Array.isArray(
    loadedInsights?.calendar
  )
    ? loadedInsights.calendar
    : [],

  security: Array.isArray(
    loadedInsights?.security
  )
    ? loadedInsights.security
    : [],

  purchases: Array.isArray(
    loadedInsights?.purchases
  )
    ? loadedInsights.purchases
    : [],

  brief: Array.isArray(
    loadedInsights?.brief
  )
    ? loadedInsights.brief
    : [],
});

For the daily brief:

const loadedBrief =
  await getDailyBrief(userId);

setBrief({
  summary:
    typeof loadedBrief?.summary ===
    "string"
      ? loadedBrief.summary
      : "",

  highlights: Array.isArray(
    loadedBrief?.highlights
  )
    ? loadedBrief.highlights.filter(
        (item: unknown) =>
          typeof item === "string"
      )
    : [],
});
5. Guard every .map() in React

Search src/app/App.tsx for every occurrence of:

.map(

For any value coming from Supabase, Gemini, Groq, email data, or insights, guard it.

Replace patterns such as:

insights.actionItems.map(...)

with:

(Array.isArray(insights.actionItems)
  ? insights.actionItems
  : []
).map(...)

Replace:

brief.highlights.map(...)

with:

(Array.isArray(brief?.highlights)
  ? brief.highlights
  : []
).map(...)

Replace:

email.actionItems.map(...)

with:

(Array.isArray(email.actionItems)
  ? email.actionItems
  : []
).map(...)

Also guard:

messages.map
emails.map
categories.map
results.map
rules.map
prompts.map

where any of these could originate from an API response.

Do not hide programming errors for known static arrays, but all remote-response arrays must be normalized.

6. Fix the likely brief shape mismatch

The existing frontend appears to expect:

{
  summary: string;
  highlights: string[];
}

But the new Gemini response may return:

{
  brief: {
    summary: string;
    highlights: string[];
  }
}

or:

{
  brief: string[];
}

Standardize the backend and frontend to use only:

interface DailyBrief {
  summary: string;
  highlights: string[];
}

The getDailyBrief() function must always return exactly that shape.

Do not use the same brief field as both an array and an object.

Update the Insights interface so it does not conflict with the standalone brief structure. Prefer:

interface Insights {
  actionItems: any[];
  waitingOn: any[];
  bills: any[];
  followUps: any[];
  calendar: any[];
  security: any[];
  purchases: any[];
}

And keep:

interface DailyBrief {
  summary: string;
  highlights: string[];
}

separately.

7. Add an application error boundary

Create a React error boundary so malformed data cannot blank the entire app.

Use a class-based boundary:

class AppErrorBoundary extends React.Component<
  {
    children: React.ReactNode;
  },
  {
    hasError: boolean;
    message: string;
  }
> {
  constructor(props: {
    children: React.ReactNode;
  }) {
    super(props);

    this.state = {
      hasError: false,
      message: "",
    };
  }

  static getDerivedStateFromError(
    error: Error
  ) {
    return {
      hasError: true,
      message:
        error?.message ||
        "The application encountered an unexpected error.",
    };
  }

  componentDidCatch(
    error: Error,
    info: React.ErrorInfo
  ) {
    console.error(
      "InboxOS render failure:",
      {
        message: error.message,
        componentStack:
          info.componentStack,
      }
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
          <div className="max-w-md text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              InboxOS could not display this data
            </h2>

            <p className="text-sm text-gray-500 mb-5">
              Some AI-generated data had an unexpected format.
            </p>

            <button
              onClick={() => {
                this.setState({
                  hasError: false,
                  message: "",
                });

                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white"
            >
              Reload InboxOS
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

Wrap the application:

export default function App() {
  return (
    <AppErrorBoundary>
      <AppStartup />
    </AppErrorBoundary>
  );
}

Preserve the existing OAuth startup logic by moving it into AppStartup or wrapping the existing root content appropriately.

8. Repair already-corrupted stored insights

The database may already contain malformed AI output.

Add a backend route:

POST /ai/repair-data

It must:

Authenticate the Supabase user.
Load the user’s cached insights.
Normalize every array field.
Normalize the daily brief.
Normalize email actionItems.
Save the repaired records.
Return counts only.

Also ensure getInsights() normalizes existing malformed records even before this repair endpoint is run.

Add a frontend action under Settings:

Repair AI data

After repair, reload emails, insights, and the daily brief.

9. Add safe shape diagnostics

Before setting frontend state, log only shapes:

console.log(
  "InboxOS insight shapes:",
  {
    actionItems:
      Array.isArray(data?.actionItems),
    waitingOn:
      Array.isArray(data?.waitingOn),
    bills:
      Array.isArray(data?.bills),
    followUps:
      Array.isArray(data?.followUps),
    calendar:
      Array.isArray(data?.calendar),
    security:
      Array.isArray(data?.security),
    purchases:
      Array.isArray(data?.purchases),
    briefHighlights:
      Array.isArray(
        brief?.highlights
      ),
  }
);

Do not log email content or AI response contents.

10. Final verification

Confirm:

No remote value has .map() called without array validation.
Gemini raw responses are normalized before storage.
Groq raw responses are normalized before storage.
Existing malformed database records cannot crash React.
brief has one consistent shape.
actionItems is always an array.
Empty AI results render empty states.
An AI-provider failure does not blank the application.
The error boundary displays a recovery screen.
TypeScript builds without errors.
No authentication or Gmail functionality is removed.

Search the frontend for all .map() calls and inspect each one.

Apply the changes directly. Do not only explain them.